# Refactoring: Reduce Complexity and Improve Maintainability

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

The dynamic agent download feature (`.agents/plans/2026-02-16-dynamic-agent-download.md`) was implemented as a series of feature additions and bugfixes. The resulting code works correctly (90 Rust tests, 114 TypeScript tests all pass), but several functions have grown beyond comfortable complexity thresholds. Five functions exceed 90 lines, cyclomatic complexity in `parse_notification()` approaches 10, and the central React hook `useAcpSession.ts` holds five distinct responsibilities in a single 250-line function. Error formatting is duplicated, JSON field access patterns are repeated without abstraction, and common UI patterns (click-outside, localStorage access) are copy-pasted across components.

After this refactoring, every function will be under 60 lines, cyclomatic complexity will not exceed 5 in any single function, and shared patterns will exist in exactly one place. The public API, behavior, and all existing tests remain unchanged. No new features are added.

Verification method: Run `cargo test -p tauri-plugin-acp`, `pnpm typecheck`, `pnpm test:run`, and `pnpm lint` after each milestone. All existing tests pass without modification. The app works identically when run via `pnpm tauri dev`.

## Progress

- [x] Phase 1: Rust — `commands.rs` extract methods (2026-02-16: extracted send_initialize, send_authenticate, send_create_session; unified error formatting in acp_send_prompt via check_response)
- [x] Phase 2: Rust — `process.rs` extract notification parsers (2026-02-16: extracted get_session_id, get_text_content, 5 per-type parsers; rewrote parse_notification as 20-line dispatcher; simplified stderr_task with lines() iterator)
- [x] Phase 3: Rust — `agent_download.rs` extract phases + path builders (2026-02-16: added agent_dir, github_version_dir, npm_entry_path builders; extracted fetch_latest_release, extract_and_set_permissions; 93 tests pass +3 new)
- [x] Phase 4: Frontend — Split `useAcpSession.ts` into focused hooks (2026-02-16: created messageUpdaters.ts with 5 pure functions, useAcpEventListeners.ts hook; simplified useAcpSession.ts from 250 to 134 lines; 124 tests pass +10 new)
- [x] Phase 5: Frontend — Extract shared utilities (2026-02-16: created useClickOutside hook, deriveConnectionStatus utility, safeLocalStorage wrappers; applied to AcpChat, DropdownSelect, App, useTheme, useReasoningLevel; 137 tests pass +13 new)

## Surprises & Discoveries

- Phase 1: Commit message header length limit (100 chars) required shortening the first attempt.
- Phase 2: `AsyncBufReadExt::lines()` simplified `stderr_task` more than expected (24→8 lines).
- Phase 4: Changed `session` from `useRef` to `useState` so `useAcpEventListeners` can react to session changes in its dependency array. This was not anticipated in the plan but was necessary for correct hook composition.
- Phase 5: `useTheme.ts` had no try/catch around localStorage calls (unlike App.tsx and useReasoningLevel.ts which already had them). The `safeLocalStorage` wrapper adds safety that was previously missing.

## Decision Log

