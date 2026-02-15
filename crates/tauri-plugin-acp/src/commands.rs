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
    // Generate unique agent ID to prevent collisions (e.g., from React StrictMode double-mounting)
    let agent_id = format!("{}-{}", spec.id, uuid::Uuid::new_v4());
    tracing::info!(agent_id = %agent_id, spec_id = %spec.id, "Creating new agent with unique ID");

    let agent = AgentProcess::spawn(app.clone(), spec, agent_id.clone()).await?;
    state.add_agent(agent).await;

    emit_event(
        &app,
        AcpEvent::AgentSpawned {
            agent_id: agent_id.clone(),
        },
    );

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

    // ACP: Send initialize request (verified against claude-code-acp v0.16.0)
    let init_params = serde_json::json!({
        "protocolVersion": 1,
        "clientCapabilities": {}
    });

    let response = handle.send_request("initialize", init_params).await?;

    if response.error.is_some() {
        return Err(Error::Protocol(format!(
            "Initialize failed: {:?}",
            response.error
        )));
    }

    tracing::debug!("Initialize response: {:?}", response);

    // ACP: initialize response completes the handshake.
    // No separate 'initialized' notification needed (unlike Codex).

    // ACP: session/new creates a new session (mcpServers required)
    let session_params = serde_json::json!({
        "cwd": cwd,
        "mcpServers": []
    });

    let session_response = handle.send_request("session/new", session_params).await?;

    if session_response.error.is_some() {
        return Err(Error::Protocol(format!(
            "session/new failed: {:?}",
            session_response.error
        )));
    }

    tracing::debug!("session/new response: {:?}", session_response);

    // Extract session ID and model from response
    let result = session_response.result.as_ref();

    // claude-code-acp returns { sessionId, models, modes } at the top level
    let returned_session_id = result
        .and_then(|r| r.get("sessionId"))
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| {
            tracing::warn!("No sessionId in response, using generated UUID");
            ""
        });

    let model = result
        .and_then(|r| r.get("models"))
        .and_then(|m| m.as_array())
        .and_then(|arr| arr.first())
        .and_then(|m| m.get("value"))
        .and_then(|v| v.as_str())
        .unwrap_or("claude")
        .to_string();

    tracing::info!(session_id = %returned_session_id, model = %model, "Session created");

    let session_id = if returned_session_id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        returned_session_id.to_string()
    };

    let session = Session {
        id: session_id.clone(),
        agent_id: agent_id.clone(),
        cwd,
        model,
    };

    state.add_session(session).await;

    emit_event(
        &app,
        AcpEvent::SessionReady {
            session_id: session_id.clone(),
            agent_id,
        },
    );

    Ok(session_id)
}

#[tauri::command]
pub async fn acp_send_prompt<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, PluginState>,
    session_id: String,
    prompt: String,
) -> Result<String, Error> {
    let session = state.get_session(&session_id).await?;
    let handle = state.get_agent_handle(&session.agent_id).await?;
    let request_id = uuid::Uuid::new_v4().to_string();

    // ACP: session/prompt sends a prompt and receives a response
    // Field must be "prompt" (not "input") — claude-code-acp's promptToClaude()
    // reads params.prompt to build the content array for Claude.
    let prompt_params = serde_json::json!({
        "sessionId": session_id,
        "prompt": [{
            "type": "text",
            "text": prompt
        }]
    });

    tracing::debug!(
        session_id = %session_id,
        model = %session.model,
        "Sending prompt via ACP session/prompt"
    );

    // ACP: session/prompt is a request that returns a response with completion.
    // Streaming updates arrive via session/update notifications.
    // The response itself signals completion.
    let request_id_clone = request_id.clone();
    let session_id_clone = session_id.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        match handle.send_request("session/prompt", prompt_params).await {
            Ok(response) => {
                tracing::debug!(request_id = %request_id_clone, "Prompt response received: {:?}", response);

                // Check if the response contains an error (e.g., invalid params, internal error)
                if let Some(ref err) = response.error {
                    let data_str = err
                        .data
                        .as_ref()
                        .map(|d| format!(" data={}", d))
                        .unwrap_or_default();
                    let error_msg = format!(
                        "session/prompt error: code={}, message={}{}",
                        err.code, err.message, data_str,
                    );
                    tracing::error!(request_id = %request_id_clone, "{}", error_msg);
                    emit_event(
                        &app_clone,
                        AcpEvent::Error {
                            session_id: Some(session_id_clone),
                            message: error_msg,
                        },
                    );
                    return;
                }

                // ACP: The response to session/prompt indicates completion.
                // Emit Complete event here since ACP doesn't send a separate
                // turn/completed notification like Codex does.
                emit_event(
                    &app_clone,
                    AcpEvent::Complete {
                        session_id: session_id_clone,
                        stop_reason: "end_turn".to_string(),
                    },
                );
            }
            Err(e) => {
                tracing::error!(request_id = %request_id_clone, "Prompt request failed: {}", e);
                emit_event(
                    &app_clone,
                    AcpEvent::Error {
                        session_id: Some(session_id_clone),
                        message: e.to_string(),
                    },
                );
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

    // ACP: session/cancel is a notification (fire-and-forget), not a request
    let cancel_params = serde_json::json!({
        "sessionId": session_id
    });

    handle
        .send_notification("session/cancel", cancel_params)
        .await?;

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

    emit_event(
        &app,
        AcpEvent::AgentTerminated {
            agent_id,
            exit_code: Some(0),
        },
    );

    Ok(())
}
