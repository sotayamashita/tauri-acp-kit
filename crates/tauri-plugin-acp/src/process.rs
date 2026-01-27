use crate::error::Error;
use crate::events::{emit_event, AcpEvent};
use crate::framing::{JsonlReader, JsonlWriter};
use crate::protocol::{AgentSpec, JsonRpcMessage, JsonRpcNotification, JsonRpcRequest, JsonRpcResponse};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Runtime};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot, RwLock};

/// A clonable handle to send requests to an agent
#[derive(Clone)]
pub struct AgentHandle {
    pub agent_id: String,
    request_tx: mpsc::Sender<(JsonRpcRequest, oneshot::Sender<JsonRpcResponse>)>,
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

        self.request_tx
            .send((request, response_tx))
            .await
            .map_err(|_| Error::Protocol("Failed to send request".to_string()))?;

        response_rx
            .await
            .map_err(|_| Error::Protocol("Failed to receive response".to_string()))
    }
}

pub struct AgentProcess {
    pub id: String,
    pub spec: AgentSpec,
    child: Child,
    handle: AgentHandle,
}

impl AgentProcess {
    pub async fn spawn<R: Runtime>(
        app: AppHandle<R>,
        spec: AgentSpec,
    ) -> Result<Self, Error> {
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

        let mut child = cmd.spawn().map_err(|e| Error::ProcessSpawnFailed(e.to_string()))?;

        let stdin = child.stdin.take().ok_or_else(|| {
            Error::ProcessSpawnFailed("Failed to capture stdin".to_string())
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            Error::ProcessSpawnFailed("Failed to capture stdout".to_string())
        })?;

        let agent_id = spec.id.clone();
        let pending_requests: Arc<RwLock<HashMap<i64, oneshot::Sender<JsonRpcResponse>>>> =
            Arc::new(RwLock::new(HashMap::new()));
        let (request_tx, request_rx) = mpsc::channel::<(JsonRpcRequest, oneshot::Sender<JsonRpcResponse>)>(32);

        // Spawn writer task
        let pending_for_writer = pending_requests.clone();
        tokio::spawn(Self::writer_task(stdin, request_rx, pending_for_writer));

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

        tracing::info!(agent_id = %agent_id, "Agent process spawned");

        let handle = AgentHandle {
            agent_id: agent_id.clone(),
            request_tx,
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
        mut request_rx: mpsc::Receiver<(JsonRpcRequest, oneshot::Sender<JsonRpcResponse>)>,
        pending_requests: Arc<RwLock<HashMap<i64, oneshot::Sender<JsonRpcResponse>>>>,
    ) {
        let mut writer = JsonlWriter::new(stdin);

        while let Some((request, response_tx)) = request_rx.recv().await {
            let id = match &request.id {
                crate::protocol::JsonRpcId::Number(n) => *n,
                crate::protocol::JsonRpcId::String(s) => s.parse().unwrap_or(0),
            };

            {
                let mut pending = pending_requests.write().await;
                pending.insert(id, response_tx);
            }

            if let Err(e) = writer.write_message(&request).await {
                tracing::error!("Failed to write request: {}", e);
                let mut pending = pending_requests.write().await;
                pending.remove(&id);
            }
        }
    }

    async fn reader_task<R: Runtime>(
        stdout: ChildStdout,
        pending_requests: Arc<RwLock<HashMap<i64, oneshot::Sender<JsonRpcResponse>>>>,
        app: AppHandle<R>,
        _agent_id: String,
    ) {
        let mut reader = JsonlReader::new(stdout);

        loop {
            match reader.read_message().await {
                Ok(Some(message)) => {
                    match message {
                        JsonRpcMessage::Response(response) => {
                            let id = match &response.id {
                                crate::protocol::JsonRpcId::Number(n) => *n,
                                crate::protocol::JsonRpcId::String(s) => s.parse().unwrap_or(0),
                            };

                            let mut pending = pending_requests.write().await;
                            if let Some(tx) = pending.remove(&id) {
                                let _ = tx.send(response);
                            }
                        }
                        JsonRpcMessage::Notification(notification) => {
                            Self::handle_notification(&app, notification);
                        }
                        JsonRpcMessage::Request(_) => {
                            tracing::warn!("Received unexpected request from agent");
                        }
                    }
                }
                Ok(None) => {
                    tracing::info!("Agent stdout closed");
                    break;
                }
                Err(e) => {
                    tracing::error!("Error reading from agent: {}", e);
                    break;
                }
            }
        }
    }

    fn handle_notification<R: Runtime>(app: &AppHandle<R>, notification: JsonRpcNotification) {
        match notification.method.as_str() {
            "delta" => {
                if let (Some(session_id), Some(text)) = (
                    notification.params.get("sessionId").and_then(|v| v.as_str()),
                    notification.params.get("text").and_then(|v| v.as_str()),
                ) {
                    emit_event(app, AcpEvent::Delta {
                        session_id: session_id.to_string(),
                        text: text.to_string(),
                    });
                }
            }
            "complete" => {
                if let (Some(session_id), Some(stop_reason)) = (
                    notification.params.get("sessionId").and_then(|v| v.as_str()),
                    notification.params.get("stopReason").and_then(|v| v.as_str()),
                ) {
                    emit_event(app, AcpEvent::Complete {
                        session_id: session_id.to_string(),
                        stop_reason: stop_reason.to_string(),
                    });
                }
            }
            _ => {
                tracing::debug!("Unknown notification: {}", notification.method);
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
