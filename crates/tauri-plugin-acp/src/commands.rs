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

    tracing::debug!("Initialize response: {:?}", response);

    // CRITICAL: Send 'initialized' notification after receiving initialize response
    // This completes the handshake and enables subsequent requests to work properly
    // See: openai/codex MessageProcessor requires this notification before processing other requests
    handle
        .send_notification("initialized", serde_json::json!({}))
        .await?;
    tracing::info!("Sent 'initialized' notification to complete handshake");

    // CRITICAL: Use thread/start instead of newConversation
    // thread/start creates a thread and properly initializes the AI session
    // newConversation alone does NOT trigger AI responses on turn/start
    let thread_params = serde_json::json!({
        "cwd": cwd
    });

    let thread_response = handle.send_request("thread/start", thread_params).await?;

    if thread_response.error.is_some() {
        return Err(Error::Protocol(format!(
            "thread/start failed: {:?}",
            thread_response.error
        )));
    }

    tracing::debug!("thread/start response: {:?}", thread_response);

    // Extract thread ID and model from response
    // Response format: { "result": { "thread": { "id": "...", "modelProvider": "..." } } }
    let result = thread_response.result.as_ref();

    let thread_id = result
        .and_then(|r| r.get("thread"))
        .and_then(|t| t.get("id"))
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| {
            tracing::warn!("No thread.id in response, using generated UUID");
            ""
        });

    let model_provider = result
        .and_then(|r| r.get("thread"))
        .and_then(|t| t.get("modelProvider"))
        .and_then(|v| v.as_str())
        .unwrap_or("openai")
        .to_string();

    tracing::info!(thread_id = %thread_id, model_provider = %model_provider, "Thread started");

    let session_id = if thread_id.is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        thread_id.to_string()
    };

    let session = Session {
        id: session_id.clone(),
        agent_id: agent_id.clone(),
        cwd,
        model: model_provider,
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
    _app: AppHandle<R>,
    state: State<'_, PluginState>,
    session_id: String,
    prompt: String,
) -> Result<String, Error> {
    let session = state.get_session(&session_id).await?;
    let handle = state.get_agent_handle(&session.agent_id).await?;
    let request_id = uuid::Uuid::new_v4().to_string();

    // Codex v2 protocol: turn/start with threadId and input array
    // Input format: {"type": "text", "text": "..."} (simpler than v1's InputItem)
    let prompt_params = serde_json::json!({
        "threadId": session_id,
        "input": [{
            "type": "text",
            "text": prompt
        }]
    });

    tracing::debug!(
        session_id = %session_id,
        model = %session.model,
        "Starting turn with v2 protocol"
    );

    // Spawn task to send prompt (don't block, streaming via events)
    let request_id_clone = request_id.clone();
    tokio::spawn(async move {
        match handle.send_request("turn/start", prompt_params).await {
            Ok(response) => {
                tracing::debug!(request_id = %request_id_clone, "Turn response received: {:?}", response);
            }
            Err(e) => {
                tracing::error!(request_id = %request_id_clone, "Turn request failed: {}", e);
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

    // Codex uses interruptConversation method
    let cancel_params = serde_json::json!({
        "conversationId": session_id
    });

    handle
        .send_request("interruptConversation", cancel_params)
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
