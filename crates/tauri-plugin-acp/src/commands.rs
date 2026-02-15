use crate::error::Error;
use crate::events::{emit_event, AcpEvent};
use crate::process::AgentProcess;
use crate::protocol::AgentSpec;
use crate::state::{AcpModelInfo, PluginState, Session};
use serde::Serialize;
use tauri::{AppHandle, Runtime, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfoResponse {
    pub session_id: String,
    pub models: Vec<AcpModelInfo>,
    pub current_model_id: Option<String>,
}

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
) -> Result<SessionInfoResponse, Error> {
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

    // Log raw response JSON for debugging model parsing issues
    if let Some(ref result_val) = session_response.result {
        tracing::info!(
            "session/new result: {}",
            serde_json::to_string(result_val).unwrap_or_else(|_| "<serialize error>".into())
        );
    } else {
        tracing::warn!("session/new returned no result field");
    }

    let result = session_response.result.as_ref();

    // Extract session ID
    let returned_session_id = result
        .and_then(|r| r.get("sessionId"))
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| {
            tracing::warn!("No sessionId in response, using generated UUID");
            ""
        });

    let session_id = if returned_session_id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        returned_session_id.to_string()
    };

    // Extract models from session/new response
    // claude-code-acp: { models: { availableModels: [{modelId, name, description}], currentModelId } }
    // codex-acp: { models: { available_models: [{model_id, name, description}], current_model_id } }
    let models_obj = result.and_then(|r| r.get("models"));

    tracing::info!(
        "session/new models field present: {}, raw: {}",
        models_obj.is_some(),
        models_obj
            .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "<serialize error>".into()))
            .unwrap_or_else(|| "null".into())
    );

    let available_models = parse_available_models(models_obj);
    let current_model_id = models_obj
        .and_then(|m| {
            m.get("currentModelId")
                .or_else(|| m.get("current_model_id"))
        })
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let model = current_model_id
        .clone()
        .or_else(|| available_models.first().map(|m| m.id.clone()))
        .unwrap_or_else(|| "claude".to_string());

    tracing::info!(
        session_id = %session_id,
        model = %model,
        models_count = available_models.len(),
        model_ids = ?available_models.iter().map(|m| &m.id).collect::<Vec<_>>(),
        "Session created"
    );

    let session = Session {
        id: session_id.clone(),
        agent_id: agent_id.clone(),
        cwd,
        model,
        available_models: available_models.clone(),
        current_model_id: current_model_id.clone(),
    };

    state.add_session(session).await;

    emit_event(
        &app,
        AcpEvent::SessionReady {
            session_id: session_id.clone(),
            agent_id,
        },
    );

    Ok(SessionInfoResponse {
        session_id,
        models: available_models,
        current_model_id,
    })
}

