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
- [x] (2026-01-28 16:10JST) Phase 7: Codex protocol debugging and fixes (COMPLETED)
  - Fixed: jsonrpc field made optional in JsonRpcResponse/JsonRpcNotification
  - Fixed: Added tracing-subscriber for debug logging
  - Fixed: Added stderr reading task for agent process diagnostics
  - Fixed: Changed method names to Codex-specific ones (newConversation, sendUserMessage)
  - Fixed: InputItem format corrected to {type, data: {text}}
  - Fixed: Notification handlers for item/agentMessage/delta and turn/completed
  - Fixed: Unique agent IDs to prevent React StrictMode collision
  - Added: Debug logging for event emission (Rust) and event reception (TypeScript)
  - Fixed: Added `initialized` notification after initialize response (2026-01-28 11:45JST)
    - Added `send_notification` method to AgentHandle
    - Updated writer_task to handle both requests and notifications
    - This completes the required handshake sequence
  - Fixed: Changed `newConversation` to `thread/start` (2026-01-28 15:55JST)
    - CRITICAL: `newConversation` does NOT properly initialize AI session
    - `thread/start` is required for `turn/start` to trigger AI responses
    - Verified with standalone Node.js test: `item/agentMessage/delta` now received
  - VERIFIED: Streaming delta events now reach frontend UI (2026-01-28 16:10JST)
- [x] (2026-01-28 10:07JST) Documentation: Created Codex protocol reference
  - Created `docs/codex-app-server-protocol.md` (8.6KB)
  - Documents: protocol overview, request/response formats, notification methods, InputItem schema
  - Includes: how to obtain schema files, implementation notes for Rust/TypeScript
- [x] (2026-02-15) Phase 9: ACP v1 protocol migration (COMPLETED)
  - Migrated from Codex app-server protocol to ACP v1 (codex-acp / claude-code-acp compatible)
  - commands.rs: initialize params, session/new, session/prompt, session/cancel
  - process.rs: Replaced Codex notification handlers with session/update handler
  - App.tsx: Default agent changed from codex to claude-code-acp
  - docs: Rewrote protocol documentation for ACP v1
- [x] (2026-01-28 18:30JST) Phase 8: Modern Chat UI refinement (COMPLETED)
  - Reference: langchain-ai/agent-chat-ui patterns via DeepWiki
  - Improvements implemented:
    - Markdown rendering (react-markdown + remark-gfm)
    - Code syntax highlighting (react-syntax-highlighter + oneDark theme)
    - Typing indicator animation (3-dot bounce)
    - Auto-scroll to bottom on new messages
    - Copy code button with feedback
    - Refined visual design (gradient backgrounds, smooth animations, modern spacing)
    - Auto-resize textarea for multi-line input
    - Welcome screen for empty state
    - Message timestamps
    - Avatar icons for user/assistant
- [x] (2026-02-15) Phase 10: LLM provider + model selector UI (TDD, 13 tests)
  - Step 10.1: Rust — Extended `acp_start_session` to return `SessionInfoResponse` with models
  - Step 10.2: Rust — Added `acp_set_model` command (session/setModel JSON-RPC)
  - Step 10.3: TypeScript SDK — Added `AcpModel`, `SessionInfo` types; `setModel` in session/commands
  - Step 10.4: React — Created `PROVIDERS` registry, extended `useAcpChat` with model state
  - Step 10.5: React — Provider selection in App.tsx with localStorage persistence
  - Step 10.6: React — Functional provider and model dropdowns in AcpChat.tsx
  - Step 10.7: localStorage persistence for provider selection; CSS for dropdown menus
  - Dual format parsing: handles both claude-code-acp and codex-acp field names
- [x] (2026-02-15) Phase 11: Provider selector redesign + Codex reasoning level UI (TDD, 37 tests)
  - Step 11.1: Extended ProviderConfig with `supportsReasoningLevel` flag and `REASONING_LEVELS` constant
  - Step 11.2: Updated useAcpChat hook with `reasoningLevel` state, `setReasoningLevel` callback, combined `{modelId}/{level}` wire format
  - Step 11.3: Redesigned header — provider label as title, "+" opens provider dropdown (downward)
  - Step 11.4: Redesigned toolbar — model only (Claude Code) or model + reasoning level (Codex)
  - Step 11.5: CSS updates — `.acp-chat-provider-dropdown` for downward header dropdown
  - Step 11.6: localStorage persistence for reasoning level (`acp-reasoning-level:{providerId}`)
  - Step 11.7: Updated AcpChat to pass `supportsReasoningLevel` to hook
  - Step 11.8: TDD tests — 15 new tests across 4 cycles (providers 4, hook reasoning 5, App UI 9, persistence 2)
  - DeepWiki verified: codex-acp `parse_model_id` splits `{preset_id}/{reasoning_effort}`, claude-code-acp uses plain modelId
- [x] (2026-02-15) Phase 12: Code review, refactoring, and test reinforcement (Agent Team)
  - Team: lead + rust-specialist + frontend-specialist (plan approval mode)
  - Rust: Extracted `check_response()`, `parse_session_response()`, `parse_notification()` helpers
  - Rust: Removed redundant `agent_handles` HashMap from PluginState
  - Rust: Fixed hardcoded `exit_code: Some(0)` to use actual process exit code
  - Rust: 28 new unit tests (14 → 42 total)
  - Frontend: Split `useAcpChat` (232→118 lines) into `useAcpSession` + `useReasoningLevel`
  - Frontend: Split `AcpChat` (288→134 lines) into `DropdownSelect` + `ChatMessageList` + `ChatInput`
  - Frontend: Extracted `onSessionEvent` helper in AcpSession SDK
  - Frontend: 23 new Vitest tests (37 → 60 total)
  - Cross-layer: Fixed `Option<T>` null vs undefined mismatch (3 fields)
  - Commits: `refactor(acp)`, `refactor(acp-chat)`, `fix(acp)`

