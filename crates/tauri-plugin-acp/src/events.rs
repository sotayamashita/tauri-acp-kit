use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

pub const ACP_EVENT_CHANNEL: &str = "acp://event";

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[allow(dead_code)]
pub enum AcpEvent {
    Delta {
        session_id: String,
        text: String,
    },
    ThoughtDelta {
        session_id: String,
        text: String,
    },
    ToolCall {
        session_id: String,
        tool_call_id: String,
        tool_name: String,
        status: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input: Option<serde_json::Value>,
        #[serde(skip_serializing_if = "Option::is_none")]
        content: Option<serde_json::Value>,
    },
    ToolCallUpdate {
        session_id: String,
        tool_call_id: String,
        status: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        content: Option<serde_json::Value>,
    },
    PlanUpdate {
        session_id: String,
        tasks: serde_json::Value,
    },
    Complete {
        session_id: String,
        stop_reason: String,
    },
    Error {
        #[serde(skip_serializing_if = "Option::is_none")]
        session_id: Option<String>,
        message: String,
    },
    AgentSpawned {
        agent_id: String,
    },
    SessionReady {
        session_id: String,
        agent_id: String,
    },
    AgentTerminated {
        agent_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        exit_code: Option<i32>,
    },
}

pub fn emit_event<R: Runtime>(app: &AppHandle<R>, event: AcpEvent) {
    tracing::debug!("Emitting ACP event: {:?}", event);
    if let Err(e) = app.emit(ACP_EVENT_CHANNEL, &event) {
        tracing::error!("Failed to emit ACP event: {}", e);
    }
}
