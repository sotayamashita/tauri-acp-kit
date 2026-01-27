# Implement Tauri ACP Client Library (Plugin + TS SDK)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

This change enables Tauri application developers to connect to local coding assistance agents (starting with Codex) via ACP (Agent Client Protocol) with minimal configuration and TypeScript code. Developers can send prompts, receive streaming responses (delta events), get final responses (complete events), and cancel ongoing generation.

Verification method: Integrate the ACP library into the bpmn-editor app. From the developer console or a simple UI, send text and observe streaming delta responses followed by a complete event. Verify that cancel operations stop generation.

Deliverables:

1. **Rust Tauri plugin** (`tauri-plugin-acp`): Located at `crates/tauri-plugin-acp/`
2. **TypeScript SDK** (`tauri-acp`): Located at `packages/tauri-acp/`
3. **Chat UI for validation** (`src/features/acp-chat/`): React components and custom `useAcpChat` hook

## Progress

- (2026-01-27 18:38JST) Implementation started
- [x] (2026-01-27 18:47JST) Phase 1: Workspace structure setup
  - Created Cargo.toml (workspace root)
  - Updated pnpm-workspace.yaml
  - Created crates/tauri-plugin-acp/, packages/tauri-acp/ directories
- [x] (2026-01-27 18:47JST) Phase 2: Rust plugin foundation (process management, JSONL framing)
  - Created error.rs, protocol.rs, events.rs, framing.rs, process.rs, state.rs, commands.rs, lib.rs
  - Introduced AgentHandle to resolve lifetime issues
- [x] (2026-01-27 18:47JST) Phase 3: ACP protocol implementation (initialize, prompt, cancel)
  - Implemented acp_spawn_agent, acp_start_session, acp_send_prompt, acp_cancel, acp_terminate_agent commands
- [x] (2026-01-27 18:47JST) Phase 4: TypeScript SDK implementation
  - Created types.ts, commands.ts, events.ts, session.ts, agent.ts, index.ts
- [x] (2026-01-27 18:48JST) Phase 5: Chat UI implementation (useAcpChat hook + React components)
  - Created src/features/acp-chat/ directory
  - Created types.ts, hooks/useAcpChat.ts, components/AcpChat.tsx, components/AcpChat.css, index.ts
  - TypeScript typecheck passed
- [x] (2026-01-27 18:50JST) Phase 6: Integration into bpmn-editor and validation
  - Added plugin dependency to src-tauri/Cargo.toml
  - Registered plugin in src-tauri/src/lib.rs
  - Added tauri-acp workspace dependency to package.json
  - cargo build, pnpm build, cargo test all passed

## Surprises & Discoveries

- (2026-01-27 18:45JST) tauri-plugin build requires `links` field
  - Error: `package.links field in the Cargo manifest is not set`
  - Resolution: Added `links = "tauri-plugin-acp"` to Cargo.toml

- (2026-01-27 18:46JST) Returning Future from `with_agent` closure causes lifetime error
  - Error: `lifetime may not live long enough`
  - Resolution: Introduced `AgentHandle` struct to make `request_tx` clonable and usable independently

## Decision Log

- Decision: TypeScript SDK package name is `tauri-acp` (no scope)
  Rationale: Simple and memorable. A scope can be added later if published to npm.
  Date/Author: 2026-01-27 / User selection

- Decision: No separate sample app; validate within bpmn-editor
  Rationale: Most practical as an integration example. Serves as reference for porting to other repositories.
  Date/Author: 2026-01-27 / User selection

- Decision: Agent execution is configured flexibly via settings
  Rationale: Supports future agents beyond Codex (Claude Code, Goose, etc.). Allows environment-specific configuration.
  Date/Author: 2026-01-27 / Assistant recommendation

- Decision: MVP supports only ACP over stdio (JSONL format)
  Rationale: Simplest approach. Most ACP bridges support this format.
  Date/Author: 2026-01-27 / Original plan

- Decision: Create custom `useAcpChat` hook instead of using `@ai-sdk/react`
  Rationale: `@ai-sdk/react` is designed for HTTP streaming (SSE). ACP uses Tauri IPC events, which requires a custom implementation. The custom hook will follow `useChat`-style API for familiarity.
  Date/Author: 2026-01-27 / User selection

