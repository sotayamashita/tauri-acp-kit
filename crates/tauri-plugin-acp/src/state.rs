use crate::error::Error;
use crate::process::{AgentHandle, AgentProcess};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AcpModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Clone)]
pub struct Session {
    pub id: String,
    pub agent_id: String,
    pub cwd: String,
    pub model: String,
    pub available_models: Vec<AcpModelInfo>,
    pub current_model_id: Option<String>,
}

pub struct PluginState {
    agents: Arc<RwLock<HashMap<String, AgentProcess>>>,
    agent_handles: Arc<RwLock<HashMap<String, AgentHandle>>>,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}

impl Default for PluginState {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginState {
    pub fn new() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            agent_handles: Arc::new(RwLock::new(HashMap::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_agent(&self, agent: AgentProcess) {
        let handle = agent.handle();
        let agent_id = agent.id.clone();

        let mut agents = self.agents.write().await;
        agents.insert(agent_id.clone(), agent);

        let mut handles = self.agent_handles.write().await;
        handles.insert(agent_id, handle);
    }

    pub async fn get_agent_handle(&self, agent_id: &str) -> Result<AgentHandle, Error> {
        let handles = self.agent_handles.read().await;
        handles
            .get(agent_id)
            .cloned()
            .ok_or_else(|| Error::AgentNotFound(agent_id.to_string()))
    }

    pub async fn remove_agent(&self, agent_id: &str) -> Option<AgentProcess> {
        let mut handles = self.agent_handles.write().await;
        handles.remove(agent_id);

        let mut agents = self.agents.write().await;
        agents.remove(agent_id)
    }

    pub async fn add_session(&self, session: Session) {
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id.clone(), session);
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Session, Error> {
        let sessions = self.sessions.read().await;
        sessions
            .get(session_id)
            .cloned()
            .ok_or_else(|| Error::SessionNotFound(session_id.to_string()))
    }

    pub async fn update_session_model(
        &self,
        session_id: &str,
        model_id: &str,
    ) -> Result<(), Error> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| Error::SessionNotFound(session_id.to_string()))?;
        session.current_model_id = Some(model_id.to_string());
        session.model = model_id.to_string();
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn remove_session(&self, session_id: &str) -> Option<Session> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(session_id)
    }
}
