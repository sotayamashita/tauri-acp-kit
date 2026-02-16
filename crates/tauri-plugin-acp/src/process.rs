use crate::error::Error;
use crate::events::{emit_event, AcpEvent};
use crate::framing::{JsonlReader, JsonlWriter};
use crate::protocol::{
    AgentSpec, JsonRpcMessage, JsonRpcNotification, JsonRpcRequest, JsonRpcResponse,
};
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
#[derive(Debug, Clone)]
pub struct AgentHandle {
    #[allow(dead_code)]
    pub agent_id: String,
    message_tx: mpsc::Sender<OutgoingMessage>,
    next_request_id: Arc<RwLock<i64>>,
}

impl AgentHandle {
    pub async fn send_request(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<JsonRpcResponse, Error> {
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
    pub async fn send_notification(
        &self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<(), Error> {
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

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| Error::ProcessSpawnFailed("Failed to capture stdin".to_string()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| Error::ProcessSpawnFailed("Failed to capture stdout".to_string()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| Error::ProcessSpawnFailed("Failed to capture stderr".to_string()))?;
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
                    let id = request.id.as_i64();

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
                            let id = response.id.as_i64();

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
        if let Some(event) = parse_notification(&notification) {
            emit_event(app, event);
        } else {
            tracing::debug!(
                method = %notification.method,
                "Unhandled notification: {:?}",
                notification.params
            );
        }
    }

    pub fn handle(&self) -> AgentHandle {
        self.handle.clone()
    }

    pub async fn terminate(&mut self) -> Result<Option<i32>, Error> {
        self.child.kill().await?;
        let status = self.child.wait().await?;
        Ok(status.code())
    }
}

/// Parse an ACP notification into an event, if recognized.
/// Separated from `handle_notification` for testability without Tauri AppHandle.
fn parse_notification(notification: &JsonRpcNotification) -> Option<AcpEvent> {
    match notification.method.as_str() {
        // ACP: streaming text delta from agent message
        // session/update with sessionUpdate containing agent_message_chunk
        "session/update" => {
            let session_id = notification
                .params
                .get("sessionId")
                .and_then(|v| v.as_str())?;
            let update = notification.params.get("update")?;
            let update_type = update.get("sessionUpdate").and_then(|v| v.as_str())?;

            let content = update.get("content");

            match update_type {
                "agent_message_chunk" => {
                    let text = content
                        .and_then(|c| c.get("text"))
                        .and_then(|v| v.as_str())?;
                    tracing::debug!(
                        session_id = %session_id,
                        delta_len = text.len(),
                        "Agent message delta"
                    );
                    Some(AcpEvent::Delta {
                        session_id: session_id.to_string(),
                        text: text.to_string(),
                    })
                }
                "agent_thought_chunk" => {
                    let text = content
                        .and_then(|c| c.get("text"))
                        .and_then(|v| v.as_str())?;
                    tracing::debug!(
                        session_id = %session_id,
                        delta_len = text.len(),
                        "Agent thought delta"
                    );
                    Some(AcpEvent::ThoughtDelta {
                        session_id: session_id.to_string(),
                        text: text.to_string(),
                    })
                }
                "tool_call" => {
                    let content_val = content?;
                    let tool_call_id = content_val.get("toolCallId").and_then(|v| v.as_str())?;
                    let tool_name = content_val.get("toolName").and_then(|v| v.as_str())?;
                    let status = content_val
                        .get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("pending");
                    tracing::debug!(
                        session_id = %session_id,
                        tool_call_id = %tool_call_id,
                        tool_name = %tool_name,
                        status = %status,
                        "Tool call"
                    );
                    Some(AcpEvent::ToolCall {
                        session_id: session_id.to_string(),
                        tool_call_id: tool_call_id.to_string(),
                        tool_name: tool_name.to_string(),
                        status: status.to_string(),
                        input: content_val.get("input").cloned(),
                        content: content_val.get("content").cloned(),
                    })
                }
                "tool_call_update" => {
                    let content_val = content?;
                    let tool_call_id = content_val.get("toolCallId").and_then(|v| v.as_str())?;
                    let status = content_val
                        .get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("completed");
                    tracing::debug!(
                        session_id = %session_id,
                        tool_call_id = %tool_call_id,
                        status = %status,
                        "Tool call update"
                    );
                    Some(AcpEvent::ToolCallUpdate {
                        session_id: session_id.to_string(),
                        tool_call_id: tool_call_id.to_string(),
                        status: status.to_string(),
                        content: content_val.get("content").cloned(),
                    })
                }
                "plan" => {
                    let tasks = content
                        .and_then(|c| c.get("tasks"))
                        .cloned()
                        .unwrap_or(serde_json::Value::Array(vec![]));
                    tracing::debug!(
                        session_id = %session_id,
                        "Plan update"
                    );
                    Some(AcpEvent::PlanUpdate {
                        session_id: session_id.to_string(),
                        tasks,
                    })
                }
                _ => {
                    // Step 14.0: Wire protocol discovery — log unhandled types
                    tracing::info!(
                        session_id = %session_id,
                        update_type = %update_type,
                        full_content = %serde_json::to_string(&update).unwrap_or_default(),
                        "DISCOVERY: unhandled session/update type"
                    );
                    None
                }
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_notification_agent_message_chunk() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": { "type": "text", "text": "Hello world" }
                }
            }),
        };

        let event = parse_notification(&notification).unwrap();
        match event {
            AcpEvent::Delta { session_id, text } => {
                assert_eq!(session_id, "sess-1");
                assert_eq!(text, "Hello world");
            }
            _ => panic!("Expected Delta event"),
        }
    }

    #[test]
    fn parse_notification_unknown_update_type() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "tool_call",
                    "content": {}
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_unknown_method() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "unknown/method".to_string(),
            params: serde_json::json!({}),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_missing_session_id() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": { "type": "text", "text": "Hello" }
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_missing_content_text() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": { "type": "text" }
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_agent_thought_chunk() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "agent_thought_chunk",
                    "content": { "type": "text", "text": "Let me think..." }
                }
            }),
        };

        let event = parse_notification(&notification).unwrap();
        match event {
            AcpEvent::ThoughtDelta { session_id, text } => {
                assert_eq!(session_id, "sess-1");
                assert_eq!(text, "Let me think...");
            }
            _ => panic!("Expected ThoughtDelta event"),
        }
    }

    #[test]
    fn parse_notification_agent_thought_chunk_missing_text() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "agent_thought_chunk",
                    "content": { "type": "text" }
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_tool_call() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "tool_call",
                    "content": {
                        "toolCallId": "tc-1",
                        "toolName": "Read",
                        "status": "pending",
                        "input": { "path": "src/App.tsx" }
                    }
                }
            }),
        };

        let event = parse_notification(&notification).unwrap();
        match event {
            AcpEvent::ToolCall {
                session_id,
                tool_call_id,
                tool_name,
                status,
                input,
                content,
            } => {
                assert_eq!(session_id, "sess-1");
                assert_eq!(tool_call_id, "tc-1");
                assert_eq!(tool_name, "Read");
                assert_eq!(status, "pending");
                assert!(input.is_some());
                assert!(content.is_none());
            }
            _ => panic!("Expected ToolCall event"),
        }
    }

    #[test]
    fn parse_notification_tool_call_missing_tool_call_id() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "tool_call",
                    "content": {
                        "toolName": "Read",
                        "status": "pending"
                    }
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_tool_call_missing_tool_name() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "tool_call",
                    "content": {
                        "toolCallId": "tc-1",
                        "status": "pending"
                    }
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_tool_call_defaults_status_to_pending() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "tool_call",
                    "content": {
                        "toolCallId": "tc-1",
                        "toolName": "Bash"
                    }
                }
            }),
        };

        let event = parse_notification(&notification).unwrap();
        match event {
            AcpEvent::ToolCall { status, .. } => {
                assert_eq!(status, "pending");
            }
            _ => panic!("Expected ToolCall event"),
        }
    }

    #[test]
    fn parse_notification_tool_call_update() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "tool_call_update",
                    "content": {
                        "toolCallId": "tc-1",
                        "status": "completed",
                        "content": [{ "type": "text", "text": "file contents" }]
                    }
                }
            }),
        };

        let event = parse_notification(&notification).unwrap();
        match event {
            AcpEvent::ToolCallUpdate {
                session_id,
                tool_call_id,
                status,
                content,
            } => {
                assert_eq!(session_id, "sess-1");
                assert_eq!(tool_call_id, "tc-1");
                assert_eq!(status, "completed");
                assert!(content.is_some());
            }
            _ => panic!("Expected ToolCallUpdate event"),
        }
    }

    #[test]
    fn parse_notification_tool_call_update_missing_id() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "tool_call_update",
                    "content": {
                        "status": "completed"
                    }
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }

    #[test]
    fn parse_notification_plan() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "plan",
                    "content": {
                        "tasks": [
                            { "id": "t1", "title": "Read file", "status": "completed" },
                            { "id": "t2", "title": "Write file", "status": "pending" }
                        ]
                    }
                }
            }),
        };

        let event = parse_notification(&notification).unwrap();
        match event {
            AcpEvent::PlanUpdate { session_id, tasks } => {
                assert_eq!(session_id, "sess-1");
                let tasks_arr = tasks.as_array().unwrap();
                assert_eq!(tasks_arr.len(), 2);
            }
            _ => panic!("Expected PlanUpdate event"),
        }
    }

    #[test]
    fn parse_notification_plan_missing_tasks() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "plan",
                    "content": {}
                }
            }),
        };

        let event = parse_notification(&notification).unwrap();
        match event {
            AcpEvent::PlanUpdate { tasks, .. } => {
                assert!(tasks.as_array().unwrap().is_empty());
            }
            _ => panic!("Expected PlanUpdate event"),
        }
    }

    #[test]
    fn parse_notification_unknown_type_returns_none() {
        let notification = JsonRpcNotification {
            jsonrpc: Some("2.0".to_string()),
            method: "session/update".to_string(),
            params: serde_json::json!({
                "sessionId": "sess-1",
                "update": {
                    "sessionUpdate": "user_message_chunk",
                    "content": { "text": "echo" }
                }
            }),
        };

        assert!(parse_notification(&notification).is_none());
    }
}
