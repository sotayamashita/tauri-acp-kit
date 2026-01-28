# Codex App Server Protocol

This document describes the JSON-RPC protocol used by Codex's `app-server` mode for GUI client integration.

## What is this?

Codex app-server is a JSON-RPC 2.0 based server that runs as a child process, communicating via stdio (stdin/stdout). It enables GUI applications to integrate with Codex for AI-assisted coding capabilities.

The protocol supports:

- Session/conversation management
- Streaming text responses (delta notifications)
- Tool execution approval flows
- File change requests
- Command execution

## How to obtain the schema

The JSON Schema files can be extracted from the Codex source code or generated from its TypeScript/Rust type definitions.

### Method 1: From Codex source (if available)

    # Clone the Codex repository
    git clone <codex-repo-url>
    cd codex

    # Look for schema generation scripts or type definitions
    find . -name "*.schema.json" -o -name "*schema*.ts"

### Method 2: Runtime extraction

If you have access to Codex internals, schemas may be exported via a command:

    codex --export-schema > codex-schema.json

### Current schema location

For this project, schemas were obtained and placed at:

    /tmp/codex-schema/

Key files:

- `ClientRequest.json` - All request methods the client can send
- `ServerNotification.json` - All notifications the server can emit
- `codex_app_server_protocol.schemas.json` - Combined schema (395KB)

## Protocol Overview

### Protocol Versions

Codex app-server supports two protocol versions:

| Aspect            | v1 (Legacy)                                 | v2 (Recommended)                  |
| ----------------- | ------------------------------------------- | --------------------------------- |
| Start turn        | `sendUserTurn`                              | `turn/start`                      |
| Thread ID field   | `conversationId`                            | `threadId`                        |
| Input field       | `items`                                     | `input`                           |
| Input item format | `{"type": "text", "data": {"text": "..."}}` | `{"type": "text", "text": "..."}` |
| Cancel            | `interruptConversation`                     | `turn/interrupt`                  |

This document primarily covers v2 protocol, with v1 noted for compatibility.

### Transport

- **Format**: JSON Lines (JSONL) - one JSON object per line
- **Transport**: stdio (stdin for requests, stdout for responses/notifications)
- **Encoding**: UTF-8

### Message Types

1. **Request** (client → server): Has `id`, expects response
2. **Response** (server → client): Has matching `id`
3. **Notification** (server → client): No `id`, fire-and-forget

### Important: Codex omits `jsonrpc` field

Unlike standard JSON-RPC 2.0, Codex responses and notifications may omit the `"jsonrpc": "2.0"` field:

    // Standard JSON-RPC 2.0
    {"jsonrpc": "2.0", "id": 1, "result": {...}}

    // Codex actual response
    {"id": 1, "result": {...}}

Clients must handle both formats.

## Client Request Methods

### initialize

Handshake to establish client identity.

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "clientInfo": {
          "name": "tauri-acp",
          "version": "0.1.0"
        },
        "workingDirectory": "/path/to/project"
      }
    }

**Response:**

    {
      "id": 1,
      "result": {
        "userAgent": "tauri-acp/0.91.0 (Mac OS 26.2.0; arm64) ghostty/1.2.3 (tauri-acp; 0.1.0)"
      }
    }

### initialized (Notification - CRITICAL)

**IMPORTANT:** After receiving the `initialize` response, the client MUST send an `initialized` notification. This completes the handshake and enables the server to process subsequent requests.

Without this notification, requests like `turn/start` may be accepted but will not trigger AI responses.

**Notification (client → server, no `id`):**

    {
      "jsonrpc": "2.0",
      "method": "initialized"
    }

Or with empty params:

    {
      "jsonrpc": "2.0",
      "method": "initialized",
      "params": {}
    }

This notification does not receive a response.

### thread/start (RECOMMENDED)

Start a new thread. This is the **recommended** method to create a conversation that will properly handle AI responses.

**IMPORTANT:** Use `thread/start` instead of `newConversation` for new implementations. `newConversation` returns a `conversationId` but does NOT properly initialize the AI session for `turn/start` to trigger responses.

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 2,
      "method": "thread/start",
      "params": {
        "cwd": "/path/to/project"
      }
    }

