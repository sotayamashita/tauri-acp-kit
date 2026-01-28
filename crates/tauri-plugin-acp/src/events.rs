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
    Complete {
        session_id: String,
        stop_reason: String,
    },
    Error {
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
        exit_code: Option<i32>,
    },
}

pub fn emit_event<R: Runtime>(app: &AppHandle<R>, event: AcpEvent) {
    tracing::debug!("Emitting ACP event: {:?}", event);
    if let Err(e) = app.emit(ACP_EVENT_CHANNEL, &event) {
        tracing::error!("Failed to emit ACP event: {}", e);
    }
}
