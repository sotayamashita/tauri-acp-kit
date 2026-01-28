use crate::error::Error;
use crate::protocol::JsonRpcMessage;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

pub struct JsonlReader<R> {
    reader: BufReader<R>,
}

impl<R: tokio::io::AsyncRead + Unpin> JsonlReader<R> {
    pub fn new(reader: R) -> Self {
        Self {
            reader: BufReader::new(reader),
        }
    }

    pub async fn read_message(&mut self) -> Result<Option<JsonRpcMessage>, Error> {
        loop {
            let mut line = String::new();
            let bytes_read = self.reader.read_line(&mut line).await?;

            if bytes_read == 0 {
                return Ok(None);
            }

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let message: JsonRpcMessage = serde_json::from_str(trimmed)?;
            return Ok(Some(message));
        }
    }
}

pub struct JsonlWriter<W> {
    writer: W,
}

impl<W: tokio::io::AsyncWrite + Unpin> JsonlWriter<W> {
    pub fn new(writer: W) -> Self {
        Self { writer }
    }

    pub async fn write_message(&mut self, message: &impl serde::Serialize) -> Result<(), Error> {
        let json = serde_json::to_string(message)?;
        self.writer.write_all(json.as_bytes()).await?;
        self.writer.write_all(b"\n").await?;
        self.writer.flush().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::JsonRpcRequest;

    #[tokio::test]
    async fn test_jsonl_roundtrip() {
        let request = JsonRpcRequest::new(1, "test", serde_json::json!({"key": "value"}));

        let mut buffer = Vec::new();
        {
            let mut writer = JsonlWriter::new(&mut buffer);
            writer.write_message(&request).await.unwrap();
        }

        let mut reader = JsonlReader::new(buffer.as_slice());
        let message = reader.read_message().await.unwrap().unwrap();

        match message {
            JsonRpcMessage::Request(req) => {
                assert_eq!(req.method, "test");
            }
            _ => panic!("Expected request"),
        }
    }

    #[tokio::test]
    async fn test_parse_codex_response_without_jsonrpc() {
        // Codex app-server returns responses without the jsonrpc field
        let codex_response = r#"{"id":1,"result":{"userAgent":"codex/0.91.0"}}"#;

        let mut reader = JsonlReader::new(codex_response.as_bytes());
        let message = reader.read_message().await.unwrap().unwrap();

        match message {
            JsonRpcMessage::Response(resp) => {
                assert!(resp.jsonrpc.is_none());
                assert!(resp.result.is_some());
                assert!(resp.error.is_none());
            }
            _ => panic!("Expected response, got {:?}", message),
        }
    }

    #[tokio::test]
    async fn test_parse_response_with_jsonrpc() {
        // Standard JSON-RPC 2.0 response
        let standard_response = r#"{"jsonrpc":"2.0","id":1,"result":{"status":"ok"}}"#;

        let mut reader = JsonlReader::new(standard_response.as_bytes());
        let message = reader.read_message().await.unwrap().unwrap();

        match message {
            JsonRpcMessage::Response(resp) => {
                assert_eq!(resp.jsonrpc, Some("2.0".to_string()));
                assert!(resp.result.is_some());
            }
            _ => panic!("Expected response"),
        }
    }
}