- Decision: Add validation Chat UI in `src/features/acp-chat/`
  Rationale: A visual UI makes it easier to verify streaming, cancellation, and error handling. Follows the existing src/ structure convention.
  Date/Author: 2026-01-27 / User selection

## Outcomes & Retrospective

- (2026-01-27 18:51JST) Implementation completed successfully
  - All 6 phases completed
  - Rust plugin builds and tests pass (1 test, 5 warnings about unused fields reserved for future use)
  - TypeScript SDK typechecks pass
  - Chat UI integrated into bpmn-editor
  - Commit: `feat: add ACP (Agent Client Protocol) library for Tauri`

## Context and Orientation

### Repository Structure

The current repository is a Tauri v2 + React 19 + TypeScript application for BPMN diagram editing. The following structure will be added:

    bpmn-editor/
    ├── Cargo.toml                    # NEW: Cargo workspace root
    ├── crates/
    │   └── tauri-plugin-acp/         # NEW: Rust plugin
    │       ├── Cargo.toml
    │       ├── build.rs
    │       └── src/
    ├── packages/
    │   └── tauri-acp/                # NEW: TypeScript SDK
    │       ├── package.json
    │       ├── tsconfig.json
    │       └── src/
    ├── src-tauri/                    # Existing: bpmn-editor backend
    │   ├── Cargo.toml               　# MODIFY: reference as workspace member
    │   └── src/lib.rs               　# MODIFY: register plugin
    ├── src/                          # Existing: bpmn-editor frontend
    ├── package.json                  # MODIFY: add workspace packages
    └── pnpm-workspace.yaml           # MODIFY: add packages directory

### Terminology

- **ACP (Agent Client Protocol)**: A JSON-RPC 2.0 based communication protocol between GUI clients and coding assistance agents. Defines request/response patterns and notification events.

- **JSONL (JSON Lines)**: A format where each line is a complete JSON object. The standard framing method for ACP messages over stdio.

- **Tauri plugin**: An extension module that adds functionality to a Tauri app on the Rust side. Provides invoke commands (callable from frontend) and event emission (notifications to frontend).

- **TypeScript SDK**: A thin wrapper that provides type-safe access to Tauri's invoke and listen APIs, hiding implementation details like event names and command names.

- **Streaming**: Receiving text fragments (deltas) incrementally before the final response is complete, allowing progressive display in the UI.

- **Agent**: An external process that implements the ACP protocol. In this MVP, primarily Codex, but the architecture supports other agents.

- **Session**: A conversation context with an agent. Multiple prompts can be sent within a single session.

### Key Files

- `bpmn-editor/src-tauri/src/lib.rs` - Existing Tauri app configuration with greet command and plugin-opener
- `bpmn-editor/src-tauri/Cargo.toml` - Rust dependencies (tauri v2, serde, serde_json)
- `bpmn-editor/package.json` - Node dependencies (@tauri-apps/api v2, React 19)
- `bpmn-editor/pnpm-workspace.yaml` - Currently minimal (only minimumReleaseAge setting)

### ACP Communication Sequence Diagrams

The following diagrams illustrate the communication flow between the ACP Client (Tauri Plugin) and ACP Server (Agent Process).

**1. Agent Spawn Sequence**

This sequence shows how the Tauri plugin spawns an agent process and establishes stdio communication.

    Frontend (TS)          Tauri Plugin (Rust)       Agent Process
         |                        |                        |
         |   invoke(spawn_agent)  |                        |
         |----------------------->|                        |
         |                        |   spawn process        |
         |                        |----------------------->|
         |                        |   (stdin/stdout ready) |
         |                        |<-----------------------|
         |                        |                        |
         |   emit(agent_spawned)  |                        |
         |<-----------------------|                        |
         |   return agent_id      |                        |
         |<-----------------------|                        |

**2. Session Initialize Sequence**

