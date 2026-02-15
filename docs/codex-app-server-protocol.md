# ACP (Agent Client Protocol) v1

This document describes the ACP v1 JSON-RPC protocol used for GUI client integration with ACP-compatible agents.

## What is ACP?

ACP (Agent Client Protocol) is a JSON-RPC 2.0 based protocol for communication between GUI clients and coding assistance agents. It runs over stdio (stdin/stdout) using JSON Lines (JSONL) framing.

Both `codex-acp` and `claude-code-acp` implement ACP v1, so a single client implementation can support multiple agents.

### Transport

- **Format**: JSON Lines (JSONL) - one JSON object per line
- **Transport**: stdio (stdin for requests, stdout for responses/notifications)
- **Encoding**: UTF-8

### Message Types

1. **Request** (client → server): Has `id`, expects response
2. **Response** (server → client): Has matching `id`
3. **Notification** (bidirectional): No `id`, fire-and-forget

## Client Request Methods

### initialize

Handshake to establish protocol version and client capabilities.

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": 1,
        "clientCapabilities": {}
      }
    }

**Response:**

    {
      "jsonrpc": "2.0",
      "id": 1,
      "result": {
        "serverInfo": { "name": "claude-code-acp", "version": "0.16.0" }
      }
    }

**Note:** Unlike the Codex app-server protocol, ACP does NOT require a separate `initialized` notification after the handshake. The `initialize` response itself completes the handshake.

### session/new

Create a new session. The `mcpServers` field is required (pass `[]` if none).

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 2,
      "method": "session/new",
      "params": {
        "cwd": "/path/to/project",
        "mcpServers": []
      }
    }

**Response:**

    {
      "jsonrpc": "2.0",
      "id": 2,
      "result": {
        "sessionId": "sess_abc123",
        "models": [
          { "value": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4" }
        ],
        "modes": ["agent", "chat"]
      }
    }

The `sessionId` is used in all subsequent session-scoped requests. The `models` array provides available model options.

### session/prompt

Send a prompt to the agent. Streaming text arrives via `session/update` notifications. The response itself signals completion (ACP does NOT send a separate `turn/completed` notification).

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 3,
      "method": "session/prompt",
      "params": {
        "sessionId": "sess_abc123",
        "prompt": [
          {
            "type": "text",
            "text": "Hello, how are you?"
          }
        ]
      }
    }

**Important:** The field name is `prompt` (not `input`). `claude-code-acp`'s `promptToClaude()` reads `params.prompt` to build the content array.

**Response** (sent after the agent finishes):

    {
      "jsonrpc": "2.0",
      "id": 3,
      "result": {}
    }

### session/cancel

Cancel an ongoing generation. This is a **notification** (fire-and-forget), not a request.

**Notification (client → server, no `id`):**

    {
      "jsonrpc": "2.0",
      "method": "session/cancel",
      "params": {
        "sessionId": "sess_abc123"
      }
    }

### session/update

Not a client method — see Server Notifications below.

## Server Notifications

### session/update

Streaming updates from the agent during prompt processing.

**agent_message_chunk** — streaming text fragment:

    {
      "jsonrpc": "2.0",
      "method": "session/update",
      "params": {
        "sessionId": "sess_abc123",
        "update": {
          "sessionUpdate": "agent_message_chunk",
          "content": {
            "type": "text",
            "text": "Hello! I'm doing well."
          }
        }
      }
    }

Other `sessionUpdate` types may include tool use, file changes, etc. Clients should handle unknown types gracefully.

## Error Handling

Errors are returned in the standard JSON-RPC error format:

    {
      "jsonrpc": "2.0",
      "id": 3,
      "error": {
        "code": -32600,
        "message": "Invalid request",
        "data": null
      }
    }

Common error codes:

- `-32600`: Invalid request (missing/malformed params)
- `-32601`: Method not found
- `-32602`: Invalid params

## Key Differences from Codex App-Server Protocol

| Aspect               | Codex app-server                       | ACP v1                                      |
| -------------------- | -------------------------------------- | ------------------------------------------- |
| Initialize params    | `clientInfo`, `workingDirectory`       | `protocolVersion`, `clientCapabilities`     |
| Handshake completion | Requires `initialized` notification    | `initialize` response completes handshake   |
| Create session       | `thread/start` → `result.thread.id`    | `session/new` → `result.sessionId`          |
| Send prompt          | `turn/start` with `threadId`, `input`  | `session/prompt` with `sessionId`, `prompt` |
| Streaming delta      | `item/agentMessage/delta` notification | `session/update` notification               |
| Completion signal    | `turn/completed` notification          | `session/prompt` response                   |
| Cancel               | `interruptConversation` request        | `session/cancel` notification               |

## Compatible Agents

| Agent           | Package           | Notes                              |
| --------------- | ----------------- | ---------------------------------- |
| claude-code-acp | `claude-code-acp` | Anthropic's Claude Code ACP bridge |
| codex-acp       | `codex-acp`       | OpenAI Codex ACP bridge            |

Both implement ACP v1 and can be used interchangeably with this protocol.

## Version History

- 2026-02-15: Rewritten for ACP v1 protocol (replaces Codex app-server documentation)
- 2026-01-28: Initial documentation based on Codex app-server protocol