## Surprises & Discoveries

- (2026-01-27 18:45JST) tauri-plugin build requires `links` field
  - Error: `package.links field in the Cargo manifest is not set`
  - Resolution: Added `links = "tauri-plugin-acp"` to Cargo.toml

- (2026-01-27 18:46JST) Returning Future from `with_agent` closure causes lifetime error
  - Error: `lifetime may not live long enough`
  - Resolution: Introduced `AgentHandle` struct to make `request_tx` clonable and usable independently

- (2026-01-28 09:40JST) Codex app-server omits `jsonrpc` field in responses
  - Observation: Responses are `{"id":1,"result":{...}}` without `"jsonrpc":"2.0"`
  - Resolution: Made `jsonrpc` field `Option<String>` with `#[serde(default)]` in protocol.rs
  - Files: `crates/tauri-plugin-acp/src/protocol.rs` (JsonRpcResponse, JsonRpcNotification)

- (2026-01-28 09:43JST) Codex uses different method names than generic ACP
  - Methods available (from error message): `initialize`, `newConversation`, `sendUserMessage`, `interruptConversation`, etc.
  - NOT available: `prompt`, `cancel` (these were our initial assumptions)
  - Resolution: Updated commands.rs to use Codex-specific method names
  - Schema location: `/tmp/codex-schema/ClientRequest.json`

- (2026-01-28 09:50JST) Codex sendUserMessage requires specific InputItem format
  - Error sequence: `missing field 'items'` → `missing field 'data'` → success
  - Correct format:
    {
    "conversationId": "...",
    "items": [{
    "type": "text",
    "data": { "text": "user message" }
    }]
    }
  - Schema: `/tmp/codex-schema/ClientRequest.json` → SendUserMessageParams → InputItem

- (2026-01-28 09:45JST) React StrictMode causes double agent spawn with same ID
  - Symptom: Agent stdout closes immediately after spawn
  - Cause: Second agent with same ID overwrites first in HashMap, dropping first AgentProcess
  - Resolution: Generate unique agent IDs with UUID suffix: `format!("{}-{}", spec.id, uuid::Uuid::new_v4())`
  - File: `crates/tauri-plugin-acp/src/commands.rs` (acp_spawn_agent)

- (2026-01-28 09:42JST) Tauri GUI apps don't inherit shell PATH
  - Symptom: `codex` command not found when spawning agent
  - Resolution: Use full path `/opt/homebrew/bin/codex` in AgentSpec.executable
  - File: `src/App.tsx`

- (2026-01-28 09:55JST) Codex notification methods differ from assumed ACP
  - Streaming delta: `item/agentMessage/delta` (params: delta, threadId, turnId, itemId)
  - Turn complete: `turn/completed` (params: threadId, turn)
  - Other: `turn/started`, `item/started`, `item/completed`, `configWarning`
  - Schema: `/tmp/codex-schema/ServerNotification.json`
  - Resolution: Updated handle_notification in process.rs

- (2026-01-28 10:22JST) Codex has v1 and v2 protocol versions
  - v1: `sendUserTurn` with `conversationId`, `items` (complex InputItem format)
  - v2: `turn/start` with `threadId`, `input` (simpler UserInput format)
  - v1 InputItem: `{"type": "text", "data": {"text": "..."}}`
  - v2 UserInput: `{"type": "text", "text": "..."}`
  - Resolution: Switched to v2 protocol for simplicity
  - Reference: DeepWiki analysis of openai/codex and zed-industries/codex-acp

- (2026-01-28 11:30JST) **CRITICAL: Missing `initialized` notification in handshake**
  - Discovery: DeepWiki analysis of openai/codex revealed required initialization sequence
  - Required sequence:
    1. Send `initialize` request → receive response ✅ (implemented)
    2. Send `initialized` notification (NO id, fire-and-forget) ❌ (MISSING!)
    3. Send `thread/start` or `newConversation` ✅
    4. Send `turn/start` ✅
  - Impact: Without `initialized` notification, subsequent requests may not trigger AI response
  - Resolution: Add `initialized` notification after `initialize` response in commands.rs
  - Reference: openai/codex MessageProcessor validates initialization state

- (2026-01-28 11:30JST) zed-industries/codex-acp uses codex-core directly, NOT app-server
  - Discovery: DeepWiki analysis revealed architectural difference
  - zed-industries/codex-acp: Links codex-core Rust library directly
  - Our implementation: Uses Codex CLI `app-server` mode via stdio JSON-RPC
  - Implication: Their code is not directly applicable as reference for our stdio protocol
  - Alternative references: openai/codex `app-server-test-client`, `debug-client`

- (2026-01-28 15:55JST) **CRITICAL: `thread/start` required instead of `newConversation`**
  - Discovery: Standalone Node.js test showed `item/agentMessage/delta` is received with correct flow
  - Correct flow:
    1. `initialize` request → response
    2. `initialized` notification (no response)
    3. `thread/start` request → response (returns `thread.id`) ← THIS WAS MISSING
    4. `turn/start` request with `threadId`
  - Wrong flow (what we had):
    1. `initialize` → `newConversation` → `turn/start`
  - Impact: `newConversation` returns a `conversationId` but does NOT properly initialize AI session
  - Resolution: Changed to use `thread/start` instead of `newConversation`
  - Evidence: Node.js test received `"delta":"Hello"` successfully

