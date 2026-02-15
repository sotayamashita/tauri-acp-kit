use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSpec {
    pub id: String,
    pub executable: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JsonRpcId {
    Number(i64),
    String(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: JsonRpcId,
    pub method: String,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    /// Optional for compatibility with servers that don't include the jsonrpc field
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub jsonrpc: Option<String>,
    pub id: JsonRpcId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    /// Optional for compatibility with servers that don't include the jsonrpc field
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub jsonrpc: Option<String>,
    pub method: String,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JsonRpcMessage {
    Request(JsonRpcRequest),
    Response(JsonRpcResponse),
    Notification(JsonRpcNotification),
}

impl JsonRpcId {
    pub fn as_i64(&self) -> i64 {
        match self {
            JsonRpcId::Number(n) => *n,
            JsonRpcId::String(s) => s.parse().unwrap_or(0),
        }
    }
}

impl JsonRpcRequest {
    pub fn new(id: i64, method: &str, params: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: JsonRpcId::Number(id),
            method: method.to_string(),
            params,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_rpc_id_as_i64_number() {
        let id = JsonRpcId::Number(42);
        assert_eq!(id.as_i64(), 42);
    }

    #[test]
    fn json_rpc_id_as_i64_string_valid() {
        let id = JsonRpcId::String("7".to_string());
        assert_eq!(id.as_i64(), 7);
    }

    #[test]
    fn json_rpc_id_as_i64_string_invalid() {
        let id = JsonRpcId::String("not-a-number".to_string());
        assert_eq!(id.as_i64(), 0);
    }

    #[test]
    fn json_rpc_request_new_sets_fields() {
        let req = JsonRpcRequest::new(5, "test/method", serde_json::json!({"key": "val"}));
        assert_eq!(req.jsonrpc, "2.0");
        assert_eq!(req.id.as_i64(), 5);
        assert_eq!(req.method, "test/method");
        assert_eq!(req.params["key"], "val");
    }

    #[test]
    fn deserialize_response_without_jsonrpc() {
        let json = r#"{"id":1,"result":{"status":"ok"}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(json).unwrap();
        assert!(resp.jsonrpc.is_none());
        assert!(resp.result.is_some());
        assert!(resp.error.is_none());
    }

    #[test]
    fn deserialize_error_response_with_data() {
        let json = r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Invalid","data":"details"}}"#;
        let resp: JsonRpcResponse = serde_json::from_str(json).unwrap();
        let err = resp.error.unwrap();
        assert_eq!(err.code, -32600);
        assert_eq!(err.message, "Invalid");
        assert_eq!(err.data.unwrap(), "details");
    }

    #[test]
    fn deserialize_notification_without_jsonrpc() {
        let json = r#"{"method":"session/update","params":{"sessionId":"s1"}}"#;
        let notif: JsonRpcNotification = serde_json::from_str(json).unwrap();
        assert!(notif.jsonrpc.is_none());
        assert_eq!(notif.method, "session/update");
    }
}
