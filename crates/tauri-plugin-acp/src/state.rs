use crate::error::Error;
use crate::process::{AgentHandle, AgentProcess};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AcpModelInfo {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
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
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_agent(&self, agent: AgentProcess) {
        let agent_id = agent.id.clone();
        let mut agents = self.agents.write().await;
        agents.insert(agent_id, agent);
    }

    pub async fn get_agent_handle(&self, agent_id: &str) -> Result<AgentHandle, Error> {
        let agents = self.agents.read().await;
        agents
            .get(agent_id)
            .map(|a| a.handle())
            .ok_or_else(|| Error::AgentNotFound(agent_id.to_string()))
    }

    pub async fn remove_agent(&self, agent_id: &str) -> Option<AgentProcess> {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_session(id: &str) -> Session {
        Session {
            id: id.to_string(),
            agent_id: "agent-1".to_string(),
            cwd: "/tmp".to_string(),
            model: "claude".to_string(),
            available_models: vec![],
            current_model_id: None,
        }
    }

    #[tokio::test]
    async fn get_session_not_found() {
        let state = PluginState::new();
        let err = state.get_session("nonexistent").await.unwrap_err();
        assert!(err.to_string().contains("nonexistent"));
    }

    #[tokio::test]
    async fn get_agent_handle_not_found() {
        let state = PluginState::new();
        let err = state.get_agent_handle("nonexistent").await.unwrap_err();
        assert!(err.to_string().contains("nonexistent"));
    }

    #[tokio::test]
    async fn add_and_get_session_roundtrip() {
        let state = PluginState::new();
        state.add_session(make_session("s1")).await;

        let session = state.get_session("s1").await.unwrap();
        assert_eq!(session.id, "s1");
        assert_eq!(session.agent_id, "agent-1");
        assert_eq!(session.model, "claude");
    }

    #[tokio::test]
    async fn update_session_model_updates_both_fields() {
        let state = PluginState::new();
        state.add_session(make_session("s1")).await;

        state.update_session_model("s1", "new-model").await.unwrap();

        let session = state.get_session("s1").await.unwrap();
        assert_eq!(session.model, "new-model");
        assert_eq!(session.current_model_id.as_deref(), Some("new-model"));
    }

    #[tokio::test]
    async fn update_session_model_not_found() {
        let state = PluginState::new();
        let err = state
            .update_session_model("nonexistent", "model")
            .await
            .unwrap_err();
        assert!(err.to_string().contains("nonexistent"));
    }

    #[tokio::test]
    async fn remove_session_returns_session() {
        let state = PluginState::new();
        state.add_session(make_session("s1")).await;

        let removed = state.remove_session("s1").await;
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().id, "s1");

        // Should be gone now
        assert!(state.get_session("s1").await.is_err());
    }

    #[tokio::test]
    async fn remove_session_returns_none_for_missing() {
        let state = PluginState::new();
        assert!(state.remove_session("nonexistent").await.is_none());
    }
}