- (2026-02-15) codex-acp and claude-code-acp both implement ACP v1
  - Discovery: DeepWiki analysis confirmed both agents use the same JSON-RPC methods (initialize, session/new, session/prompt, session/cancel, session/update)
  - Implication: A single ACP v1 implementation can support both agents without any conditional logic

- (2026-02-15) Codex app-server protocol (thread/start, turn/start) is NOT ACP
  - Discovery: The previous implementation used Codex-internal protocol, not the standardized ACP v1
  - ACP v1 uses session/new, session/prompt instead of thread/start, turn/start

- (2026-02-15) ACP v1 protocol differences from Codex app-server (from bugtracker validation)
  - initialize params: `protocolVersion` + `clientCapabilities` (not `clientInfo` + `workingDirectory`)
  - No `initialized` notification needed (Codex required it)
  - session/cancel is a notification, not a request
  - Completion is signaled by the session/prompt response, not a turn/completed notification
  - Field name is `prompt` not `input` in session/prompt params
  - Session ID comes from `result.sessionId` not `result.thread.id`

- (2026-02-15) **session/prompt does NOT accept a `model` parameter**
  - Discovery: Team investigation (devil's advocate) identified this critical gap
  - Verified against zed-industries/claude-code-acp and zed-industries/codex-acp
  - session/prompt params: `{ sessionId, prompt }` only — no model field
  - Model selection requires separate `session/setModel` method (both agents implement it)
  - claude-code-acp: `unstable_setSessionModel({ sessionId, modelId })` (marked unstable)
  - codex-acp: `session/setModel({ session_id, model_id })` (supports `{preset_id}/{reasoning_effort}` format)

- (2026-02-15) session/new response `models` format is richer than expected
  - claude-code-acp returns: `{ sessionId, models: { availableModels: [{modelId, name, description}], currentModelId }, modes: {...} }`
  - codex-acp returns: `{ session_id, models: { current_model_id, available_models: [{model_id, name, description}] }, modes: {...} }`
  - Current Rust code only extracts `models[0].value` and discards the rest
  - The full `models` object includes `currentModelId` and structured `availableModels` array

- (2026-02-15) claude-code-acp model selection known issue (#225)
  - Always picks first model from `supportedModels()`, ignoring user preferences from `~/.claude/settings.json`
  - Root cause: `getAvailableModels()` calls `query.supportedModels()` but always selects `models[0]`
  - Implication: `session/setModel` after session creation is the reliable way to set model

- (2026-02-15) **Tauri v2 capability permission missing for `acp_set_model`**
  - Symptom: `Unhandled Promise Rejection: acp.acp_set_model not allowed. Permissions associated with this command: acp:allow-acp-set-model`
  - Root cause: Phase 10 added the `acp_set_model` command to `commands.rs`, `lib.rs`, and `build.rs`, but did NOT add `acp:allow-acp-set-model` to `src-tauri/capabilities/default.json`
  - Learning: Tauri v2 requires BOTH (1) registering the command in the plugin's `invoke_handler` AND (2) granting the permission in the app's `capabilities/*.json`. The autogenerated permission TOML files in `crates/tauri-plugin-acp/permissions/autogenerated/commands/` are created by `tauri-plugin::Builder::new(COMMANDS).build()` in `build.rs`, but they are NOT automatically applied — the app must explicitly list them in its capabilities
  - Fix: Added `"acp:allow-acp-set-model"` to `src-tauri/capabilities/default.json` permissions array
  - Checklist for adding new Tauri commands: (1) `commands.rs` — implement, (2) `lib.rs` — register in `invoke_handler`, (3) `build.rs` — add to `COMMANDS` array, (4) `capabilities/default.json` — add `acp:allow-{command_name}` permission

- (2026-02-15) **ACP wire method name is `session/set_model` (snake_case), NOT `session/setModel` (camelCase)**
  - Symptom: Both `session/setModel` and `unstable_setSessionModel` returned `-32601 Method not found`
  - Initial misdiagnosis: DeepWiki reported method names from the TypeScript function level (`unstable_setSessionModel`, `newSession`, `prompt`), not the wire-level JSON-RPC method names. These are internal handler names in `ClaudeAcpAgent`, not what gets sent over stdio
  - Root cause: The `@agentclientprotocol/sdk` defines an `AGENT_METHODS` constant that maps internal names to wire names. The SDK's `AgentSideConnection` dispatches incoming requests via a `switch(method)` on these wire names
  - Source of truth: `@agentclientprotocol/sdk/dist/schema/index.js` contains:
    ```
    AGENT_METHODS = {
      initialize: "initialize",
      session_new: "session/new",
      session_prompt: "session/prompt",
      session_cancel: "session/cancel",
      session_set_model: "session/set_model",
      session_set_mode: "session/set_mode",
      session_set_config_option: "session/set_config_option",
      session_fork: "session/fork",
      session_list: "session/list",
      session_load: "session/load",
      session_resume: "session/resume",
      authenticate: "authenticate",
    }
    ```
  - Pattern: Wire method names use `snake_case` with `/` separator (e.g., `session/set_model`), while TypeScript handler names use `camelCase` or `unstable_` prefix (e.g., `unstable_setSessionModel`). DeepWiki returns handler names, not wire names
  - Learning: **Always verify wire method names from the SDK's `AGENT_METHODS` constant, not from DeepWiki or TypeScript function names.** The installed SDK is at `node_modules/@agentclientprotocol/sdk/dist/schema/index.js`
  - Fix: Changed `acp_set_model` to send `"session/set_model"` (correct wire name), removed fallback logic
  - File: `crates/tauri-plugin-acp/src/commands.rs` (`acp_set_model`)

- (2026-02-15) Rust `Option<T>` serializes `None` as JSON `null`, not absent field
  - TypeScript `field?: T` expects the field to be **absent** (undefined), not `null`
  - `null !== undefined` in JavaScript strict equality → caused global errors to be silently dropped
  - Specifically: `AcpEvent::Error { session_id: None }` → `{ session_id: null }` → `AcpSession.onError` checked `event.session_id !== undefined` → `null !== undefined` is `true` → callback skipped
  - Resolution: Add `#[serde(skip_serializing_if = "Option::is_none")]` to all `Option<T>` fields that cross the Rust↔TypeScript boundary
  - Learning: **Every `Option<T>` in a Rust struct that serializes to JSON for TypeScript consumption MUST have `skip_serializing_if = "Option::is_none"`** if the TypeScript side uses `field?: T` (optional property). Otherwise use `field: T | null` on the TypeScript side.

- (2026-02-15) Agent team review found bugs that single-author implementation missed
  - The null/undefined mismatch existed since Phase 2 but was never caught because global errors are rare in normal testing
  - Cross-layer consistency checks (Rust serde attributes vs TypeScript type definitions) should be part of the CI or review checklist
  - A dedicated cross-layer-check agent was valuable — automated field-by-field comparison found what manual review overlooked

- (2026-02-15) `parse_notification` was untestable without AppHandle extraction
  - `handle_notification` mixed parsing logic with Tauri `emit_event` calls
  - Extracting `parse_notification` as a pure function (`JsonRpcNotification → Option<AcpEvent>`) made it unit-testable without spinning up a Tauri app
  - Learning: **Separate pure parsing logic from side-effectful emission** in Rust Tauri plugins to enable unit testing

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

- Decision: Implement Codex-specific protocol rather than generic ACP
  Rationale: Codex app-server uses its own protocol variant with methods like `newConversation`, `sendUserMessage`. Schema files available at `/tmp/codex-schema/`. Future refactoring can abstract to support multiple agents.
  Date/Author: 2026-01-28 / Discovery during debugging

- Decision: Use tracing-subscriber for Rust-side debugging
  Rationale: Essential for diagnosing stdio communication issues. Enabled via RUST_LOG env or default filter `tauri_plugin_acp=debug`.
  Date/Author: 2026-01-28 / Implementation requirement

- Decision: Use `thread/start` instead of `newConversation` for session initialization
  Rationale: `newConversation` returns a conversationId but does NOT properly initialize the AI session. `thread/start` is required for `turn/start` to trigger AI responses. Discovered through systematic debugging with standalone Node.js test.
  Date/Author: 2026-01-28 / Discovery during debugging

- Decision: Continue using app-server (stdio) instead of codex-core direct integration
  Rationale: (1) Flexibility to support other agents (Claude Code, Goose) in future, (2) Process isolation prevents agent crashes from affecting app, (3) Implementation already working. codex-core would require Rust-only, Codex-specific implementation.
  Date/Author: 2026-01-28 / User confirmation after analysis

- Decision: Migrate from Codex app-server protocol to ACP v1
  Rationale: codex-acp and claude-code-acp both implement ACP v1. By migrating to ACP v1, a single implementation supports both agents. The Codex app-server protocol (thread/start, turn/start) was Codex-specific and not the standardized ACP.
  Date/Author: 2026-02-15 / Discovery from bugtracker project and DeepWiki analysis

- Decision: Use `session/setModel` for model switching (not session/prompt model param)
  Rationale: ACP v1 `session/prompt` does NOT accept a `model` parameter. Both claude-code-acp (`unstable_setSessionModel`) and codex-acp (`session/setModel`) implement a separate method to change the model after session creation. This is the only reliable mechanism.
  Date/Author: 2026-02-15 / Team investigation (devil's advocate finding)

- Decision: Two-dropdown cascade in toolbar for provider + model selection
  Rationale: Matches existing placeholder dropdowns in AcpChat.tsx. Follows Cursor/VS Code Copilot patterns for developer tools. Provider (left) selects executable; model (right) is populated dynamically from session/new response. Simpler than a settings panel and more accessible.
  Date/Author: 2026-02-15 / Team investigation (UX designer proposal)

- Decision: Static PROVIDERS[] registry with dynamic model discovery
  Rationale: Provider list is static (which executables are available), but model list is dynamic (fetched from agent via session/new response). This avoids hardcoding model lists and adapts to agent version changes. Spawn failure for unavailable providers shows disabled state in UI.
  Date/Author: 2026-02-15 / Team investigation (architect proposal)

- Decision: Include localStorage persistence in v1
  Rationale: Devil's advocate review identified that no persistence means users must re-select provider/model on every app restart. Implementation cost is minimal (~5 lines). Saves last selected providerId and modelId.
  Date/Author: 2026-02-15 / Team investigation (devil's advocate recommendation)

## Outcomes & Retrospective

- (2026-01-27 18:51JST) Initial implementation completed
  - All 6 phases completed
  - Rust plugin builds and tests pass (1 test, 5 warnings about unused fields reserved for future use)
  - TypeScript SDK typechecks pass
  - Chat UI integrated into bpmn-editor
  - Commit: `feat: add ACP (Agent Client Protocol) library for Tauri`

- (2026-01-28 16:10JST) **Codex protocol debugging COMPLETED - Full E2E working!**
  - Root cause identified: Missing `initialized` notification AND wrong method (`newConversation` vs `thread/start`)
  - Correct initialization sequence discovered:
    1. `initialize` request → response
    2. `initialized` notification (fire-and-forget)
    3. `thread/start` request → response (returns `thread.id`)
    4. `turn/start` request → streaming notifications
  - All streaming events now working:
    - `item/agentMessage/delta` → Delta events reach frontend
    - `turn/completed` → Complete events reach frontend
  - Key learnings:
    - Codex app-server protocol differs significantly from documented ACP
    - `newConversation` ≠ `thread/start` (different behavior)
    - `initialized` notification is REQUIRED (not optional)
    - zed-industries/codex-acp uses codex-core directly (not app-server)
  - Documentation created: `docs/codex-app-server-protocol.md`

- (2026-02-15) **ACP v1 protocol migration COMPLETED**
  - Migrated from Codex app-server protocol to ACP v1
  - Files changed: commands.rs, process.rs, App.tsx, docs/codex-app-server-protocol.md
  - Based on bugtracker reference implementation (verified against claude-code-acp v0.16.0)
  - Protocol documentation rewritten for ACP v1 with comparison table

- (2026-02-15) **Phase 11 implementation: Key learnings**
  - TDD approach with 5 vertical cycles worked well: providers → hook reasoning → UI redesign → CSS → persistence
  - Agent team (UX reviewer, architect, devil's advocate) validated design decisions in parallel
  - DeepWiki verified codex-acp `parse_model_id` splits `{preset_id}/{reasoning_effort}` format
  - DeepWiki verified claude-code-acp `unstable_setSessionModel` uses plain modelId (no reasoning)
  - `reasoningLevelRef` pattern needed to avoid stale closures in `handleSetModel`
  - `reset` removed from AcpChat UI destructuring — "+" button replaced reset functionality

- (2026-02-15) **Phase 12: Agent team code review and refactoring — Key learnings**
  - **Agent team structure**: 2 specialists (Rust, Frontend) + 1 lead with plan approval mode worked well for parallel domain-specific review. Each specialist stayed within their file ownership boundaries (no merge conflicts)
  - **Plan approval as quality gate**: Catching R1 (already-implemented `JsonRpcId::as_i64`) before execution saved wasted effort. The specialist had read a stale version of the code
  - **Cross-layer audit is essential**: A dedicated cross-layer-check agent found the null/undefined mismatch that both specialists and the lead's manual review missed. Automated field-by-field comparison of Rust serde output vs TypeScript types should be standard practice
  - **Refactoring metrics**: useAcpChat 232→118 lines (-49%), AcpChat 288→134 lines (-53%), total test count 51→102 (+100%)
  - **Pure function extraction is highest-value refactoring**: `parse_notification` and `parse_session_response` were the most impactful changes — they made critical protocol logic unit-testable without requiring Tauri AppHandle or full process setup
  - **Redundant state maps create synchronization risks**: The `agent_handles` map duplicated data already accessible via `AgentProcess::handle()`. Removing it simplified 3 methods and eliminated a class of potential inconsistency bugs

## Known Issues

### Issue 1: "codex-acp" was not found (PATH resolution) — FIXED (2026-02-15)

**Symptom**: Selecting Codex provider shows error: `"codex-acp" was not found. Please install it or check your PATH.`

**Root cause**: Tauri GUI apps on macOS/Linux don't inherit shell PATH from dotfiles (.zshrc, .bash_profile, etc.). Executables installed via npm global or Homebrew (like `claude-code-acp`, `codex-acp`) are not found when using bare names.

**Fix applied**: Added `fix-path-env` crate (from `tauri-apps/fix-path-env-rs`) to the Tauri app. This crate reads the user's shell configuration at startup and fixes the `PATH` environment variable for the entire process. All child processes spawned via `Command::new()` will then inherit the corrected PATH.

**Files changed**:

- `src-tauri/Cargo.toml` — Added `fix-path-env` git dependency
- `src-tauri/src/lib.rs` — Added `fix_path_env::fix()` call before Tauri builder

**Remaining concern**: If the user hasn't installed `codex-acp` at all, the error will still appear. The existing `format-error.ts` shows a user-friendly message in that case. A future improvement could probe for executable availability on startup and disable unavailable providers.

### Issue 2: Claude Code model selection stuck on "Default" — INVESTIGATION IN PROGRESS (2026-02-15)

**Symptom**: When Claude Code provider is selected, the model dropdown shows "Default" and no models can be selected.

**Investigation findings**:

1. **DeepWiki confirmed response format**: claude-code-acp's `getAvailableModels()` returns `{ availableModels: [{ modelId: model.value, name: model.displayName, description: model.description }], currentModelId: currentModel.value }` — this matches our `parse_available_models()` parsing logic exactly.
2. **Rust unit tests pass**: 9 unit tests for `parse_available_models()` added covering claude-code-acp format, codex-acp format, null descriptions, missing descriptions, empty arrays, and edge cases. All pass.
3. **Parsing logic verified correct**: The code correctly handles both `availableModels`/`modelId` (claude-code-acp) and `available_models`/`model_id` (codex-acp) formats.

**Diagnostic logging added**: Upgraded `session/new` response logging from `debug` to `info` level to capture the raw JSON response during `pnpm tauri dev`:

- Full `session/new` result JSON
- Whether `models` field is present and its raw content
- Parsed model count and IDs

**Next step**: Run `pnpm tauri dev` with claude-code-acp and inspect the Rust logs in the terminal. The new info-level logging will show exactly what `session/new` returns, revealing whether the issue is in the response format, missing data, or something else entirely.

**Files changed**:

- `crates/tauri-plugin-acp/src/commands.rs` — Info-level logging for session/new response + 9 unit tests for `parse_available_models()`

## Context and Orientation

### Repository Structure

The current repository is a Tauri v2 + React 19 + TypeScript application for BPMN diagram editing. The following structure will be added:

    tauri-acp-kit/
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
    ├── docs/                          # NEW: Documentation
    │   └── codex-app-server-protocol.md  # Codex protocol reference
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

**Codex-Specific Protocol Details**

Codex app-server uses a variant of JSON-RPC with the following characteristics:

1.  **Response format**: Omits `jsonrpc` field (e.g., `{"id":1,"result":{...}}`)

2.  **Request methods** (from `/tmp/codex-schema/ClientRequest.json`):
    - `initialize` - Initial handshake
    - `newConversation` - Create conversation, returns `conversationId`
    - `sendUserMessage` - Send user message with InputItem array
    - `interruptConversation` - Cancel ongoing generation

3.  **sendUserMessage params format**:

        {
          "conversationId": "019c0215-...",
          "items": [{
            "type": "text",
            "data": { "text": "Hello, how are you?" }
          }]
        }

4.  **Notification methods** (from `/tmp/codex-schema/ServerNotification.json`):
    - `item/agentMessage/delta` - Streaming text: `{delta, threadId, turnId, itemId}`
    - `turn/completed` - Turn finished: `{threadId, turn}`
    - `turn/started` - Turn began
    - `item/started`, `item/completed` - Item lifecycle
    - `configWarning` - Configuration warnings (non-blocking)

5.  **threadId vs conversationId**: These are equivalent. The `newConversation` response contains `conversationId`, which is used as `threadId` in notifications.

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

### Phase 10: LLM Provider + Model Selector UI

Add provider selection (Claude Code / Codex) and per-provider model selection to the Chat UI.

**Key Protocol Finding**: `session/prompt` does NOT accept a `model` parameter. Model must be changed via `session/setModel` (codex-acp) or `session/setSessionModel` (claude-code-acp, unstable). Both use the same wire format: `{ sessionId, modelId }`.

**Step 10.1: Rust — Extend `acp_start_session` return type**

Change `acp_start_session` to return `SessionInfoResponse` instead of plain `String`:

    #[derive(Serialize)]
    pub struct SessionInfoResponse {
        pub session_id: String,
        pub models: Vec<AcpModelInfo>,
        pub current_model_id: Option<String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct AcpModelInfo {
        pub id: String,       // e.g. "claude-sonnet-4-20250514"
        pub name: String,     // e.g. "Claude Sonnet 4"
        pub description: Option<String>,
    }

Parse the `session/new` response `models` field:

- Try `result.models.availableModels` (claude-code-acp format)
- Fallback to `result.models` as plain array (legacy format)
- Extract `currentModelId` from `result.models.currentModelId`

Files: `commands.rs`, `state.rs` (add `available_models` and `current_model_id` to `Session`)

**Step 10.2: Rust — Add `acp_set_model` command**

New Tauri command to send `session/setModel` JSON-RPC:

    #[tauri::command]
    pub async fn acp_set_model<R: Runtime>(
        state: State<'_, PluginState>,
        session_id: String,
        model_id: String,
    ) -> Result<(), Error> {
        let session = state.get_session(&session_id).await?;
        let handle = state.get_agent_handle(&session.agent_id).await?;
        let params = serde_json::json!({ "sessionId": session_id, "modelId": model_id });
        handle.send_request("session/setModel", params).await?;
        state.update_session_model(&session_id, &model_id).await?;
        Ok(())
    }

Files: `commands.rs`, `lib.rs` (register command), `build.rs` (add to COMMANDS), `state.rs` (add `update_session_model`)

**Step 10.3: TypeScript SDK — Surface models and add setModel**

`types.ts`:

    export interface AcpModel {
      id: string;
      name: string;
      description?: string;
    }

    export interface SessionInfo {
      sessionId: string;
      models: AcpModel[];
      currentModelId: string | null;
    }

`commands.ts`:

    export async function startSession(agentId: string, cwd: string): Promise<SessionInfo> { ... }
    export async function setModel(sessionId: string, modelId: string): Promise<void> { ... }

`session.ts`:

    export class AcpSession {
      private _models: AcpModel[];
      private _currentModelId: string | null;
      constructor(id, agentId, models, currentModelId) { ... }
      get models(): AcpModel[] { ... }
      get currentModelId(): string | null { ... }
      async setModel(modelId: string): Promise<void> { ... }
    }

`agent.ts`:

    async startSession(cwd: string): Promise<AcpSession> {
      const info = await commands.startSession(this._id, cwd);
      return new AcpSession(info.sessionId, this._id, info.models, info.currentModelId);
    }

**Step 10.4: React — Provider registry and state management**

Create `src/features/acp-chat/providers.ts`:

    import type { AgentSpec } from "tauri-acp";

    export interface ProviderConfig {
      id: string;
      label: string;
      agentSpec: AgentSpec;
    }

    export const PROVIDERS: ProviderConfig[] = [
      {
        id: "claude-code-acp",
        label: "Claude Code",
        agentSpec: { id: "claude-code-acp", executable: "claude-code-acp", args: [] },
      },
      {
        id: "codex-acp",
        label: "Codex",
        agentSpec: { id: "codex-acp", executable: "codex-acp", args: [] },
      },
    ];

Update `src/features/acp-chat/types.ts` — extend `UseAcpChatReturn`:

    export interface UseAcpChatReturn {
      // ... existing fields ...
      availableModels: AcpModel[];
      currentModelId: string | null;
      setModel: (modelId: string) => Promise<void>;
    }

Update `src/features/acp-chat/hooks/useAcpChat.ts`:

- Add `availableModels` and `currentModelId` state
- On session start, populate from `session.models` and `session.currentModelId`
- Add `setModel` callback that calls `session.setModel(modelId)` and updates state

**Step 10.5: React — Update App.tsx with provider selection**

    import { useState } from "react";
    import { PROVIDERS } from "./features/acp-chat/providers";

    function App() {
      const [providerId, setProviderId] = useState(() =>
        localStorage.getItem("acp-provider") || PROVIDERS[0].id
      );
      const provider = PROVIDERS.find(p => p.id === providerId) || PROVIDERS[0];

      return (
        <main className="container">
          <AcpChat
            agentSpec={provider.agentSpec}
            providers={PROVIDERS}
            selectedProviderId={providerId}
            onProviderChange={(id) => {
              setProviderId(id);
              localStorage.setItem("acp-provider", id);
            }}
          />
        </main>
      );
    }

**Step 10.6: React — Wire up AcpChat.tsx dropdowns**

Replace the two placeholder `<button className="acp-chat-dropdown">` elements with functional provider and model selectors:

Provider dropdown (left):

- Shows current provider label
- Dropdown lists PROVIDERS with checkmark for selected
- On select: calls `onProviderChange(id)` — triggers agent restart via useEffect

Model dropdown (right):

- Shows current model name + "(recommended)" for first model
- Populated from `availableModels` state
- Disabled while `!isReady` or `availableModels` is empty
- On select: calls `setModel(modelId)` — sends session/setModel to agent

Implementation: Use simple CSS dropdown (click to toggle popover, click-outside to close) using existing `.acp-chat-dropdown` styles. No external UI library.

**Step 10.7: Persistence and edge cases**

- Save last selected `providerId` and `modelId` in `localStorage`
- Restore on mount; validate against available options
- Handle spawn failure: show provider as disabled with error tooltip
- Handle empty models array: show "Default" in model dropdown, disable selection
- Handle `session/setModel` failure: show error, revert to previous model

**Verification:**

1. Start app → default provider (Claude Code) selected, models populated from session/new
2. Switch model → next prompt uses new model (verify in agent logs)
3. Switch provider → old agent terminated, new agent spawned, models refresh
4. Restart app → last selected provider/model restored from localStorage
5. Invalid provider (not installed) → error shown, dropdown indicates unavailable

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

### Documentation Created

- `docs/codex-app-server-protocol.md` - Comprehensive Codex app-server protocol reference
  - What: JSON-RPC protocol for Codex GUI integration
  - How to obtain schema: From source or runtime extraction
  - Schema location: `/tmp/codex-schema/` (ClientRequest.json, ServerNotification.json)
  - Key methods: initialize, newConversation, sendUserMessage, interruptConversation
  - Key notifications: item/agentMessage/delta, turn/completed
  - InputItem format, error handling, implementation notes

### Terminal Output Examples

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

### Phase 11: Provider Selector Redesign + Codex Reasoning Level UI

Redesign the Chat UI header and toolbar to follow a Zed-inspired pattern: provider selection moves to the header "+" dropdown, and the toolbar shows provider-specific options (model for Claude Code, model + reasoning level for Codex).

**Current UI layout:**

    ┌─────────────────────────────────────┐
    │   New Thread  (status)          [+] │  ← "+" is reset/new conversation
    ├─────────────────────────────────────┤
    │     Messages                        │
    ├─────────────────────────────────────┤
    │  Textarea                [Send/Stop]│
    │  ─────────────────────────────────  │
    │  [Provider▼] [Model▼]              │  ← Both dropdowns in toolbar
    └─────────────────────────────────────┘

**Target UI layout:**

    ┌─────────────────────────────────────┐
    │   Claude Code  (status)         [+▼]│  ← Header shows provider name,
    │                                     │     "+" opens provider dropdown
    │              ┌──────────────┐       │
    │              │ Claude Code ✓│       │
    │              │ Codex        │       │
    │              └──────────────┘       │
    ├─────────────────────────────────────┤
    │     Messages                        │
    ├─────────────────────────────────────┤
    │  Textarea                [Send/Stop]│
    │  ─────────────────────────────────  │
    │  [Model▼]                 (CC only) │  ← Provider-specific toolbar
    │  [Model▼] [Reasoning▼]   (Codex)   │
    └─────────────────────────────────────┘

**Key Protocol Reference:** codex-acp's `session/setModel` accepts `{preset_id}/{reasoning_effort}` format (e.g., `claude-sonnet-4-20250514/medium`). Reasoning effort values: `low`, `medium`, `high` (from `codex-protocol` crate's `ReasoningEffort` enum). claude-code-acp does NOT support reasoning levels.

**Step 11.1: Extend ProviderConfig with reasoning support**

Update `src/features/acp-chat/providers.ts`:

    import type { AgentSpec } from "tauri-acp";

    export interface ProviderConfig {
      id: string;
      label: string;
      agentSpec: AgentSpec;
      supportsReasoningLevel: boolean;
    }

    export const REASONING_LEVELS = ["low", "medium", "high"] as const;
    export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

    export const PROVIDERS: ProviderConfig[] = [
      {
        id: "claude-code-acp",
        label: "Claude Code",
        agentSpec: { id: "claude-code-acp", executable: "claude-code-acp", args: [] },
        supportsReasoningLevel: false,
      },
      {
        id: "codex-acp",
        label: "Codex",
        agentSpec: { id: "codex-acp", executable: "codex-acp", args: [] },
        supportsReasoningLevel: true,
      },
    ];

**Step 11.2: Update types and useAcpChat hook**

Add to `UseAcpChatReturn`:

    reasoningLevel: ReasoningLevel | null;
    setReasoningLevel: (level: ReasoningLevel) => Promise<void>;

In `useAcpChat.ts`:

- Add `reasoningLevel` state (default: `"medium"` for Codex, `null` for Claude Code)
- `setReasoningLevel(level)` callback:
  - Updates local state
  - Constructs combined model ID: `{currentModelId}/{level}`
  - Calls `sessionRef.current.setModel(combinedId)`
- `setModel(modelId)` callback:
  - If provider supports reasoning level and reasoning level is set, sends `{modelId}/{reasoningLevel}`
  - Otherwise sends plain `modelId`

**Step 11.3: Redesign AcpChat.tsx header**

Replace current header with:

1. **Left side**: Provider label as title (e.g., "Claude Code" or "Codex") + connection status
2. **Right side**: "+" button that opens a downward dropdown menu listing providers
   - Each item shows provider label with checkmark for selected
   - Selecting a different provider calls `onProviderChange(id)` → triggers session restart

The current `reset` button functionality is replaced: selecting the current provider from the "+" dropdown serves as "new conversation" (or a long-press / separate icon can be added later).

**Step 11.4: Redesign AcpChat.tsx toolbar**

Remove the provider dropdown from the toolbar. The toolbar now shows:

- **All providers**: Model dropdown (unchanged behavior)
- **Codex only**: Reasoning Level dropdown next to model dropdown
  - Options: Low, Medium, High
  - Default: Medium
  - Disabled when `!isReady` or `availableModels.length === 0`
  - On select: calls `setReasoningLevel(level)`

Conditional rendering:

    {/* Model Dropdown — always shown */}
    <ModelDropdown ... />

    {/* Reasoning Level Dropdown — only for providers that support it */}
    {selectedProvider?.supportsReasoningLevel && (
      <ReasoningLevelDropdown ... />
    )}

Pass `selectedProvider` from the `providers` and `selectedProviderId` props already available in AcpChat.

**Step 11.5: CSS updates**

- `.acp-chat-header-title` — Show provider label with proper styling
- `.acp-chat-provider-dropdown` — Header dropdown (downward, not upward)
  - Position: absolute, `top: 100%` (below header), right-aligned
  - Same visual style as existing dropdown-menu
- Reasoning level dropdown reuses existing `.acp-chat-dropdown*` classes

**Step 11.6: localStorage persistence for reasoning level**

- Key: `acp-reasoning-level` (per-provider, stored as `{providerId}:{level}`)
- Restore on mount; validate against available values
- Update on change

**Step 11.7: Update AcpChat props**

New props to pass `selectedProvider` info (already derivable from existing props):

    interface AcpChatProps {
      agentSpec: AgentSpec;
      cwd?: string;
      providers?: ProviderConfig[];
      selectedProviderId?: string;
      onProviderChange?: (providerId: string) => void;
    }

No new props needed — `selectedProvider` is derived inside AcpChat from `providers` and `selectedProviderId`.

**Step 11.8: Tests (TDD)**

Test list:

1. Header shows current provider label (not "New Thread")
2. "+" button opens provider dropdown
3. Selecting a provider calls `onProviderChange`
4. Toolbar shows model dropdown for Claude Code
5. Toolbar shows model dropdown AND reasoning level dropdown for Codex
6. Reasoning level dropdown not visible for Claude Code
7. Selecting reasoning level updates state
8. `setModel` sends combined `{modelId}/{level}` for Codex
9. `setModel` sends plain `modelId` for Claude Code
10. Reasoning level persisted to localStorage

**Verification:**

1. Start app → header shows "Claude Code", toolbar shows [Model▼]
2. Click "+" → dropdown shows "Claude Code ✓" and "Codex"
3. Select "Codex" → header changes to "Codex", toolbar shows [Model▼] [Reasoning▼]
4. Select reasoning level "High" → next prompt uses `{modelId}/high` format
5. Switch back to "Claude Code" → reasoning level dropdown disappears
6. Restart app → last selected provider and reasoning level restored

---

Plan Revision Note:

- 2026-01-27: Initial version created. Reflects user choices (package name: tauri-acp, no sample app, flexible agent configuration).
- 2026-01-27: Added ACP Communication Sequence Diagrams section with 5 sequence diagrams (Agent Spawn, Session Initialize, Send Prompt with Streaming, Cancel, Agent Termination) and message format examples.
- 2026-01-27: Added Phase 5 (Chat UI Implementation) with custom `useAcpChat` hook inspired by @ai-sdk/react's useChat API. Added `src/features/acp-chat/` directory structure, hook implementation, and AcpChat component. Updated validation steps for Chat UI testing.
- 2026-02-15: Added Phase 11 (Provider Selector Redesign + Codex Reasoning Level UI). Moves provider selection to header "+" dropdown (Zed-inspired), adds per-provider toolbar options (model only for Claude Code, model + reasoning level for Codex). Based on DeepWiki analysis of codex-acp's `ReasoningEffort` enum (low/medium/high) and `{preset_id}/{reasoning_effort}` format for `session/setModel`.