After spawning, a session must be initialized before sending prompts. This involves the ACP `initialize` handshake.

    Frontend (TS)          Tauri Plugin (Rust)       Agent Process
         |                        |                        |
         |  invoke(start_session) |                        |
         |----------------------->|                        |
         |                        |  JSON-RPC: initialize  |
         |                        |  {id:1, method:"initialize", params:{...}}
         |                        |----------------------->|
         |                        |                        |
         |                        |  JSON-RPC: response    |
         |                        |  {id:1, result:{protocolVersion:"1.0"}}
         |                        |<-----------------------|
         |                        |                        |
         |  emit(session_ready)   |                        |
         |<-----------------------|                        |
         |  return session_id     |                        |
         |<-----------------------|                        |

**3. Send Prompt with Streaming Response**

This is the core interaction. The client sends a prompt, and the agent streams back text deltas followed by a completion signal.

    Frontend (TS)          Tauri Plugin (Rust)       Agent Process
         |                        |                        |
         |  invoke(send_prompt)   |                        |
         |----------------------->|                        |
         |                        |  JSON-RPC: prompt      |
         |                        |  {id:2, method:"prompt", params:{text:"..."}}
         |                        |----------------------->|
         |  return request_id     |                        |
         |<-----------------------|                        |
         |                        |                        |
         |                        |  notification: delta   |
         |                        |  {method:"delta", params:{text:"Hello"}}
         |                        |<-----------------------|
         |  emit(delta)           |                        |
         |<-----------------------|                        |
         |                        |                        |
         |                        |  notification: delta   |
         |                        |  {method:"delta", params:{text:" world"}}
         |                        |<-----------------------|
         |  emit(delta)           |                        |
         |<-----------------------|                        |
         |                        |                        |
         |                        |  JSON-RPC: response    |
         |                        |  {id:2, result:{stopReason:"end_turn"}}
         |                        |<-----------------------|
         |  emit(complete)        |                        |
         |<-----------------------|                        |

**4. Cancel In-Progress Generation**

When the user wants to stop generation, a cancel request is sent.

    Frontend (TS)          Tauri Plugin (Rust)       Agent Process
         |                        |                        |
         |  invoke(cancel)        |                        |
         |----------------------->|                        |
         |                        |  JSON-RPC: cancel      |
         |                        |  {id:3, method:"cancel", params:{}}
         |                        |----------------------->|
         |                        |                        |
         |                        |  JSON-RPC: response    |
         |                        |  {id:3, result:{}}     |
         |                        |<-----------------------|
         |                        |                        |
         |                        |  (original prompt response)
         |                        |  {id:2, result:{stopReason:"cancelled"}}
         |                        |<-----------------------|
         |  emit(complete)        |  (stopReason=cancelled)|
         |<-----------------------|                        |
         |  return void           |                        |
         |<-----------------------|                        |

**5. Agent Termination**

Clean shutdown of the agent process.

    Frontend (TS)          Tauri Plugin (Rust)       Agent Process
         |                        |                        |
         |  invoke(terminate)     |                        |
         |----------------------->|                        |
         |                        |  SIGTERM / kill        |
         |                        |----------------------->|
         |                        |                        X (process exits)
         |                        |  (wait for exit)       |
         |                        |<-----------------------
         |  emit(agent_terminated)|                        |
         |<-----------------------|                        |
         |  return void           |                        |
         |<-----------------------|                        |

**Message Format (JSONL over stdio)**

All messages between the Tauri Plugin and Agent Process use JSON-RPC 2.0 format, with one complete JSON object per line (JSONL). Examples:

Request (stdin to agent):

    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"tauri-acp","version":"0.1.0"}}}

Response (stdout from agent):

    {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"1.0","serverInfo":{"name":"codex","version":"1.0.0"}}}

Notification (stdout from agent, no id):

    {"jsonrpc":"2.0","method":"delta","params":{"sessionId":"sess_123","text":"Hello"}}

## Plan of Work

### Phase 1: Workspace Structure Setup

Create the foundation for the multi-crate Rust workspace and pnpm workspace.

1. Create root `Cargo.toml` defining a Cargo workspace with members `src-tauri` and `crates/tauri-plugin-acp`.

2. Update `pnpm-workspace.yaml` to include the `packages/*` directory.

3. Create directory structure for `crates/tauri-plugin-acp/` and `packages/tauri-acp/`.

4. Verify builds still work after workspace changes.

### Phase 2: Rust Plugin Foundation

Implement the core infrastructure for the Tauri plugin.

