use crate::agent_download::{AgentStatus, ResolvedAgent};
use crate::agent_registry::AgentRegistryEntry;
use crate::error::Error;
use crate::events::{emit_event, AcpEvent};
use crate::process::AgentProcess;
use crate::protocol::{AgentSpec, JsonRpcResponse};
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

/// Parsed fields from a session/new response
struct ParsedSession {
    session_id: String,
    available_models: Vec<AcpModelInfo>,
    current_model_id: Option<String>,
    model: String,
}

/// Check a JSON-RPC response for errors, returning a descriptive `Error::Protocol` if present.
fn check_response(response: &JsonRpcResponse, context: &str) -> Result<(), Error> {
    if let Some(ref err) = response.error {
        let data_str = err
            .data
            .as_ref()
            .map(|d| format!(" data={}", d))
            .unwrap_or_default();
        return Err(Error::Protocol(format!(
            "{} failed: code={}, message={}{}",
            context, err.code, err.message, data_str
        )));
    }
    Ok(())
}

/// Resolve a cwd path to an absolute path.
///
/// codex-acp requires an absolute `cwd` in `session/new`. If the given path
/// is already absolute it is returned as-is; otherwise it is joined with
/// `std::env::current_dir()`.
fn resolve_absolute_cwd(cwd: &str) -> String {
    let p = std::path::Path::new(cwd);
    if p.is_absolute() {
        cwd.to_string()
    } else {
        std::env::current_dir()
            .map(|base| {
                let joined = base.join(p);
                // Normalize away `.` and `..` components without touching the filesystem.
                // std::fs::canonicalize is not used because it requires the path to exist.
                let mut components = Vec::new();
                for c in joined.components() {
                    match c {
                        std::path::Component::CurDir => {}
                        std::path::Component::ParentDir => {
                            components.pop();
                        }
                        other => components.push(other),
                    }
                }
                let normalized: std::path::PathBuf = components.iter().collect();
                normalized.to_string_lossy().into_owned()
            })
            .unwrap_or_else(|_| cwd.to_string())
    }
}