**Response:**

    {
      "id": 2,
      "result": {
        "thread": {
          "id": "019c035b-f523-7ee3-9391-7860e3497d31",
          "preview": "",
          "modelProvider": "openai",
          "createdAt": 1769582884,
          "updatedAt": 1769582884,
          "path": "/Users/.../.codex/sessions/2026/01/28/rollout-....jsonl",
          "cwd": "/path/to/project"
        }
      }
    }

The `thread.id` is used as `threadId` in subsequent `turn/start` requests.

### newConversation (LEGACY)

Create a new conversation thread. **Note:** This method returns a `conversationId` but does NOT properly initialize the AI session. Use `thread/start` instead.

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 2,
      "method": "newConversation",
      "params": {
        "workingDirectory": "/path/to/project"
      }
    }

**Response:**

    {
      "id": 2,
      "result": {
        "conversationId": "019c0215-4155-7032-83c9-a36633d06154",
        "model": "gpt-5.2-codex",
        "reasoningEffort": "medium",
        "rolloutPath": "/Users/.../.codex/sessions/2026/01/28/rollout-....jsonl"
      }
    }

### turn/start (v2 - Recommended)

Start a new turn with user input. This triggers the AI to generate a response.

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 3,
      "method": "turn/start",
      "params": {
        "threadId": "019c0215-4155-7032-83c9-a36633d06154",
        "input": [
          {
            "type": "text",
            "text": "Hello, how are you?"
          }
        ]
      }
    }

**Optional parameters:**

    {
      "threadId": "...",
      "input": [...],
      "cwd": "/path/to/project",
      "approvalPolicy": "on-failure",
      "sandboxPolicy": {
        "type": "danger-full-access"
      },
      "model": "gpt-5.2-codex",
      "effort": "medium"
    }

**Response:**

    {
      "id": 3,
      "result": {}
    }

The actual response content comes via notifications (see below).

### sendUserMessage (v1 - Legacy)

Adds a message to conversation without triggering AI response. Use `turn/start` instead.

**Request:**

    {
      "jsonrpc": "2.0",
      "id": 3,
      "method": "sendUserMessage",
      "params": {
        "conversationId": "019c0215-4155-7032-83c9-a36633d06154",
        "items": [
          {
            "type": "text",
            "data": {
              "text": "Hello, how are you?"
            }
          }
        ]
      }
    }

### turn/interrupt (v2) / interruptConversation (v1)

Cancel an ongoing generation.

**v2 Request (requires turnId from turn/started notification):**

    {
      "jsonrpc": "2.0",
      "id": 4,
      "method": "turn/interrupt",
      "params": {
        "threadId": "019c0215-4155-7032-83c9-a36633d06154",
        "turnId": "turn-abc123"
      }
    }

**v1 Request:**

    {
      "jsonrpc": "2.0",
      "id": 4,
      "method": "interruptConversation",
      "params": {
        "conversationId": "019c0215-4155-7032-83c9-a36633d06154"
      }
    }

### Other Methods

From the schema, additional methods include:

| Method            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `thread/start`    | Start a new thread (alternative to newConversation) |
| `thread/resume`   | Resume existing thread                              |
| `thread/fork`     | Fork a thread                                       |
| `thread/archive`  | Archive a thread                                    |
| `thread/rollback` | Rollback thread state                               |
| `thread/list`     | List threads                                        |
| `thread/read`     | Read thread content                                 |
| `turn/start`      | Start a turn with user input (v2, recommended)      |
| `turn/interrupt`  | Cancel ongoing generation (v2)                      |
| `skills/list`     | List available skills                               |
| `model/list`      | List available models                               |
| `config/read`     | Read configuration                                  |
| `account/read`    | Read account info                                   |
| `fuzzyFileSearch` | Search files                                        |

## Server Notifications

Notifications are sent from server to client without an `id` field.

### item/agentMessage/delta

Streaming text fragment from the AI.

    {
      "method": "item/agentMessage/delta",
      "params": {
        "threadId": "019c0215-4155-7032-83c9-a36633d06154",
        "turnId": "turn-abc123",
        "itemId": "item-xyz789",
        "delta": "Hello! I'm doing well, thank you for asking."
      }
    }