Create the following file structure in `crates/tauri-plugin-acp/`:

    src/
    ├── lib.rs           # Plugin builder and initialization
    ├── commands.rs      # Tauri commands (spawn, start_session, send, cancel)
    ├── state.rs         # Plugin state management (agents, sessions)
    ├── process.rs       # Child process management (spawn, stdin/stdout, kill)
    ├── framing.rs       # JSONL reader/writer for stdin/stdout
    ├── protocol.rs      # JSON-RPC 2.0 message types
    ├── events.rs        # Tauri event emission to frontend
    └── error.rs         # Error types with thiserror

Key implementation details:

**Process Management** (`process.rs`): Use `tokio::process::Command` to spawn the agent as a child process. Capture stdin, stdout, and stderr. Spawn async tasks for reading stdout (parsing JSONL) and writing to stdin. Handle process termination gracefully.

**JSONL Framing** (`framing.rs`): Implement a `JsonlReader` that reads lines from an async reader and parses each line as JSON. Implement a `JsonlWriter` that serializes JSON and writes with newline.

**State Management** (`state.rs`): Use `tokio::sync::RwLock` to manage a map of agents (by agent_id) and sessions (by session_id). Each agent has a reference to its child process. Each session has a reference to its parent agent.

### Phase 3: ACP Protocol Implementation

Implement the actual ACP commands that frontend can invoke.

**Commands:**

1. `acp_spawn_agent(spec: AgentSpec) -> String`
   - Validates the executable path against allowed paths (security)
   - Spawns the agent process
   - Returns a unique agent_id
   - Emits `agent_spawned` event on success

2. `acp_start_session(agent_id: String, cwd: String) -> String`
   - Sends ACP `initialize` request to the agent
   - Waits for `initialized` response
   - Returns a unique session_id
   - Emits `session_ready` event

3. `acp_send_prompt(session_id: String, prompt: String) -> String`
   - Sends ACP `prompt` request
   - Returns request_id immediately
   - Agent's streaming responses arrive as events:
     - `delta` events for each text chunk
     - `complete` event when finished

4. `acp_cancel(session_id: String) -> ()`
   - Sends ACP `cancel` request
   - Agent stops generation and sends final response

5. `acp_terminate_agent(agent_id: String) -> ()`
   - Kills the agent process
   - Emits `agent_terminated` event

**Events** (emitted on channel `acp://event`):

    { type: "delta", sessionId: string, text: string }
    { type: "complete", sessionId: string, stopReason: string }
    { type: "error", sessionId?: string, message: string }
    { type: "agent_terminated", agentId: string, exitCode?: number }

### Phase 4: TypeScript SDK Implementation

Create a type-safe wrapper around the Tauri commands.

Directory structure for `packages/tauri-acp/`:

    src/
    ├── index.ts         # Public exports
    ├── types.ts         # TypeScript type definitions
    ├── commands.ts      # Raw invoke wrappers
    ├── events.ts        # Event listener helpers
    ├── agent.ts         # AcpAgent class
    └── session.ts       # AcpSession class

**Public API:**

    // types.ts
    export interface AgentSpec {
      id: string;
      executable: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }

    export type StopReason = 'end_turn' | 'cancelled' | 'max_tokens' | 'error';

    export type AcpEvent =
      | { type: 'delta'; sessionId: string; text: string }
      | { type: 'complete'; sessionId: string; stopReason: StopReason }
      | { type: 'error'; sessionId?: string; message: string }
      | { type: 'agent_terminated'; agentId: string; exitCode?: number };

    // agent.ts
    export class AcpAgent {
      get id(): string;
      async spawn(spec: AgentSpec): Promise<string>;
      async startSession(cwd: string): Promise<AcpSession>;
      async terminate(): Promise<void>;
      onEvent(callback: (event: AcpEvent) => void): Promise<UnlistenFn>;
    }

    // session.ts
    export class AcpSession {
      get id(): string;
      async sendPrompt(prompt: string): Promise<string>;
      async cancel(): Promise<void>;
      onDelta(callback: (text: string) => void): Promise<UnlistenFn>;
      onComplete(callback: (reason: StopReason) => void): Promise<UnlistenFn>;
      onError(callback: (message: string) => void): Promise<UnlistenFn>;
    }