/// Parse session ID, models, and current model from a session/new result.
fn parse_session_response(result: Option<&serde_json::Value>) -> ParsedSession {
    // Extract session ID
    let returned_session_id = result
        .and_then(|r| r.get("sessionId"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let session_id = if returned_session_id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        returned_session_id.to_string()
    };

    // Extract models
    // claude-code-acp: { models: { availableModels: [{modelId, name, description}], currentModelId } }
    // codex-acp: { models: { available_models: [{model_id, name, description}], current_model_id } }
    let models_obj = result.and_then(|r| r.get("models"));
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

    ParsedSession {
        session_id,
        available_models,
        current_model_id,
        model,
    }
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

    // Resolve executable: try download manager first, then fall back to PATH
    let resolved_spec = resolve_agent_spec(&app, &state, spec).await;

    let agent = AgentProcess::spawn(app.clone(), resolved_spec, agent_id.clone()).await?;
    state.add_agent(agent).await;

    emit_event(
        &app,
        AcpEvent::AgentSpawned {
            agent_id: agent_id.clone(),
        },
    );

    Ok(agent_id)
}

/// Resolve an AgentSpec by checking the download manager for a managed binary.
///
/// If the executable is an absolute path, use it as-is.
/// If the agent is in the registry and managed, use the resolved path.
/// Otherwise, fall back to the original spec (PATH lookup).
async fn resolve_agent_spec<R: Runtime>(
    app: &AppHandle<R>,
    state: &State<'_, PluginState>,
    spec: AgentSpec,
) -> AgentSpec {
    // Absolute paths are used as-is (custom override)
    if std::path::Path::new(&spec.executable).is_absolute() {
        return spec;
    }

    // Try to resolve from download manager
    let registry = state.get_registry().await;
    let entry = match registry.iter().find(|e| e.id == spec.id) {
        Some(e) => e,
        None => return spec, // Not in registry, use PATH
    };

    let dm_guard = match state.get_download_manager().await {
        Ok(guard) => guard,
        Err(_) => return spec, // No download manager, use PATH
    };

    let manager = match dm_guard.as_ref() {
        Some(m) => m,
        None => return spec,
    };

    match manager.resolve_executable(app, entry).await {
        Ok(resolved) => {
            tracing::info!(
                spec_id = %spec.id,
                executable = %resolved.executable,
                version = %resolved.version,
                "Resolved agent from download manager"
            );
            AgentSpec {
                executable: resolved.executable,
                args: if resolved.args.is_empty() {
                    spec.args
                } else {
                    let mut args = resolved.args;
                    args.extend(spec.args);
                    args
                },
                ..spec
            }
        }
        Err(e) => {
            tracing::warn!(
                spec_id = %spec.id,
                error = %e,
                "Download manager resolution failed, falling back to PATH"
            );
            spec
        }
    }
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
    check_response(&response, "initialize")?;
    tracing::debug!("Initialize response: {:?}", response);

    // ACP: Authenticate if the agent advertises auth methods (e.g., codex-acp).
    // Agents like claude-code-acp that don't require auth won't include authMethods.
    // For users with stored credentials (e.g., `codex login`), authenticate loads
    // them without prompting — the check_auth() guard in session/new requires this step.
    if let Some(ref init_result) = response.result {
        let auth_methods = init_result
            .get("authMethods")
            .or_else(|| init_result.get("auth_methods"))
            .and_then(|v| v.as_array());

        if let Some(methods) = auth_methods {
            if let Some(first_method) = methods.first() {
                let method_id = first_method
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("chatgpt");

                tracing::info!(method_id = %method_id, "Authenticating with agent");

                let auth_params = serde_json::json!({
                    "methodId": method_id
                });
                let auth_response = handle.send_request("authenticate", auth_params).await?;
                check_response(&auth_response, "authenticate")?;
                tracing::info!("Authentication successful");
            }
        }
    }

    // ACP: session/new creates a new session
    // codex-acp requires an absolute cwd path; resolve relative paths here.
    let abs_cwd = resolve_absolute_cwd(&cwd);

    let session_params = serde_json::json!({
        "cwd": abs_cwd,
        "mcpServers": []
    });

    let session_response = handle.send_request("session/new", session_params).await?;
    check_response(&session_response, "session/new")?;

    // Log raw response JSON for debugging model parsing issues
    if let Some(ref result_val) = session_response.result {
        tracing::info!(
            "session/new result: {}",
            serde_json::to_string(result_val).unwrap_or_else(|_| "<serialize error>".into())
        );
    } else {
        tracing::warn!("session/new returned no result field");
    }

    let parsed = parse_session_response(session_response.result.as_ref());

    tracing::info!(
        session_id = %parsed.session_id,
        model = %parsed.model,
        models_count = parsed.available_models.len(),
        model_ids = ?parsed.available_models.iter().map(|m| &m.id).collect::<Vec<_>>(),
        "Session created"
    );

    let session = Session {
        id: parsed.session_id.clone(),
        agent_id: agent_id.clone(),
        cwd,
        model: parsed.model,
        available_models: parsed.available_models.clone(),
        current_model_id: parsed.current_model_id.clone(),
    };

    state.add_session(session).await;

    emit_event(
        &app,
        AcpEvent::SessionReady {
            session_id: parsed.session_id.clone(),
            agent_id,
        },
    );

    Ok(SessionInfoResponse {
        session_id: parsed.session_id,
        models: parsed.available_models,
        current_model_id: parsed.current_model_id,
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
    check_response(&response, "session/set_model")?;

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

    let exit_code = agent.terminate().await?;

    emit_event(
        &app,
        AcpEvent::AgentTerminated {
            agent_id,
            exit_code,
        },
    );

    Ok(())
}

/// Check if an executable is available on the system PATH.
///
/// Uses `which` on Unix or `where` on Windows to locate the binary.
pub(crate) async fn check_executable_on_path(executable: &str) -> bool {
    let which_cmd = if cfg!(windows) { "where" } else { "which" };
    let output = tokio::process::Command::new(which_cmd)
        .arg(executable)
        .output()
        .await;
    output.map(|o| o.status.success()).unwrap_or(false)
}

#[tauri::command]
pub async fn acp_check_agent_available(executable: String) -> Result<bool, Error> {
    Ok(check_executable_on_path(&executable).await)
}

/// Check if an agent is downloaded/installed in the managed directory.
#[tauri::command]
pub async fn acp_check_agent(
    state: State<'_, PluginState>,
    agent_id: String,
) -> Result<AgentStatus, Error> {
    let guard = state.get_download_manager().await?;
    let manager = guard.as_ref().unwrap();
    let registry = state.get_registry().await;

    let entry = registry
        .iter()
        .find(|e| e.id == agent_id)
        .ok_or_else(|| Error::AgentNotFound(agent_id))?;

    Ok(manager.check_status(entry))
}

/// Download/install an agent binary.
#[tauri::command]
pub async fn acp_download_agent<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, PluginState>,
    agent_id: String,
) -> Result<ResolvedAgent, Error> {
    let guard = state.get_download_manager().await?;
    let manager = guard.as_ref().unwrap();
    let registry = state.get_registry().await;

    let entry = registry
        .iter()
        .find(|e| e.id == agent_id)
        .ok_or_else(|| Error::AgentNotFound(agent_id))?;

    let resolved = manager.resolve_executable(&app, entry).await?;
    Ok(resolved)
}

/// Get the agent registry.
#[tauri::command]
pub async fn acp_get_agent_registry(
    state: State<'_, PluginState>,
) -> Result<Vec<AgentRegistryEntry>, Error> {
    Ok(state.get_registry().await)
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

    #[test]
    fn check_response_ok_on_success() {
        let response = JsonRpcResponse {
            jsonrpc: Some("2.0".to_string()),
            id: crate::protocol::JsonRpcId::Number(1),
            result: Some(serde_json::json!({"status": "ok"})),
            error: None,
        };
        assert!(check_response(&response, "test").is_ok());
    }

    #[test]
    fn check_response_err_on_error() {
        let response = JsonRpcResponse {
            jsonrpc: Some("2.0".to_string()),
            id: crate::protocol::JsonRpcId::Number(1),
            result: None,
            error: Some(crate::protocol::JsonRpcError {
                code: -32600,
                message: "Invalid request".to_string(),
                data: None,
            }),
        };
        let err = check_response(&response, "initialize").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("initialize failed"));
        assert!(msg.contains("-32600"));
        assert!(msg.contains("Invalid request"));
    }

    #[test]
    fn check_response_includes_data_field() {
        let response = JsonRpcResponse {
            jsonrpc: Some("2.0".to_string()),
            id: crate::protocol::JsonRpcId::Number(1),
            result: None,
            error: Some(crate::protocol::JsonRpcError {
                code: -32603,
                message: "Internal error".to_string(),
                data: Some(serde_json::json!("session init failed")),
            }),
        };
        let err = check_response(&response, "session/new").unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("session/new failed"));
        assert!(msg.contains("-32603"));
        assert!(msg.contains("session init failed"));
    }

    #[test]
    fn parse_session_response_complete_data() {
        let result = serde_json::json!({
            "sessionId": "sess-abc",
            "models": {
                "availableModels": [
                    { "modelId": "claude-sonnet-4-20250514", "name": "Sonnet 4" }
                ],
                "currentModelId": "claude-sonnet-4-20250514"
            }
        });

        let parsed = parse_session_response(Some(&result));
        assert_eq!(parsed.session_id, "sess-abc");
        assert_eq!(parsed.available_models.len(), 1);
        assert_eq!(
            parsed.current_model_id.as_deref(),
            Some("claude-sonnet-4-20250514")
        );
        assert_eq!(parsed.model, "claude-sonnet-4-20250514");
    }

    #[test]
    fn parse_session_response_missing_session_id_generates_uuid() {
        let result = serde_json::json!({
            "models": { "availableModels": [] }
        });

        let parsed = parse_session_response(Some(&result));
        assert!(!parsed.session_id.is_empty());
        // Should be a valid UUID
        assert!(uuid::Uuid::parse_str(&parsed.session_id).is_ok());
    }

    #[test]
    fn parse_session_response_none_result() {
        let parsed = parse_session_response(None);
        assert!(uuid::Uuid::parse_str(&parsed.session_id).is_ok());
        assert!(parsed.available_models.is_empty());
        assert!(parsed.current_model_id.is_none());
        assert_eq!(parsed.model, "claude");
    }

    #[test]
    fn parse_session_response_defaults_model_to_first_available() {
        let result = serde_json::json!({
            "sessionId": "s1",
            "models": {
                "availableModels": [
                    { "modelId": "first-model", "name": "First" },
                    { "modelId": "second-model", "name": "Second" }
                ]
            }
        });

        let parsed = parse_session_response(Some(&result));
        // No currentModelId, so model defaults to first available
        assert_eq!(parsed.model, "first-model");
        assert!(parsed.current_model_id.is_none());
    }

    #[test]
    fn parse_session_response_defaults_model_to_claude() {
        let result = serde_json::json!({
            "sessionId": "s1"
        });

        let parsed = parse_session_response(Some(&result));
        // No models at all, defaults to "claude"
        assert_eq!(parsed.model, "claude");
    }

    #[tokio::test]
    async fn check_executable_on_path_finds_existing_binary() {
        // "ls" is available on all Unix systems
        let result = check_executable_on_path("ls").await;
        assert!(result);
    }

    #[tokio::test]
    async fn check_executable_on_path_returns_false_for_nonexistent() {
        let result =
            check_executable_on_path("this-binary-definitely-does-not-exist-xyz123").await;
        assert!(!result);
    }

    #[test]
    fn resolve_absolute_cwd_returns_absolute_as_is() {
        let result = resolve_absolute_cwd("/home/user/project");
        assert_eq!(result, "/home/user/project");
    }

    #[test]
    fn resolve_absolute_cwd_resolves_relative_dot() {
        let result = resolve_absolute_cwd(".");
        let expected = std::env::current_dir().unwrap();
        assert_eq!(result, expected.to_string_lossy());
    }

    #[test]
    fn resolve_absolute_cwd_resolves_relative_subdir() {
        let result = resolve_absolute_cwd("src");
        let expected = std::env::current_dir().unwrap().join("src");
        assert_eq!(result, expected.to_string_lossy());
    }
}
