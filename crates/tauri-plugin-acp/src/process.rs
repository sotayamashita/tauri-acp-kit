use crate::error::Error;
use crate::events::{emit_event, AcpEvent};
use crate::framing::{JsonlReader, JsonlWriter};
use crate::protocol::{AgentSpec, JsonRpcMessage, JsonRpcNotification, JsonRpcRequest, JsonRpcResponse};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot, RwLock};

/// Message types that can be sent to the agent
pub enum OutgoingMessage {
    Request(JsonRpcRequest, oneshot::Sender<JsonRpcResponse>),
    Notification(JsonRpcNotification),
}

/// A clonable handle to send requests to an agent
#[derive(Clone)]
pub struct AgentHandle {
    #[allow(dead_code)]
    pub agent_id: String,
    message_tx: mpsc::Sender<OutgoingMessage>,
    next_request_id: Arc<RwLock<i64>>,
}

impl AgentHandle {
    pub async fn send_request(&self, method: &str, params: serde_json::Value) -> Result<JsonRpcResponse, Error> {
        let id = {
            let mut next_id = self.next_request_id.write().await;
            let id = *next_id;
            *next_id += 1;
            id
        };

        let request = JsonRpcRequest::new(id, method, params);
        let (response_tx, response_rx) = oneshot::channel();

        self.message_tx
            .send(OutgoingMessage::Request(request, response_tx))
            .await
            .map_err(|_| Error::Protocol("Failed to send request".to_string()))?;

        response_rx
            .await
            .map_err(|_| Error::Protocol("Failed to receive response".to_string()))
    }

    /// Send a notification (fire-and-forget, no response expected)
    pub async fn send_notification(&self, method: &str, params: serde_json::Value) -> Result<(), Error> {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: method.to_string(),
            params,
        };

        self.message_tx
            .send(OutgoingMessage::Notification(notification))
            .await
            .map_err(|_| Error::Protocol("Failed to send notification".to_string()))?;

        Ok(())
    }
}

pub struct AgentProcess {
    pub id: String,
    #[allow(dead_code)]
    pub spec: AgentSpec,
    child: Child,
    handle: AgentHandle,
}

impl AgentProcess {
    pub async fn spawn<R: Runtime>(
        app: AppHandle<R>,
        spec: AgentSpec,
        agent_id: String,
    ) -> Result<Self, Error> {
        tracing::info!(
            agent_id = %agent_id,
            executable = %spec.executable,
            args = ?spec.args,
            cwd = ?spec.cwd,
            "Spawning agent process"
        );

        let mut cmd = Command::new(&spec.executable);
        cmd.args(&spec.args);

        for (key, value) in &spec.env {
            cmd.env(key, value);
        }

        if let Some(cwd) = &spec.cwd {
            cmd.current_dir(cwd);
        }

        cmd.stdin(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            tracing::error!(error = %e, "Failed to spawn process");
            Error::ProcessSpawnFailed(e.to_string())
        })?;

        tracing::debug!(agent_id = %agent_id, "Process spawned, capturing stdio");

        let stdin = child.stdin.take().ok_or_else(|| {
            Error::ProcessSpawnFailed("Failed to capture stdin".to_string())
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            Error::ProcessSpawnFailed("Failed to capture stdout".to_string())
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            Error::ProcessSpawnFailed("Failed to capture stderr".to_string())
        })?;
        let pending_requests: Arc<RwLock<HashMap<i64, oneshot::Sender<JsonRpcResponse>>>> =
            Arc::new(RwLock::new(HashMap::new()));
        let (message_tx, message_rx) = mpsc::channel::<OutgoingMessage>(32);

        // Spawn writer task
        let pending_for_writer = pending_requests.clone();
        tokio::spawn(Self::writer_task(stdin, message_rx, pending_for_writer));

        // Spawn reader task
        let pending_for_reader = pending_requests.clone();
        let app_for_reader = app.clone();
        let agent_id_for_reader = agent_id.clone();
        tokio::spawn(Self::reader_task(
            stdout,
            pending_for_reader,
            app_for_reader,
            agent_id_for_reader,
        ));

        // Spawn stderr reader task
        let agent_id_for_stderr = agent_id.clone();
        tokio::spawn(Self::stderr_task(stderr, agent_id_for_stderr));

        tracing::info!(agent_id = %agent_id, "Agent process spawned");

        let handle = AgentHandle {
            agent_id: agent_id.clone(),
            message_tx,
            next_request_id: Arc::new(RwLock::new(1)),
        };