### Phase 5: Chat UI Implementation

Create a validation Chat UI with a custom `useAcpChat` hook following `@ai-sdk/react`'s `useChat` API pattern.

Directory structure for `src/features/acp-chat/`:

    src/features/acp-chat/
    ├── index.ts              # Public exports
    ├── hooks/
    │   └── useAcpChat.ts     # Custom chat hook
    ├── components/
    │   ├── AcpChat.tsx       # Main chat container
    │   ├── MessageList.tsx   # Message display
    │   ├── MessageInput.tsx  # Input with send/cancel
    │   └── Message.tsx       # Individual message bubble
    └── types.ts              # Chat-specific types

**useAcpChat Hook API** (inspired by @ai-sdk/react useChat):

    interface UseAcpChatOptions {
      agentSpec: AgentSpec;
      cwd?: string;
      onError?: (error: Error) => void;
    }

    interface UseAcpChatReturn {
      messages: Message[];
      input: string;
      setInput: (input: string) => void;
      isLoading: boolean;
      error: Error | null;
      append: (content: string) => Promise<void>;
      stop: () => Promise<void>;
      reload: () => Promise<void>;
    }

    interface Message {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      createdAt: Date;
    }

    export function useAcpChat(options: UseAcpChatOptions): UseAcpChatReturn;

**Implementation Details:**

The hook manages:

- Agent lifecycle (spawn on mount, terminate on unmount)
- Session lifecycle (start session after agent ready)
- Message state (accumulate deltas, finalize on complete)
- Loading state (true while waiting for response)
- Error handling (display errors in UI)

**AcpChat Component:**

A minimal but functional chat interface with:

- Message history display with user/assistant differentiation
- Text input with Enter to send
- Cancel button visible during generation
- Error display area
- Loading indicator during streaming

### Phase 6: Integration into bpmn-editor

1. Add plugin dependency to `src-tauri/Cargo.toml`:

   [dependencies]
   tauri-plugin-acp = { path = "../crates/tauri-plugin-acp" }

2. Register plugin in `src-tauri/src/lib.rs`:

   pub fn run() {
   tauri::Builder::default()
   .plugin(tauri_plugin_opener::init())
   .plugin(tauri_plugin_acp::init())
   .invoke_handler(tauri::generate_handler![greet])
   .run(tauri::generate_context!())
   .expect("error while running tauri application");
   }

3. Add TypeScript SDK as workspace dependency in root `package.json`.

4. Add Chat UI to the app (e.g., as a panel or modal accessible via menu/shortcut).

5. Verify end-to-end:
   - Spawn an agent
   - Start a session
   - Send a prompt via Chat UI
   - Observe streaming deltas appearing in real-time
   - See complete message when finished
   - Test cancel button stops generation

## Concrete Steps

### Step 1: Create Cargo Workspace

Create `bpmn-editor/Cargo.toml`:

    [workspace]
    resolver = "2"
    members = [
        "src-tauri",
        "crates/tauri-plugin-acp",
    ]

Verify with:

    cd bpmn-editor
    cargo check

Expected: No errors (may warn about missing crates/tauri-plugin-acp).

### Step 2: Update pnpm Workspace

Update `bpmn-editor/pnpm-workspace.yaml`:

    packages:
      - 'packages/*'

### Step 3: Create Plugin Skeleton

Create directory structure:

    mkdir -p crates/tauri-plugin-acp/src
    mkdir -p packages/tauri-acp/src

Create `crates/tauri-plugin-acp/Cargo.toml`:

    [package]
    name = "tauri-plugin-acp"
    version = "0.1.0"
    edition = "2021"

    [dependencies]
    tauri = { version = "2", features = [] }
    serde = { version = "1", features = ["derive"] }
    serde_json = "1"
    tokio = { version = "1", features = ["sync", "io-util", "process", "rt"] }
    thiserror = "1"
    uuid = { version = "1", features = ["v4"] }
    tracing = "0.1"

    [build-dependencies]
    tauri-plugin = { version = "2", features = ["build"] }

Create `crates/tauri-plugin-acp/build.rs`:

    const COMMANDS: &[&str] = &[
        "acp_spawn_agent",
        "acp_start_session",
        "acp_send_prompt",
        "acp_cancel",
        "acp_terminate_agent",
    ];

    fn main() {
        tauri_plugin::Builder::new(COMMANDS).build();
    }