### turn/completed

Indicates the AI has finished its turn.

    {
      "method": "turn/completed",
      "params": {
        "threadId": "019c0215-4155-7032-83c9-a36633d06154",
        "turn": {
          "id": "turn-abc123",
          "status": "completed"
        }
      }
    }

### turn/started

Indicates a new turn has begun.

    {
      "method": "turn/started",
      "params": {
        "threadId": "019c0215-4155-7032-83c9-a36633d06154",
        "turnId": "turn-abc123"
      }
    }

### item/started / item/completed

Item lifecycle notifications.

    {
      "method": "item/started",
      "params": {
        "threadId": "...",
        "turnId": "...",
        "itemId": "...",
        "type": "agentMessage"
      }
    }

### configWarning

Non-blocking configuration warning.

    {
      "method": "configWarning",
      "params": {
        "summary": "The following config folders are disabled:\n    1. /path/.codex\n       Add /path as a trusted project in ~/.codex/config.toml.\n",
        "details": null
      }
    }

### Other Notifications

| Method                                      | Description                  |
| ------------------------------------------- | ---------------------------- |
| `item/commandExecution/outputDelta`         | Command output streaming     |
| `item/commandExecution/terminalInteraction` | Terminal interaction request |
| `item/fileChange/outputDelta`               | File change output           |
| `item/reasoning/textDelta`                  | Reasoning text streaming     |
| `item/reasoning/summaryTextDelta`           | Reasoning summary            |
| `item/mcpToolCall/progress`                 | MCP tool call progress       |
| `turn/diff/updated`                         | Diff updated                 |
| `turn/plan/updated`                         | Plan updated                 |
| `account/updated`                           | Account state changed        |
| `account/rateLimits/updated`                | Rate limits changed          |

## InputItem Types

The `items` array in `sendUserMessage` supports multiple input types:

### TextInputItem

    {
      "type": "text",
      "data": {
        "text": "User message content",
        "text_elements": []  // Optional: UI-defined spans
      }
    }

### Other Input Types (from schema)

- Image input
- File reference input
- Code snippet input

## Error Handling

Errors are returned in the standard JSON-RPC error format:

    {
      "id": 3,
      "error": {
        "code": -32600,
        "message": "Invalid request: missing field `items`",
        "data": null
      }
    }

Common error codes:

- `-32600`: Invalid request (missing/malformed params)
- `-32601`: Method not found
- `-32602`: Invalid params

## Schema File Reference

### /tmp/codex-schema/ClientRequest.json

Contains all client → server request definitions:

    SendUserMessageParams:
      - conversationId: string (required)
      - items: InputItem[] (required)

    InputItem (oneOf):
      - TextInputItem: {type: "text", data: {text: string}}
      - Other input types...

### /tmp/codex-schema/ServerNotification.json

Contains all server → client notification definitions:

    AgentMessageDeltaNotification:
      - delta: string (required)
      - itemId: string (required)
      - threadId: string (required)
      - turnId: string (required)

    TurnCompletedNotification:
      - threadId: string (required)
      - turn: Turn (required)

## Implementation Notes

### For Tauri Plugin (Rust)

1. Make `jsonrpc` field optional in response/notification structs
2. Use `#[serde(default)]` for optional fields
3. Handle both `conversationId` and `threadId` (they're equivalent)
4. Use v2 protocol (`turn/start`) for better compatibility
5. Store `model` from `newConversation` response for optional use in `turn/start`

### For TypeScript SDK

1. Event listeners should filter by `threadId` matching current session
2. Accumulate `delta` notifications to build complete response
3. Use `turn/completed` to signal end of streaming
4. Track `turnId` from `turn/started` if implementing `turn/interrupt`

### Protocol Selection

- **v2 (Recommended)**: Use `turn/start` with `threadId` and `input` array
- **v1 (Legacy)**: Use `sendUserTurn` with `conversationId` and `items` array
- Both versions use the same notification format for responses

## Version History

- 2026-01-28: Initial documentation based on Codex 0.91.0
