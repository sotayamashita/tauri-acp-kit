use crate::error::Error;
use crate::events::{emit_event, AcpEvent};
use crate::process::AgentProcess;
use crate::protocol::AgentSpec;
use crate::state::{PluginState, Session};
use tauri::{AppHandle, Runtime, State};

#[tauri::command]
pub async fn acp_spawn_agent<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, PluginState>,
    spec: AgentSpec,
) -> Result<String, Error> {
    let agent_id = spec.id.clone();

    let agent = AgentProcess::spawn(app.clone(), spec).await?;
    state.add_agent(agent).await;

    emit_event(&app, AcpEvent::AgentSpawned {
        agent_id: agent_id.clone(),
    });

    Ok(agent_id)
}

#[tauri::command]
pub async fn acp_start_session<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, PluginState>,
    agent_id: String,
    cwd: String,
) -> Result<String, Error> {
    let handle = state.get_agent_handle(&agent_id).await?;

    let session_id = uuid::Uuid::new_v4().to_string();

    // Send initialize request to agent
    let init_params = serde_json::json!({
        "clientInfo": {
            "name": "tauri-acp",
            "version": "0.1.0"
        },
        "workingDirectory": cwd
    });

    let response = handle.send_request("initialize", init_params).await?;

    if response.error.is_some() {
        return Err(Error::Protocol(format!(
            "Initialize failed: {:?}",
            response.error
        )));
    }

    let session = Session {
        id: session_id.clone(),
        agent_id: agent_id.clone(),
        cwd,
    };

    state.add_session(session).await;

    emit_event(&app, AcpEvent::SessionReady {
        session_id: session_id.clone(),
        agent_id,
    });

    Ok(session_id)
}

#[tauri::command]
pub async fn acp_send_prompt<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, PluginState>,
    session_id: String,
    prompt: String,
) -> Result<String, Error> {
    let session = state.get_session(&session_id).await?;
    let handle = state.get_agent_handle(&session.agent_id).await?;
    let request_id = uuid::Uuid::new_v4().to_string();

    let prompt_params = serde_json::json!({
        "sessionId": session_id,
        "requestId": request_id,
        "text": prompt
    });

    // Spawn task to send prompt (don't block, streaming via events)
    let request_id_clone = request_id.clone();
    tokio::spawn(async move {
        match handle.send_request("prompt", prompt_params).await {
            Ok(_response) => {
                tracing::debug!(request_id = %request_id_clone, "Prompt response received");
            }
            Err(e) => {
                tracing::error!(request_id = %request_id_clone, "Prompt request failed: {}", e);
            }
        }
    });

    Ok(request_id)
}

#[tauri::command]
pub async fn acp_cancel<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, PluginState>,
    session_id: String,
) -> Result<(), Error> {
    let session = state.get_session(&session_id).await?;
    let handle = state.get_agent_handle(&session.agent_id).await?;

    let cancel_params = serde_json::json!({
        "sessionId": session_id
    });

    handle.send_request("cancel", cancel_params).await?;

    Ok(())
}

#[tauri::command]
pub async fn acp_terminate_agent<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, PluginState>,
    agent_id: String,
) -> Result<(), Error> {
    let mut agent = state
        .remove_agent(&agent_id)
        .await
        .ok_or_else(|| Error::AgentNotFound(agent_id.clone()))?;

    agent.terminate().await?;

    emit_event(&app, AcpEvent::AgentTerminated {
        agent_id,
        exit_code: Some(0),
    });

    Ok(())
}