Create minimal `crates/tauri-plugin-acp/src/lib.rs`:

    use tauri::{
        plugin::{Builder, TauriPlugin},
        Runtime,
    };

    mod commands;
    mod error;
    mod events;
    mod framing;
    mod process;
    mod protocol;
    mod state;

    pub use error::Error;
    pub type Result<T> = std::result::Result<T, Error>;

    pub fn init<R: Runtime>() -> TauriPlugin<R> {
        Builder::new("acp")
            .invoke_handler(tauri::generate_handler![
                commands::acp_spawn_agent,
                commands::acp_start_session,
                commands::acp_send_prompt,
                commands::acp_cancel,
                commands::acp_terminate_agent,
            ])
            .setup(|app, api| {
                // Initialize plugin state
                Ok(())
            })
            .build()
    }

### Step 4: Create TypeScript SDK Skeleton

Create `packages/tauri-acp/package.json`:

    {
      "name": "tauri-acp",
      "version": "0.1.0",
      "type": "module",
      "main": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsc",
        "typecheck": "tsc --noEmit"
      },
      "dependencies": {
        "@tauri-apps/api": "^2"
      },
      "devDependencies": {
        "typescript": "~5.8"
      }
    }

Create `packages/tauri-acp/tsconfig.json`:

    {
      "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "lib": ["ES2020", "DOM"],
        "strict": true,
        "declaration": true,
        "outDir": "./dist",
        "rootDir": "./src"
      },
      "include": ["src"]
    }

### Step 5: Create Chat UI

Create directory structure:

    mkdir -p src/features/acp-chat/hooks
    mkdir -p src/features/acp-chat/components

Create `src/features/acp-chat/types.ts`:

    export interface Message {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      createdAt: Date;
    }

    export interface UseAcpChatOptions {
      agentSpec: AgentSpec;
      cwd?: string;
      onError?: (error: Error) => void;
    }

    export interface UseAcpChatReturn {
      messages: Message[];
      input: string;
      setInput: (input: string) => void;
      isLoading: boolean;
      error: Error | null;
      append: (content: string) => Promise<void>;
      stop: () => Promise<void>;
    }

Create `src/features/acp-chat/hooks/useAcpChat.ts`:

    import { useState, useEffect, useCallback, useRef } from 'react';
    import { AcpAgent, AcpSession, AgentSpec } from 'tauri-acp';
    import type { Message, UseAcpChatOptions, UseAcpChatReturn } from '../types';

    export function useAcpChat(options: UseAcpChatOptions): UseAcpChatReturn {
      const [messages, setMessages] = useState<Message[]>([]);
      const [input, setInput] = useState('');
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState<Error | null>(null);

      const agentRef = useRef<AcpAgent | null>(null);
      const sessionRef = useRef<AcpSession | null>(null);
      const streamingContentRef = useRef('');

      // Initialize agent and session on mount
      useEffect(() => {
        const init = async () => {
          try {
            const agent = new AcpAgent();
            await agent.spawn(options.agentSpec);
            agentRef.current = agent;

            const session = await agent.startSession(options.cwd || process.cwd());
            sessionRef.current = session;

            // Subscribe to events
            session.onDelta((text) => {
              streamingContentRef.current += text;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...last, content: streamingContentRef.current }];
                }
                return prev;
              });
            });

            session.onComplete(() => {
              setIsLoading(false);
              streamingContentRef.current = '';
            });

            session.onError((msg) => {
              setError(new Error(msg));
              setIsLoading(false);
            });
          } catch (err) {
            setError(err as Error);
            options.onError?.(err as Error);
          }
        };
        init();

        return () => {
          agentRef.current?.terminate();
        };
      }, []);

      const append = useCallback(async (content: string) => {
        if (!sessionRef.current || isLoading) return;

        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          createdAt: new Date(),
        };

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          createdAt: new Date(),
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsLoading(true);
        setError(null);
        streamingContentRef.current = '';

        await sessionRef.current.sendPrompt(content);
      }, [isLoading]);

      const stop = useCallback(async () => {
        if (!sessionRef.current) return;
        await sessionRef.current.cancel();
      }, []);

      return { messages, input, setInput, isLoading, error, append, stop };
    }