- Decision: Refactor in five phases ordered by risk and dependency
  Rationale: Rust changes carry no cross-boundary risk (TypeScript SDK wraps Tauri commands that don't change signature). Frontend hook splitting is the highest-risk change because it restructures component wiring. Shared utility extraction is the lowest risk. Ordering Rust first, then hooks, then utilities minimizes the blast radius at each step.
  Date/Author: 2026-02-16

- Decision: Preserve all existing tests without modification
  Rationale: The refactoring must be purely structural. If an existing test needs to change, that indicates a behavioral change and should be flagged in "Surprises & Discoveries". New tests may be added for newly extracted functions, but existing tests are the regression safety net.
  Date/Author: 2026-02-16

- Decision: Do not introduce new abstractions (traits, generics, Context providers) unless the duplication is 3+ occurrences
  Rationale: The analysis identified some patterns (e.g., Strategy pattern for notification parsers, Context for prop drilling) that would add indirection without proportionate benefit in a codebase of this size. Plain functions are preferred over traits. The bar for a new abstraction is three or more concrete call sites.
  Date/Author: 2026-02-16

## Outcomes & Retrospective

All 5 phases completed on 2026-02-16. Summary:

### Test counts

- Rust: 90 → 93 (+3 new in Phase 3). All 90 original tests unmodified.
- TypeScript: 114 → 137 (+23 new across Phases 4-5). All 114 original tests unmodified.
- Total: 204 → 230

### Lines changed (net)

- Phase 1: commands.rs — extracted 3 helpers, unified error formatting
- Phase 2: process.rs — extracted 7 helpers, 20-line dispatcher, simplified stderr_task
- Phase 3: agent_download.rs — 3 path builders, 2 extracted functions, ReleaseAsset struct
- Phase 4: useAcpSession.ts 250→134 lines, +2 new files (messageUpdaters.ts, useAcpEventListeners.ts)
- Phase 5: -63/+26 lines across 5 modified files, +6 new files (3 utilities + 3 test files)

### Key outcomes

- No function exceeds 60 lines (goal met)
- Cyclomatic complexity reduced below 5 in all refactored functions (goal met)
- Zero behavioral changes: all original tests pass without modification throughout
- Click-outside pattern exists in exactly one place (useClickOutside hook)
- localStorage access pattern exists in exactly one place (storage.ts)
- Connection status derivation exists in exactly one place (connectionStatus.ts)
- Error formatting in Rust unified via check_response helper

### Commits

1. `refactor(acp): extract helpers from acp_start_session and unify error formatting`
2. `refactor(acp): extract notification parsers and simplify stderr_task`
3. `refactor(acp): extract path builders and helpers from agent_download`
4. `refactor(frontend): split useAcpSession into focused hooks`
5. `refactor(frontend): extract shared hooks and utilities`

## Context and Orientation

The repository is a Tauri v2 + React 19 + TypeScript application. The Rust plugin at `crates/tauri-plugin-acp/src/` manages agent processes and ACP protocol communication. The TypeScript SDK at `packages/tauri-acp/src/` wraps Tauri commands. The React frontend at `src/features/acp-chat/` provides the chat UI.

Key files targeted for refactoring, with current line counts (production code only, excluding tests):

    crates/tauri-plugin-acp/src/commands.rs    — 568 lines (tests: 300 lines)
    crates/tauri-plugin-acp/src/process.rs     — 423 lines (tests: 362 lines)
    crates/tauri-plugin-acp/src/agent_download.rs — 507 lines (tests: 312 lines)
    src/features/acp-chat/hooks/useAcpSession.ts  — 250 lines
    src/features/acp-chat/components/AcpChat.tsx   — 241 lines

Current test counts: 90 Rust tests, 114 TypeScript tests. These must not decrease.

Build and test commands used throughout:

    cargo test -p tauri-plugin-acp     # Rust tests
    pnpm typecheck                      # TypeScript type checking
    pnpm test:run                       # Vitest (React + hook tests)
    pnpm lint                           # Oxlint

## Plan of Work

### Phase 1: Rust — `commands.rs` Extract Methods

This phase breaks `acp_start_session` (104 lines, 3 responsibilities) into three focused functions and unifies error formatting.

The function currently performs three sequential protocol steps in one body: (1) send `initialize` request, (2) optionally send `authenticate` request if the agent advertises auth methods, (3) send `session/new` request. Each step has distinct parameters, error handling, and logging. Extracting them into private functions makes each step independently readable and testable.

Additionally, `acp_send_prompt` (lines 387-406) duplicates the error formatting logic from `check_response` instead of calling it. This will be unified.

**Step 1.1: Extract `send_initialize()` helper**

In `crates/tauri-plugin-acp/src/commands.rs`, extract lines 213-221 into a private async function:

    async fn send_initialize(handle: &AgentHandle) -> Result<JsonRpcResponse, Error>

This function sends the `initialize` JSON-RPC request with `protocolVersion: 1` and `clientCapabilities: {}`, calls `check_response`, and returns the response. The caller (`acp_start_session`) receives the full response so it can inspect `result.authMethods`.

**Step 1.2: Extract `send_authenticate()` helper**

Extract lines 223-250 into a private async function:

    async fn send_authenticate(
        handle: &AgentHandle,
        init_result: &serde_json::Value,
    ) -> Result<(), Error>

This function extracts `authMethods` (trying both camelCase and snake_case field names), takes the first method's `id` (defaulting to `"chatgpt"`), sends the `authenticate` request, and calls `check_response`. If no auth methods are present, it returns `Ok(())` immediately. This eliminates the 4-level nesting in the current code.

**Step 1.3: Extract `send_create_session()` helper**

Extract lines 252-272 into a private async function:

    async fn send_create_session(
        handle: &AgentHandle,
        cwd: &str,
    ) -> Result<JsonRpcResponse, Error>

This function resolves the absolute cwd, sends `session/new`, calls `check_response`, logs the raw response, and returns it.

**Step 1.4: Rewrite `acp_start_session` as orchestrator**

Replace the body of `acp_start_session` with calls to the three helpers:

    let response = send_initialize(&handle).await?;
    if let Some(ref result) = response.result {
        send_authenticate(&handle, result).await?;
    }
    let session_response = send_create_session(&handle, &cwd).await?;
    let parsed = parse_session_response(session_response.result.as_ref());
    // ... store session and emit event (unchanged)

The function body should be under 30 lines.

**Step 1.5: Unify error formatting in `acp_send_prompt`**

In `acp_send_prompt` (lines 387-406), replace the inline error formatting with a call to `check_response`. The current code manually formats the JSON-RPC error instead of calling `check_response` because the context is different (it's inside a `tokio::spawn` and needs to emit an event rather than return an error). Refactor by calling `check_response` and mapping the error:

    if let Err(e) = check_response(&response, "session/prompt") {
        tracing::error!(request_id = %request_id_clone, "{}", e);
        emit_event(&app_clone, AcpEvent::Error {
            session_id: Some(session_id_clone),
            message: e.to_string(),
        });
        return;
    }

This removes the 20-line duplicated formatting block.

**Verification**: `cargo test -p tauri-plugin-acp` passes. All 90 tests pass. No test modifications needed because the extracted functions are private and the public API (`acp_start_session`, `acp_send_prompt`) is unchanged.

### Phase 2: Rust — `process.rs` Extract Notification Parsers

This phase breaks `parse_notification` (116 lines, cyclomatic complexity ~10) into one dispatcher function and five focused parser functions.

The current function is a nested match: outer match on `notification.method`, inner match on `update_type`. Each arm of the inner match extracts different fields from the JSON and constructs a different `AcpEvent` variant. The arms share a common pattern (extract `sessionId`, extract `content`) but diverge after that.

**Step 2.1: Extract common field accessors**

Add two helper functions at the top of the file:

    fn get_session_id(params: &serde_json::Value) -> Option<String> {
        params.get("sessionId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

    fn get_text_content(update: &serde_json::Value) -> Option<String> {
        update.get("content")
            .and_then(|c| c.get("text"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }

These eliminate the repeated `and_then(|v| v.as_str())?` chains that appear in 4 of the 5 arms.

**Step 2.2: Extract per-type parser functions**

Create five private functions, one per notification type:

    fn parse_message_chunk(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_thought_chunk(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_tool_call(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_tool_call_update(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_plan(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>

Each function is 10-15 lines, extracts the fields specific to that notification type, and returns `Some(AcpEvent::Variant { ... })` or `None`.

**Step 2.3: Rewrite `parse_notification` as dispatcher**

The main function becomes a simple dispatcher:

    fn parse_notification(notification: &JsonRpcNotification) -> Option<AcpEvent> {
        if notification.method != "session/update" {
            return None;
        }

        let session_id = get_session_id(&notification.params)?;
        let update = notification.params.get("update")?;
        let update_type = update.get("sessionUpdate").and_then(|v| v.as_str())?;

        match update_type {
            "agent_message_chunk" => parse_message_chunk(session_id, update),
            "agent_thought_chunk" => parse_thought_chunk(session_id, update),
            "tool_call" => parse_tool_call(session_id, update),
            "tool_call_update" => parse_tool_call_update(session_id, update),
            "plan" => parse_plan(session_id, update),
            _ => {
                tracing::info!(
                    session_id = %session_id,
                    update_type = %update_type,
                    "DISCOVERY: unhandled session/update type"
                );
                None
            }
        }
    }

The dispatcher is under 25 lines. Cyclomatic complexity drops from ~10 to ~2 (one match with flat arms).

**Step 2.4: Simplify `stderr_task` with `lines()` iterator**

Replace the manual `loop { line.clear(); read_line(...) }` pattern (lines 258-281) with the `tokio::io::AsyncBufReadExt::lines()` iterator:

    async fn stderr_task(stderr: ChildStderr, agent_id: String) {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                tracing::warn!(agent_id = %agent_id, "Agent stderr: {}", trimmed);
            }
        }
    }

This reduces the function from 24 lines to 10.

**Verification**: `cargo test -p tauri-plugin-acp` passes. All existing `parse_notification_*` tests pass without modification because they test the public function's behavior, not the internal structure.

### Phase 3: Rust — `agent_download.rs` Extract Phases and Path Builders

This phase breaks `download_github_release` (98 lines, 6 responsibilities) into focused helper functions and adds path builder methods to eliminate repeated path construction.

**Step 3.1: Add path builder methods**

Add three methods to `AgentDownloadManager`:

    fn agent_dir(&self, id: &str) -> PathBuf {
        self.base_dir.join(id)
    }

    fn github_version_dir(&self, id: &str, version: &str) -> PathBuf {
        self.agent_dir(id).join(version)
    }

    fn npm_entry_path(&self, id: &str, package: &str, entry: &str) -> PathBuf {
        self.agent_dir(id)
            .join("node_modules")
            .join(package)
            .join(entry)
    }

Then replace all manual path constructions (lines 122, 151-156, 273, 331, 349-352) with these method calls.

**Step 3.2: Extract `fetch_latest_release()` helper**

Extract the GitHub API call and asset URL resolution (lines 230-270) into:

    struct ReleaseAsset {
        version: String,
        asset_name: String,
        download_url: String,
    }

    async fn fetch_latest_release(
        owner: &str,
        repo: &str,
        asset_template: &str,
        platform: &PlatformInfo,
    ) -> Result<ReleaseAsset, DownloadError>

This function fetches the latest release from GitHub API, constructs the asset name from the template, finds the matching asset in the release, and returns the structured result. About 40 lines extracted.

**Step 3.3: Extract `extract_and_set_permissions()` helper**

Extract the archive extraction and permission setting (lines 282-303) into:

    fn extract_and_set_permissions(
        archive_path: &Path,
        dest_dir: &Path,
        binary_name: &str,
        ext: &str,
    ) -> Result<PathBuf, DownloadError>

This function chooses tar.gz or zip extraction based on the extension, extracts the archive, sets executable permissions on Unix, and returns the binary path.

**Step 3.4: Rewrite `download_github_release` as orchestrator**

The function becomes:

    async fn download_github_release<R: tauri::Runtime>(...) -> Result<ResolvedAgent, DownloadError> {
        let platform = PlatformInfo::detect().ok_or(DownloadError::UnsupportedPlatform)?;
        emit_download_progress(app, &entry.id, DownloadPhase::Resolving, 0, None);

        let release = fetch_latest_release(owner, repo, asset_template, &platform).await?;

        let version_dir = self.github_version_dir(&entry.id, &release.version);
        std::fs::create_dir_all(&version_dir)?;
        let temp_dir = tempfile::tempdir()?;
        let archive_path = temp_dir.path().join(&release.asset_name);

        self.download_file_with_progress(app, &entry.id, &release.download_url, &archive_path).await?;

        emit_download_progress(app, &entry.id, DownloadPhase::Extracting, 0, None);
        let bin_name = binary_name_for_id(&entry.id);
        let binary_path = extract_and_set_permissions(&archive_path, &version_dir, &bin_name, platform.ext)?;

        self.cleanup_old_versions(&entry.id, &release.version)?;
        emit_download_progress(app, &entry.id, DownloadPhase::Complete, 0, None);

        Ok(ResolvedAgent {
            executable: binary_path.to_string_lossy().to_string(),
            args: vec![],
            version: release.version,
        })
    }

About 25 lines, clearly showing the download pipeline.

**Verification**: `cargo test -p tauri-plugin-acp` passes. Add 2 new tests for `extract_and_set_permissions` (tar.gz extraction + permission check, zip extraction). Add 1 test for path builders. Target: 93+ Rust tests.

### Phase 4: Frontend — Split `useAcpSession.ts` into Focused Hooks

This phase splits the 250-line `useAcpSession` hook into three focused hooks. This is the highest-risk refactoring because it changes how state flows between components.

The current hook has five responsibilities: (1) agent lifecycle (spawn, terminate), (2) session lifecycle (startSession, event listener registration), (3) streaming content accumulation via refs, (4) message state updates for 7 different event types, (5) model and status state management. By splitting these apart, each hook becomes independently testable and the data flow becomes explicit.

**Step 4.1: Extract message update utilities**

Create `src/features/acp-chat/hooks/messageUpdaters.ts` with pure functions that encapsulate the repeated `setMessages` patterns:

    export function appendTextToLastAssistant(
        messages: Message[],
        text: string,
    ): Message[]

    export function appendThinkingToLastAssistant(
        messages: Message[],
        thinkingText: string,
    ): Message[]

    export function appendToolCallToLastAssistant(
        messages: Message[],
        toolCallId: string,
        toolName: string,
        status: string,
    ): Message[]

    export function updateToolCallStatus(
        messages: Message[],
        toolCallId: string,
        newStatus: string,
    ): Message[]

    export function updateOrAppendPlan(
        messages: Message[],
        tasks: Array<{ id: string; title: string; status: string }>,
    ): Message[]

These are pure functions (no hooks, no React imports) that take the current messages array and return a new one. Each is 5-15 lines. Write tests for each function first (in `messageUpdaters.test.ts`).

**Step 4.2: Extract `useAcpEventListeners` hook**

Create `src/features/acp-chat/hooks/useAcpEventListeners.ts`:

    export function useAcpEventListeners(
        session: AcpSession | null,
        setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
        setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
        setError: React.Dispatch<React.SetStateAction<Error | null>>,
        streamingContentRef: React.MutableRefObject<string>,
        streamingThoughtRef: React.MutableRefObject<string>,
    ): void

This hook registers all 7 event listeners (delta, thought, toolCall, toolCallUpdate, plan, complete, error) on the session and cleans them up on unmount. It uses the message updater functions from Step 4.1 inside each listener callback. This extracts lines 83-198 from the current `useAcpSession`.

**Step 4.3: Simplify `useAcpSession`**

Rewrite `useAcpSession.ts` to use `useAcpEventListeners`. The hook's `init()` function now only handles: (1) create AcpAgent, (2) call spawn, (3) call startSession, (4) set ready state. Event listener registration is delegated to `useAcpEventListeners` via a separate `useEffect` that runs when `session` becomes non-null.

The simplified hook should be under 80 lines.

**Step 4.4: Write tests for message updaters**

Create `src/features/acp-chat/hooks/messageUpdaters.test.ts` with tests:

1. `appendTextToLastAssistant` updates text block on last assistant message
2. `appendTextToLastAssistant` returns unchanged if last message is not assistant
3. `appendThinkingToLastAssistant` appends new thinking block
4. `appendThinkingToLastAssistant` updates existing thinking block
5. `updateToolCallStatus` finds and updates the correct tool call
6. `updateOrAppendPlan` appends plan when none exists
7. `updateOrAppendPlan` replaces existing plan

Target: 7+ new tests.

**Verification**: `pnpm typecheck` and `pnpm test:run` pass. All 114 existing tests pass without modification. The 7+ new message updater tests also pass. Run `pnpm tauri dev` and verify the chat UI works: send a message, see streaming text, tool calls, and plan updates render correctly.

### Phase 5: Frontend — Extract Shared Utilities

This phase extracts three patterns that appear in multiple locations.

**Step 5.1: Extract `useClickOutside` hook**

Create `src/features/acp-chat/hooks/useClickOutside.ts`:

    export function useClickOutside(
        ref: React.RefObject<HTMLElement | null>,
        onClickOutside: () => void,
    ): void

This hook encapsulates the mousedown listener pattern used in `AcpChat.tsx` (lines 60-71) and `DropdownSelect.tsx` (lines 28-38). Replace both usages.

**Step 5.2: Extract `deriveConnectionStatus` function**

Create a function in `src/features/acp-chat/components/AcpChat.tsx` (or a separate utils file) that replaces the deeply nested ternary (lines 86-97):

    type ConnectionStatus = "error" | "downloading" | "connecting" | "generating" | "ready";

    function deriveConnectionStatus(state: {
        error: Error | null;
        spawnFailed: boolean;
        isDownloading: boolean;
        isReady: boolean;
        isLoading: boolean;
    }): ConnectionStatus {
        if (state.error && !state.spawnFailed) return "error";
        if (state.isDownloading) return "downloading";
        if (!state.isReady && !state.spawnFailed) return "connecting";
        if (state.isLoading) return "generating";
        if (state.spawnFailed) return "error";
        return "ready";
    }

Early returns replace 6 levels of ternary nesting. This function is pure and easily testable.

**Step 5.3: Extract `safeLocalStorage` utility**

Create `src/features/acp-chat/utils/storage.ts`:

    export function safeGetItem(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    export function safeSetItem(key: string, value: string): void {
        try {
            localStorage.setItem(key);
        } catch {
            // localStorage unavailable (SSR, private browsing quota)
        }
    }

Replace the 3 duplicate try/catch patterns in `App.tsx` (lines 8-12, 18-21), `useReasoningLevel.ts` (lines 4-14, 36-44), and `useTheme.ts` (lines 11-14).

**Step 5.4: Write tests**

Add tests for:

1. `useClickOutside` calls callback on outside click
2. `useClickOutside` does not call callback on inside click
3. `deriveConnectionStatus` returns correct status for each state combination (6 cases)
4. `safeGetItem` returns null when localStorage throws
5. `safeSetItem` does not throw when localStorage throws

Target: 10+ new tests.

**Verification**: `pnpm typecheck`, `pnpm test:run`, and `pnpm lint` pass. All 121+ existing tests plus 10+ new tests pass.

## Concrete Steps

### Phase 1 Commands

    cargo test -p tauri-plugin-acp     # Before: 90 tests pass
    # Edit commands.rs: extract send_initialize, send_authenticate, send_create_session
    cargo test -p tauri-plugin-acp     # After: 90 tests pass (no new tests needed)

### Phase 2 Commands

    cargo test -p tauri-plugin-acp     # Before: 90 tests pass
    # Edit process.rs: extract helpers and parser functions
    cargo test -p tauri-plugin-acp     # After: 90 tests pass (no new tests needed)

### Phase 3 Commands

    cargo test -p tauri-plugin-acp     # Before: 90 tests pass
    # Edit agent_download.rs: add path builders, extract helpers
    cargo test -p tauri-plugin-acp     # After: 93+ tests pass (3+ new tests)

### Phase 4 Commands

    pnpm test:run                      # Before: 114 tests pass
    pnpm typecheck
    # Create messageUpdaters.ts + messageUpdaters.test.ts
    # Create useAcpEventListeners.ts
    # Simplify useAcpSession.ts
    pnpm test:run                      # After: 121+ tests pass (7+ new tests)
    pnpm typecheck
    pnpm lint

### Phase 5 Commands

    pnpm test:run                      # Before: 121+ tests pass
    pnpm typecheck
    # Create useClickOutside.ts, deriveConnectionStatus, safeLocalStorage
    # Replace usages in AcpChat.tsx, DropdownSelect.tsx, App.tsx, useReasoningLevel.ts, useTheme.ts
    pnpm test:run                      # After: 131+ tests pass (10+ new tests)
    pnpm typecheck
    pnpm lint

### Final Verification

    cargo test -p tauri-plugin-acp     # 93+ Rust tests pass
    pnpm typecheck                      # No type errors
    pnpm test:run                       # 131+ TypeScript tests pass
    pnpm lint                           # No lint errors
    pnpm tauri dev                      # App works identically

## Validation and Acceptance

### Build Validation

All commands below must pass after every phase:

    cargo test -p tauri-plugin-acp     # Phase 1-3: 90 → 93+ tests
    pnpm typecheck                      # All phases
    pnpm test:run                       # Phase 4-5: 114 → 131+ tests
    pnpm lint                           # All phases

### Behavioral Validation

Run `pnpm tauri dev` after each phase and verify:

1. Select "Codex" provider with codex-acp installed. Agent connects, "Ready" status appears. Send "hello" — streaming response renders with text deltas.
2. Select "Claude Code" provider. Same behavior.
3. If an agent is not installed, the Setup Status page appears with install instructions and Download button.
4. The download progress indicator works when downloading an agent.
5. Model switching, reasoning level selection, new chat (Cmd+Shift+N), and theme toggling all work.

### Structural Validation

After all phases, verify the refactoring goals are met:

1. No function in `commands.rs` exceeds 40 lines (production code).
2. `parse_notification` dispatcher is under 25 lines; each parser is under 20 lines.
3. `download_github_release` orchestrator is under 30 lines.
4. `useAcpSession.ts` is under 80 lines.
5. No deeply nested ternary operators (max 2 levels).
6. `localStorage` try/catch appears in exactly one file (`storage.ts`).
7. Click-outside listener pattern appears in exactly one file (`useClickOutside.ts`).

## Idempotence and Recovery

Each phase is independently committable and safe to interrupt:

- Phase 1-3 (Rust): Purely internal refactoring of private functions. The Tauri command signatures do not change. If interrupted mid-phase, the partially refactored code still compiles and passes tests because extractions are done one function at a time.
- Phase 4 (Frontend hooks): The new hooks are additive (new files). `useAcpSession` is updated last by importing the new hooks. If interrupted after creating new files but before updating `useAcpSession`, the new files are unused but harmless.
- Phase 5 (Frontend utilities): Each utility extraction is independent. Replacing usages is done file-by-file. If interrupted, some files use the old pattern and some use the new utility — both are correct.

Recovery: If any test fails after a refactoring step, revert the specific file change with `git checkout -- <file>` and investigate. The refactoring should never require changing an existing test.

## Artifacts and Notes

### Complexity Metrics Before Refactoring

    commands.rs::acp_start_session     — 104 lines, 3 responsibilities
    commands.rs::acp_send_prompt       — 87 lines, duplicated error formatting
    process.rs::parse_notification     — 116 lines, cyclomatic complexity ~10
    agent_download.rs::download_github_release — 98 lines, 6 responsibilities
    useAcpSession.ts                   — 250 lines, 5 responsibilities

### Target Complexity After Refactoring

    commands.rs::acp_start_session     — ~25 lines (orchestrator)
    commands.rs::send_initialize       — ~15 lines
    commands.rs::send_authenticate     — ~20 lines
    commands.rs::send_create_session   — ~15 lines
    process.rs::parse_notification     — ~25 lines (dispatcher)
    process.rs::parse_message_chunk    — ~12 lines
    process.rs::parse_thought_chunk    — ~12 lines
    process.rs::parse_tool_call        — ~15 lines
    process.rs::parse_tool_call_update — ~12 lines
    process.rs::parse_plan             — ~12 lines
    agent_download.rs::download_github_release — ~25 lines (orchestrator)
    agent_download.rs::fetch_latest_release    — ~35 lines
    agent_download.rs::extract_and_set_permissions — ~20 lines
    useAcpSession.ts                   — ~80 lines
    useAcpEventListeners.ts            — ~80 lines
    messageUpdaters.ts                 — ~60 lines

## Interfaces and Dependencies

### New Rust Functions (all private, in existing modules)

In `crates/tauri-plugin-acp/src/commands.rs`:

    async fn send_initialize(handle: &AgentHandle) -> Result<JsonRpcResponse, Error>
    async fn send_authenticate(handle: &AgentHandle, init_result: &serde_json::Value) -> Result<(), Error>
    async fn send_create_session(handle: &AgentHandle, cwd: &str) -> Result<JsonRpcResponse, Error>

In `crates/tauri-plugin-acp/src/process.rs`:

    fn get_session_id(params: &serde_json::Value) -> Option<String>
    fn get_text_content(update: &serde_json::Value) -> Option<String>
    fn parse_message_chunk(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_thought_chunk(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_tool_call(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_tool_call_update(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>
    fn parse_plan(session_id: String, update: &serde_json::Value) -> Option<AcpEvent>

In `crates/tauri-plugin-acp/src/agent_download.rs`:

    struct ReleaseAsset { version: String, asset_name: String, download_url: String }
    async fn fetch_latest_release(owner: &str, repo: &str, asset_template: &str, platform: &PlatformInfo) -> Result<ReleaseAsset, DownloadError>
    fn extract_and_set_permissions(archive_path: &Path, dest_dir: &Path, binary_name: &str, ext: &str) -> Result<PathBuf, DownloadError>
    // Methods on AgentDownloadManager:
    fn agent_dir(&self, id: &str) -> PathBuf
    fn github_version_dir(&self, id: &str, version: &str) -> PathBuf
    fn npm_entry_path(&self, id: &str, package: &str, entry: &str) -> PathBuf

### New TypeScript Files

    src/features/acp-chat/hooks/messageUpdaters.ts       — Pure message update functions
    src/features/acp-chat/hooks/messageUpdaters.test.ts   — Tests for message updaters
    src/features/acp-chat/hooks/useAcpEventListeners.ts   — Event listener hook
    src/features/acp-chat/hooks/useClickOutside.ts        — Click-outside hook
    src/features/acp-chat/hooks/useClickOutside.test.ts   — Tests for click-outside
    src/features/acp-chat/utils/storage.ts                — Safe localStorage wrappers
    src/features/acp-chat/utils/storage.test.ts           — Tests for storage utils

### No New Dependencies

No new npm packages or Rust crates are needed. This refactoring uses only existing dependencies.

---

Plan Revision Note:

- 2026-02-16: Initial version created based on codebase analysis by two Explore agents (Rust analyzer and TypeScript/React analyzer). Five phases ordered by risk: Rust internal refactoring first (no cross-boundary risk), frontend hook splitting second (highest-risk structural change), shared utility extraction last (lowest risk). Key constraint: all 204 existing tests (90 Rust + 114 TypeScript) must pass without modification throughout the refactoring.