fn parse_available_models(models_obj: Option<&serde_json::Value>) -> Vec<AcpModelInfo> {
    let models_obj = match models_obj {
        Some(obj) => obj,
        None => return Vec::new(),
    };

    // Try claude-code-acp format: { availableModels: [...] }
    let models_array = models_obj
        .get("availableModels")
        // Try codex-acp format: { available_models: [...] }
        .or_else(|| models_obj.get("available_models"))
        .and_then(|v| v.as_array());

    match models_array {
        Some(arr) => arr
            .iter()
            .filter_map(|m| {
                let id = m
                    .get("modelId")
                    .or_else(|| m.get("model_id"))
                    .and_then(|v| v.as_str())?;
                let name = m.get("name").and_then(|v| v.as_str()).unwrap_or(id);
                let description = m
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                Some(AcpModelInfo {
                    id: id.to_string(),
                    name: name.to_string(),
                    description,
                })
            })
            .collect(),
        None => Vec::new(),
    }
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
pub async fn acp_set_model<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, PluginState>,
    session_id: String,
    model_id: String,
) -> Result<(), Error> {
    let session = state.get_session(&session_id).await?;
    let handle = state.get_agent_handle(&session.agent_id).await?;

    let params = serde_json::json!({
        "sessionId": session_id,
        "modelId": model_id
    });

    // ACP wire method name is "session/set_model" (snake_case, from @agentclientprotocol/sdk AGENT_METHODS)
    let response = handle.send_request("session/set_model", params).await?;

    if let Some(ref err) = response.error {
        return Err(Error::Protocol(format!(
            "setModel failed: code={}, message={}",
            err.code, err.message
        )));
    }

    state.update_session_model(&session_id, &model_id).await?;

    tracing::info!(session_id = %session_id, model_id = %model_id, "Model changed");

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_claude_code_acp_models() {
        // Verified format from DeepWiki: claude-code-acp getAvailableModels()
        // maps ModelInfo { value, displayName, description } to
        // { modelId: value, name: displayName, description }
        let models_obj = serde_json::json!({
            "availableModels": [
                {
                    "modelId": "claude-sonnet-4-20250514",
                    "name": "Claude Sonnet 4",
                    "description": "Fast and efficient"
                },
                {
                    "modelId": "claude-opus-4-20250514",
                    "name": "Claude Opus 4",
                    "description": "Most capable"
                }
            ],
            "currentModelId": "claude-sonnet-4-20250514"
        });

        let result = parse_available_models(Some(&models_obj));
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].id, "claude-sonnet-4-20250514");
        assert_eq!(result[0].name, "Claude Sonnet 4");
        assert_eq!(result[0].description.as_deref(), Some("Fast and efficient"));
        assert_eq!(result[1].id, "claude-opus-4-20250514");
        assert_eq!(result[1].name, "Claude Opus 4");
    }

    #[test]
    fn parse_codex_acp_models() {
        // codex-acp uses snake_case field names
        let models_obj = serde_json::json!({
            "available_models": [
                {
                    "model_id": "codex-mini-latest",
                    "name": "Codex Mini",
                    "description": "Lightweight model"
                }
            ],
            "current_model_id": "codex-mini-latest"
        });

        let result = parse_available_models(Some(&models_obj));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "codex-mini-latest");
        assert_eq!(result[0].name, "Codex Mini");
    }

    #[test]
    fn parse_models_with_null_description() {
        let models_obj = serde_json::json!({
            "availableModels": [
                {
                    "modelId": "claude-sonnet-4-20250514",
                    "name": "Claude Sonnet 4",
                    "description": null
                }
            ],
            "currentModelId": "claude-sonnet-4-20250514"
        });

        let result = parse_available_models(Some(&models_obj));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "claude-sonnet-4-20250514");
        assert!(result[0].description.is_none());
    }

    #[test]
    fn parse_models_with_missing_description() {
        let models_obj = serde_json::json!({
            "availableModels": [
                {
                    "modelId": "claude-sonnet-4-20250514",
                    "name": "Claude Sonnet 4"
                }
            ],
            "currentModelId": "claude-sonnet-4-20250514"
        });

        let result = parse_available_models(Some(&models_obj));
        assert_eq!(result.len(), 1);
        assert!(result[0].description.is_none());
    }

    #[test]
    fn parse_models_returns_empty_for_none() {
        let result = parse_available_models(None);
        assert!(result.is_empty());
    }

    #[test]
    fn parse_models_returns_empty_for_missing_array() {
        // models object exists but has no availableModels or available_models
        let models_obj = serde_json::json!({
            "currentModelId": "claude-sonnet-4-20250514"
        });

        let result = parse_available_models(Some(&models_obj));
        assert!(result.is_empty());
    }

    #[test]
    fn parse_models_returns_empty_for_empty_array() {
        let models_obj = serde_json::json!({
            "availableModels": [],
            "currentModelId": "claude-sonnet-4-20250514"
        });

        let result = parse_available_models(Some(&models_obj));
        assert!(result.is_empty());
    }

    #[test]
    fn parse_models_skips_entries_without_model_id() {
        let models_obj = serde_json::json!({
            "availableModels": [
                { "name": "No ID Model", "description": "Missing modelId" },
                { "modelId": "valid-model", "name": "Valid" }
            ]
        });

        let result = parse_available_models(Some(&models_obj));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "valid-model");
    }

    #[test]
    fn parse_models_uses_id_as_name_fallback() {
        let models_obj = serde_json::json!({
            "availableModels": [
                { "modelId": "claude-sonnet-4-20250514" }
            ]
        });

        let result = parse_available_models(Some(&models_obj));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "claude-sonnet-4-20250514");
    }
}