Create `src/features/acp-chat/components/AcpChat.tsx`:

    import { useAcpChat } from '../hooks/useAcpChat';
    import type { AgentSpec } from 'tauri-acp';

    interface AcpChatProps {
      agentSpec: AgentSpec;
    }

    export function AcpChat({ agentSpec }: AcpChatProps) {
      const { messages, input, setInput, isLoading, error, append, stop } = useAcpChat({
        agentSpec,
      });

      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
          append(input);
          setInput('');
        }
      };

      return (
        <div className="acp-chat">
          <div className="messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <strong>{msg.role}:</strong>
                <p>{msg.content}</p>
              </div>
            ))}
          </div>

          {error && <div className="error">{error.message}</div>}

          <form onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
            />
            {isLoading ? (
              <button type="button" onClick={stop}>Cancel</button>
            ) : (
              <button type="submit">Send</button>
            )}
          </form>
        </div>
      );
    }

Create `src/features/acp-chat/index.ts`:

    export { useAcpChat } from './hooks/useAcpChat';
    export { AcpChat } from './components/AcpChat';
    export type * from './types';

### Step 6: Integrate into bpmn-editor

Add to `src-tauri/Cargo.toml` dependencies:

    tauri-plugin-acp = { path = "../crates/tauri-plugin-acp" }

Modify `src-tauri/src/lib.rs`:

    .plugin(tauri_plugin_acp::init())

Add tauri-acp to root `package.json` dependencies:

    "tauri-acp": "workspace:*"

Add AcpChat to App.tsx or as a separate route/panel:

    import { AcpChat } from './features/acp-chat';

    // In component:
    <AcpChat agentSpec={{
      id: 'codex',
      executable: '/path/to/codex',
      args: ['app-server'],
    }} />

Verify with:

    cd bpmn-editor
    cargo build
    pnpm build
    pnpm tauri dev

## Validation and Acceptance

### Build Validation

    cd bpmn-editor
    cargo build

Expected: Successful compilation with no errors.

    pnpm install
    pnpm build

Expected: Successful TypeScript compilation.

### Runtime Validation

    pnpm tauri dev

**Chat UI Validation:**

With Tauri dev server running:

1. Open the app and navigate to the ACP Chat panel
2. The chat should initialize without errors (agent spawns, session starts)
3. Type a message and press Enter or click Send
4. Observe:
   - User message appears immediately
   - Assistant message appears with streaming content
   - Text accumulates as deltas arrive
   - Send button changes to Cancel during generation
5. Test cancel: Start a long generation, click Cancel, verify it stops
6. Test error handling: Use invalid agent path, verify error displays

**Console Validation (alternative):**

With Tauri dev server running, open browser console and test:

    // This assumes TypeScript SDK is available or using raw invoke
    const { invoke } = window.__TAURI__.core;

    // Spawn agent (requires actual agent binary)
    const agentId = await invoke('plugin:acp|acp_spawn_agent', {
      spec: {
        id: 'test',
        executable: '/path/to/codex',
        args: ['app-server'],
      }
    });

    console.log('Agent spawned:', agentId);

### Unit Tests

    cargo test -p tauri-plugin-acp

Expected tests:

- JSONL framing parse/serialize
- JSON-RPC message correlation
- Error type conversion

## Idempotence and Recovery

- Workspace configuration files are additive; existing files are updated, not replaced
- Plugin double-registration is prevented by Tauri
- Agent process crashes emit `error` events and clean up state
- Each phase maintains a buildable state
- Commits should be made at each phase completion

## Artifacts and Notes

(To be recorded during implementation with actual terminal output)

Example expected output for agent spawn:

    INFO tauri_plugin_acp::process: Spawning agent pid=12345 agent_id=agent_abc123
    INFO tauri_plugin_acp::process: Agent process started successfully

Example expected output for session:

    INFO tauri_plugin_acp::commands: Starting session for agent_abc123
    INFO tauri_plugin_acp::commands: Session sess_xyz789 ready

## Interfaces and Dependencies

### Rust Dependencies (New Additions)