        Ok(Self {
            id: agent_id,
            spec,
            child,
            handle,
        })
    }

    async fn writer_task(
        stdin: ChildStdin,
        mut message_rx: mpsc::Receiver<OutgoingMessage>,
        pending_requests: Arc<RwLock<HashMap<i64, oneshot::Sender<JsonRpcResponse>>>>,
    ) {
        let mut writer = JsonlWriter::new(stdin);

        while let Some(message) = message_rx.recv().await {
            match message {
                OutgoingMessage::Request(request, response_tx) => {
                    let id = match &request.id {
                        crate::protocol::JsonRpcId::Number(n) => *n,
                        crate::protocol::JsonRpcId::String(s) => s.parse().unwrap_or(0),
                    };

                    tracing::debug!(id = id, method = %request.method, "Sending request to agent");

                    {
                        let mut pending = pending_requests.write().await;
                        pending.insert(id, response_tx);
                    }

                    if let Err(e) = writer.write_message(&request).await {
                        tracing::error!("Failed to write request: {}", e);
                        let mut pending = pending_requests.write().await;
                        pending.remove(&id);
                    } else {
                        tracing::debug!(id = id, "Request sent successfully");
                    }
                }
                OutgoingMessage::Notification(notification) => {
                    tracing::debug!(method = %notification.method, "Sending notification to agent");

                    if let Err(e) = writer.write_message(&notification).await {
                        tracing::error!("Failed to write notification: {}", e);
                    } else {
                        tracing::debug!(method = %notification.method, "Notification sent successfully");
                    }
                }
            }
        }
    }

    async fn reader_task<R: Runtime>(
        stdout: ChildStdout,
        pending_requests: Arc<RwLock<HashMap<i64, oneshot::Sender<JsonRpcResponse>>>>,
        app: AppHandle<R>,
        agent_id: String,
    ) {
        let mut reader = JsonlReader::new(stdout);
        tracing::info!(agent_id = %agent_id, "Reader task started");

        loop {
            match reader.read_message().await {
                Ok(Some(message)) => {
                    tracing::debug!(agent_id = %agent_id, "Received message: {:?}", message);
                    match message {
                        JsonRpcMessage::Response(response) => {
                            let id = match &response.id {
                                crate::protocol::JsonRpcId::Number(n) => *n,
                                crate::protocol::JsonRpcId::String(s) => s.parse().unwrap_or(0),
                            };

                            tracing::debug!(id = id, "Processing response");
                            let mut pending = pending_requests.write().await;
                            if let Some(tx) = pending.remove(&id) {
                                tracing::debug!(id = id, "Sending response to waiting caller");
                                let _ = tx.send(response);
                            } else {
                                tracing::warn!(id = id, "No pending request found for response");
                            }
                        }
                        JsonRpcMessage::Notification(notification) => {
                            tracing::debug!(method = %notification.method, "Processing notification");
                            Self::handle_notification(&app, notification);
                        }
                        JsonRpcMessage::Request(_) => {
                            tracing::warn!("Received unexpected request from agent");
                        }
                    }
                }
                Ok(None) => {
                    tracing::info!(agent_id = %agent_id, "Agent stdout closed");
                    break;
                }
                Err(e) => {
                    tracing::error!(agent_id = %agent_id, "Error reading from agent: {}", e);
                    break;
                }
            }
        }
    }

    async fn stderr_task(stderr: ChildStderr, agent_id: String) {
        let mut reader = BufReader::new(stderr);
        let mut line = String::new();

        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    tracing::debug!(agent_id = %agent_id, "Agent stderr closed");
                    break;
                }
                Ok(_) => {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        tracing::warn!(agent_id = %agent_id, "Agent stderr: {}", trimmed);
                    }
                }
                Err(e) => {
                    tracing::error!(agent_id = %agent_id, "Error reading stderr: {}", e);
                    break;
                }
            }
        }
    }

    fn handle_notification<R: Runtime>(app: &AppHandle<R>, notification: JsonRpcNotification) {
        match notification.method.as_str() {
            // Codex: streaming text delta from agent message
            "item/agentMessage/delta" => {
                if let (Some(thread_id), Some(delta)) = (
                    notification.params.get("threadId").and_then(|v| v.as_str()),
                    notification.params.get("delta").and_then(|v| v.as_str()),
                ) {
                    tracing::debug!(thread_id = %thread_id, delta_len = delta.len(), "Agent message delta");
                    emit_event(app, AcpEvent::Delta {
                        session_id: thread_id.to_string(),
                        text: delta.to_string(),
                    });
                }
            }
            // Codex: turn completed
            "turn/completed" => {
                if let Some(thread_id) = notification.params.get("threadId").and_then(|v| v.as_str()) {
                    tracing::debug!(thread_id = %thread_id, "Turn completed");
                    emit_event(app, AcpEvent::Complete {
                        session_id: thread_id.to_string(),
                        stop_reason: "end_turn".to_string(),
                    });
                }
            }
            // Codex: turn started
            "turn/started" => {
                if let Some(thread_id) = notification.params.get("threadId").and_then(|v| v.as_str()) {
                    tracing::debug!(thread_id = %thread_id, "Turn started");
                }
            }
            // Codex: item started
            "item/started" => {
                tracing::debug!(params = ?notification.params, "Item started");
            }
            // Codex: item completed
            "item/completed" => {
                tracing::debug!(params = ?notification.params, "Item completed");
            }
            // Codex: config warning (non-critical)
            "configWarning" => {
                tracing::debug!("Config warning received");
            }
            _ => {
                tracing::debug!("Unknown notification: {} params: {:?}", notification.method, notification.params);
            }
        }
    }

    pub fn handle(&self) -> AgentHandle {
        self.handle.clone()
    }

    pub async fn terminate(&mut self) -> Result<(), Error> {
        self.child.kill().await?;
        Ok(())
    }
}