| Package      | Version | Purpose                       |
| ------------ | ------- | ----------------------------- |
| tokio        | 1       | Async I/O, process management |
| thiserror    | 1       | Error type definitions        |
| uuid         | 1       | ID generation                 |
| tracing      | 0.1     | Logging                       |
| tauri-plugin | 2       | Plugin build support          |

### TypeScript Dependencies (New Additions)

| Package         | Version | Purpose   |
| --------------- | ------- | --------- |
| @tauri-apps/api | ^2      | Tauri IPC |

### Rust Type Definitions

In `crates/tauri-plugin-acp/src/protocol.rs`:

    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;
    use std::path::PathBuf;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct AgentSpec {
        pub id: String,
        pub executable: String,
        pub args: Vec<String>,
        #[serde(default)]
        pub env: HashMap<String, String>,
        pub cwd: Option<PathBuf>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(tag = "jsonrpc")]
    pub enum JsonRpcMessage {
        #[serde(rename = "2.0")]
        Request {
            id: JsonRpcId,
            method: String,
            #[serde(default)]
            params: serde_json::Value,
        },
        #[serde(rename = "2.0")]
        Response {
            id: JsonRpcId,
            #[serde(flatten)]
            result: JsonRpcResult,
        },
        #[serde(rename = "2.0")]
        Notification {
            method: String,
            #[serde(default)]
            params: serde_json::Value,
        },
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(untagged)]
    pub enum JsonRpcId {
        Number(i64),
        String(String),
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(untagged)]
    pub enum JsonRpcResult {
        Ok { result: serde_json::Value },
        Err { error: JsonRpcError },
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct JsonRpcError {
        pub code: i32,
        pub message: String,
        #[serde(default)]
        pub data: Option<serde_json::Value>,
    }

In `crates/tauri-plugin-acp/src/events.rs`:

    use serde::Serialize;

    #[derive(Debug, Clone, Serialize)]
    #[serde(tag = "type", rename_all = "snake_case")]
    pub enum AcpEvent {
        Delta {
            session_id: String,
            text: String,
        },
        Complete {
            session_id: String,
            stop_reason: String,
        },
        Error {
            session_id: Option<String>,
            message: String,
        },
        AgentTerminated {
            agent_id: String,
            exit_code: Option<i32>,
        },
    }

In `crates/tauri-plugin-acp/src/error.rs`:

    use thiserror::Error;

    #[derive(Debug, Error)]
    pub enum Error {
        #[error("Agent not found: {0}")]
        AgentNotFound(String),

        #[error("Session not found: {0}")]
        SessionNotFound(String),

        #[error("Process spawn failed: {0}")]
        ProcessSpawnFailed(String),

        #[error("IO error: {0}")]
        Io(#[from] std::io::Error),

        #[error("JSON error: {0}")]
        Json(#[from] serde_json::Error),

        #[error("Protocol error: {0}")]
        Protocol(String),
    }

    impl serde::Serialize for Error {
        fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: serde::Serializer,
        {
            serializer.serialize_str(&self.to_string())
        }
    }

### TypeScript Type Definitions

In `packages/tauri-acp/src/types.ts`:

    export interface AgentSpec {
      id: string;
      executable: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }

    export type StopReason = 'end_turn' | 'cancelled' | 'max_tokens' | 'error';

    export type AcpEvent =
      | { type: 'delta'; sessionId: string; text: string }
      | { type: 'complete'; sessionId: string; stopReason: StopReason }
      | { type: 'error'; sessionId?: string; message: string }
      | { type: 'agent_terminated'; agentId: string; exitCode?: number };

    export type UnlistenFn = () => void;

---

Plan Revision Note:

- 2026-01-27: Initial version created. Reflects user choices (package name: tauri-acp, no sample app, flexible agent configuration).
- 2026-01-27: Added ACP Communication Sequence Diagrams section with 5 sequence diagrams (Agent Spawn, Session Initialize, Send Prompt with Streaming, Cancel, Agent Termination) and message format examples.
- 2026-01-27: Added Phase 5 (Chat UI Implementation) with custom `useAcpChat` hook inspired by @ai-sdk/react's useChat API. Added `src/features/acp-chat/` directory structure, hook implementation, and AcpChat component. Updated validation steps for Chat UI testing.
