# Dynamic ACP Agent Download and Management

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

Currently, users of tauri-acp-kit must manually install `claude-code-acp` and `codex-acp` on their system PATH before the Chat UI can connect to any agent. This means running `npm install -g @zed-industries/claude-code-acp` and downloading a GitHub release binary for codex-acp — a process that requires prior knowledge and is error-prone. If either binary is missing, the app fails silently with a cryptic "Failed to spawn process" error.

After this change, the app will automatically download, install, and manage ACP agent binaries. When a user selects an agent (e.g., "Codex" or "Claude Code") for the first time, the app downloads the correct binary for their platform, stores it in the app's data directory, and spawns it — all without the user needing to touch a terminal. If the user already has the agent installed globally, the app falls back to the PATH-based resolution (preserving current behavior). The app shows clear download progress, error states with actionable messages, and detects missing dependencies (like Node.js for claude-code-acp).

Verification method: Run `pnpm tauri dev`, select "Codex" as the provider without having `codex-acp` on PATH. The app should show a download progress indicator, download the correct binary from GitHub Releases, and then connect to the agent normally. Send "hello" and receive a streaming response. Select "Claude Code" — if Node.js is installed, it auto-installs via npm; if not, a clear error message directs the user to install Node.js.

Deliverables:

1. **Agent download manager** (Rust) — Downloads GitHub release binaries (codex-acp) and runs npm install (claude-code-acp), with platform detection, archive extraction, and version management.
2. **Agent registry** (Rust) — Defines downloadable agents, their distribution formats, and version policies. Initially hardcoded; future-proofed for ACP Registry integration.
3. **Auto-resolving agent spawn** — Modified `acp_spawn_agent` that checks the download manager before falling back to PATH.
4. **Frontend download UX** — React hook (`useAgentDownload`) and UI components for download progress, error states, and setup guidance.
5. **Setup status page** — When agents are not installed, shows a clear status page with download/install options instead of a broken empty state.

## Progress

- [x] (2026-02-16 12:40JST) Research phase completed
  - DeepWiki: Zed agent_server_store.rs patterns, agent_registry_store.rs, ACP Registry
  - DeepWiki: claude-code-acp and codex-acp distribution formats, dependencies
  - Codebase exploration: current AgentSpec, process.rs spawn flow, providers.ts
  - ACP Registry JSON fetched and analyzed (16 agents registered)
  - Agent team: UX researcher, architect, devil's advocate — all reports received
- [x] Phase 21: Setup Status Page + Error States (React)
  - [x] (2026-02-16 14:00JST) Step 21.1 + 21.2: Added `acp_check_agent_available` Rust command, TS SDK `checkAgentAvailable`, build.rs + capabilities + tests
  - [x] (2026-02-16 14:15JST) Step 21.3-21.6: AgentSetupStatus component, useAcpSession spawnFailed+retry, AcpChat integration, CSS, 10 new tests (91 total TS, 55 Rust)
- [x] Phase 18: Agent Registry + Download Manager (Rust)
  - [x] (2026-02-16 15:00JST) Step 18.1: Added Rust dependencies (reqwest, futures-util, flate2, tar, zip, sha2, tempfile)
  - [x] (2026-02-16 15:15JST) Step 18.2: Created `agent_registry.rs` with AgentDistribution, VersionPolicy, AgentRegistryEntry, PlatformInfo, default_registry(), 6 tests
  - [x] (2026-02-16 16:00JST) Step 18.3: Created `agent_download.rs` with AgentDownloadManager, AgentStatus, DownloadPhase, DownloadProgress, ResolvedAgent, DownloadError, helpers (extract_tar_gz, extract_zip, verify_sha256, detect_node, detect_npm), 19 tests (80 total Rust)
  - [x] (2026-02-16 16:30JST) Steps 18.4-18.9: Extended PluginState (download_manager, registry), added commands (acp_check_agent, acp_download_agent, acp_get_agent_registry), extended error.rs (DownloadManagerNotInitialized), updated lib.rs setup + build.rs + capabilities, 6 new state tests (86 total Rust)
- [x] Phase 19: Modified Agent Spawning Flow (Rust + TypeScript)
  - [x] (2026-02-16 16:45JST) Step 19.1: Modified acp_spawn_agent to resolve via download manager before PATH fallback, added resolve_agent_spec helper
  - [x] (2026-02-16 17:00JST) Step 19.2: Added TypeScript SDK wrappers (checkAgent, downloadAgent, getAgentRegistry), new types (AgentStatus, DownloadProgress, ResolvedAgent, AgentRegistryEntry), re-exported from index.ts
- [x] Phase 20: Frontend Download UX (TypeScript + React)
  - [x] (2026-02-16 17:15JST) Steps 20.1-20.5: Created useAgentDownload hook, DownloadProgress component, updated AgentSetupStatus (download button + isDownloading), integrated into useAcpChat + AcpChat, added download progress CSS, events.ts (onDownloadProgress + DOWNLOAD_PROGRESS_CHANNEL)
  - [x] (2026-02-16 22:40JST) Step 20.6: Tests — DownloadProgress (8), useAgentDownload (11), AgentSetupStatus download button (4), total 23 new tests (114 TS, 86 Rust)

## Surprises & Discoveries

- (2026-02-16) **ACP Registry is live and standardized.** The official ACP Registry at `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json` contains 16 agents including both claude-code-acp (v0.16.1, npx distribution) and codex-acp (v0.9.2, binary distribution with 6 platform targets). This means we do not need to hardcode GitHub release URLs or npm package names — the registry provides all download metadata in a standard format. Zed already uses this registry via `AgentRegistryStore`. However, for our initial implementation, hardcoding the two known agents is simpler and avoids the complexity of registry refresh logic.

- (2026-02-16) **codex-acp and claude-code-acp have fundamentally different distribution models.** codex-acp is a standalone Rust binary (~20MB, zero runtime dependencies) distributed via GitHub Releases with platform-specific archives. claude-code-acp is a TypeScript app (~174KB) distributed via npm that requires Node.js 18+ at runtime. This asymmetry means we need two distinct download/install strategies: HTTP download + archive extraction for codex-acp, and npm install for claude-code-acp.

- (2026-02-16) **The current architecture already supports dynamic agent paths.** `AgentProcess::spawn()` uses `Command::new(&spec.executable)` which accepts both bare names (PATH lookup) and absolute paths. The `AgentSpec` struct already has `executable: String` and `env: HashMap<String, String>` fields. No changes to the process spawning code are needed — only the path resolution before spawning.

- (2026-02-16) **Zed uses different mechanisms for each agent type.** For codex-acp, Zed downloads directly from GitHub Releases via `download_server_binary()`. For claude-code-acp, Zed uses `npm install` via its managed `NodeRuntime` (which bundles Node.js if system Node is < 22.0.0). For registry agents, Zed uses `LocalRegistryArchiveAgent` or `LocalRegistryNpxAgent` depending on the distribution type. We will implement the two core mechanisms (GitHub Release + npm install) without bundling Node.js.

- (2026-02-16) **macOS Gatekeeper does not block downloaded binaries in Zed.** DeepWiki analysis shows Zed does NOT explicitly handle Gatekeeper quarantine (`xattr -d com.apple.quarantine`). It only sets executable permissions via `chmod +x`. This suggests that for binaries downloaded by an already-signed Tauri app to its own data directory, Gatekeeper may not be an issue. This needs empirical validation in our prototype phase.

- (2026-02-16) **The ACP Registry does not include SHA-256 hashes for codex-acp.** The `sha256` field in `RegistryTargetConfig` is optional, and the actual registry.json entry for codex-acp does not include it. Zed's `download_server_binary()` does support SHA-256 verification when the digest is available from the GitHub API. For our implementation, we will attempt SHA-256 verification when available but not require it.

- (2026-02-16) **The `fix-path-env` crate already handles Node.js version manager paths.** The app's `lib.rs` calls `fix_path_env::fix()` which reads the user's shell profile and adds those paths to the process environment. This means Node.js installed via nvm, fnm, or volta should be discoverable via a simple `which node` call. No special version manager handling is needed.

- (2026-02-16) **Devil's advocate identified that a "Setup Status" page (option b) solves 80% of the UX problem with 5% of the effort.** The devil's advocate analysis calculated that full dynamic download requires 40+ hours of development and ongoing maintenance, while a setup status page with install instructions and a "check" button requires 2-4 hours. For a personal project with developer users, the simpler approach may be sufficient. However, the UX researcher noted that Zed's lazy-download approach (download on first use) provides a significantly better first-run experience. The compromise is a phased approach: start with a setup status page (Phase 21), then add actual downloading (Phase 18-19) behind it.

## Decision Log

- Decision: Implement full dynamic download with Setup Status page as interim fallback
  Rationale: While the devil's advocate correctly identifies that a setup page alone covers 80% of use cases, the goal of this project includes learning Tauri's Rust ecosystem (HTTP clients, file system APIs, async task management). The download manager is a valuable learning exercise that also provides a polished UX. The setup status page is implemented first (Phase 21) so the app is immediately usable, then the download system (Phase 18-20) enhances it.
  Date/Author: 2026-02-16 / Team lead

- Decision: Use hardcoded agent registry initially, not the ACP Registry
  Rationale: The ACP Registry at `cdn.agentclientprotocol.com` is a standardized JSON file that could replace our hardcoded agent list. However, integrating the registry adds complexity (HTTP fetch, cache management, refresh logic, schema parsing) without clear benefit for two known agents. Starting with a hardcoded registry and adding ACP Registry support later (as a future phase) is simpler and faster. The registry types are designed to be compatible with the ACP Registry schema for future migration.
  Date/Author: 2026-02-16 / Team lead (architect recommendation)

- Decision: Require system Node.js for claude-code-acp, do not bundle Node.js
  Rationale: Bundling Node.js adds ~60-80MB to app size and creates version management complexity. The target users are developers who almost certainly have Node.js installed. Zed also requires system Node.js (though it downloads its own if the version is too old). The UX researcher recommended a clear error message with a link to nodejs.org when Node.js is not found. The `fix-path-env` crate already ensures version manager paths are available.
  Date/Author: 2026-02-16 / Team lead (architect + devil's advocate consensus)

- Decision: Implement codex-acp download first, claude-code-acp second
  Rationale: codex-acp is a standalone binary with zero runtime dependencies — download, extract, run. claude-code-acp requires Node.js detection, npm install orchestration, and entry point resolution. Starting with codex-acp validates the core download infrastructure (HTTP client, archive extraction, platform detection, progress events) before adding npm complexity.
  Date/Author: 2026-02-16 / UX researcher recommendation

- Decision: Use Tauri `app_data_dir()` for agent storage, not a custom path
  Rationale: Tauri's `app_data_dir()` returns the platform-standard application data directory (macOS: `~/Library/Application Support/{bundle-id}/`, Linux: `~/.local/share/{bundle-id}/`, Windows: `%APPDATA%/{bundle-id}/`). This follows OS conventions, avoids permission issues, and is already managed by Tauri. Zed uses a similar approach (`paths::external_agents_dir()`).
  Date/Author: 2026-02-16 / Architect recommendation

- Decision: Fall back to PATH lookup when download manager fails or agent is not in registry
  Rationale: Users who have agents installed globally (via npm or manual download) should continue to work without changes. The modified `acp_spawn_agent` tries the download manager first, and falls back to `Command::new(bare_name)` if resolution fails. This is the same pattern Zed uses.
  Date/Author: 2026-02-16 / Architect recommendation

- Decision: Phase order is Setup Status → Rust Download Manager → Modified Spawn → Frontend UX
  Rationale: The setup status page (Phase 21) provides immediate value with minimal effort — users see what's missing and how to fix it. The Rust download manager (Phase 18) is the core infrastructure. Modified spawn (Phase 19) integrates the manager into the existing flow. Frontend UX (Phase 20) adds progress indicators and polish. This order ensures the app is usable at every intermediate step.
  Date/Author: 2026-02-16 / Team lead (reordered from architect's proposal based on devil's advocate feedback)

## Outcomes & Retrospective

(To be updated as phases complete)

## Context and Orientation

### Repository Structure (Relevant Files)

The Chat UI lives in `src/features/acp-chat/` within a Tauri v2 + React 19 + TypeScript application. The Tauri Rust plugin at `crates/tauri-plugin-acp/` manages agent processes and ACP protocol communication. The TypeScript SDK at `packages/tauri-acp/` wraps Tauri commands and events.

    crates/tauri-plugin-acp/src/
    ├── process.rs       # AgentProcess: spawns agents as child processes via tokio::process::Command
    ├── events.rs        # AcpEvent enum: Delta, ThoughtDelta, ToolCall, ToolCallUpdate, PlanUpdate, Complete, Error, AgentTerminated, AgentSpawned, SessionReady
    ├── commands.rs      # Tauri commands: acp_spawn_agent, acp_start_session, acp_send_prompt, acp_cancel, acp_set_model, acp_terminate_agent
    ├── protocol.rs      # AgentSpec { id, executable, args, env, cwd }, JSON-RPC types
    ├── state.rs         # PluginState: agents HashMap, sessions HashMap
    ├── framing.rs       # JsonlReader/Writer for NDJSON communication
    ├── error.rs         # Error enum with thiserror
    └── lib.rs           # Plugin registration, calls fix_path_env::fix()

    packages/tauri-acp/src/
    ├── types.ts         # AgentSpec, AcpEvent, AcpModel, SessionInfo TypeScript types
    ├── events.ts        # Event listener helpers (onAcpEvent)
    ├── session.ts       # AcpSession class (sendPrompt, cancel, setModel, onDelta, etc.)
    ├── agent.ts         # AcpAgent class (spawn, startSession, terminate, onEvent)
    └── commands.ts      # Tauri invoke wrappers (spawnAgent, startSession, etc.)

    src/features/acp-chat/
    ├── providers.ts     # PROVIDERS array with AgentSpec for claude-code-acp and codex-acp
    ├── hooks/
    │   ├── useAcpChat.ts      # Main chat logic: messages, send, reset, streaming
    │   ├── useAcpSession.ts   # Agent/session lifecycle: spawn, connect, event handlers
    │   └── useReasoningLevel.ts
    ├── components/
    │   ├── AcpChat.tsx        # Main container with header, message list, input
    │   ├── AcpChat.css        # All styles with CSS custom properties theming
    │   ├── ChatMessageList.tsx
    │   ├── ChatInput.tsx
    │   └── ...
    └── types.ts         # Message, ContentBlock, UseAcpChatOptions types

### Current Agent Spawn Flow

The current agent spawning works like this:

1. `providers.ts` defines `PROVIDERS` with hardcoded `AgentSpec` objects:
   - claude-code-acp: `{ id: "claude-code-acp", executable: "claude-code-acp", args: [] }`
   - codex-acp: `{ id: "codex-acp", executable: "codex-acp", args: [] }`

2. `useAcpSession.ts` calls `agent.spawn(options.agentSpec)` which invokes the `acp_spawn_agent` Tauri command.

3. `acp_spawn_agent` in `commands.rs` calls `AgentProcess::spawn(app, spec, agent_id)`.

4. `AgentProcess::spawn()` in `process.rs` runs `Command::new(&spec.executable)` which uses the OS PATH to find the binary.

5. `lib.rs` calls `fix_path_env::fix()` during plugin setup to ensure GUI apps on macOS/Linux have the user's shell PATH (including nvm, fnm, volta, Homebrew paths).

The `executable` field in `AgentSpec` is a bare binary name like `"codex-acp"`. The `Command::new()` call resolves it via PATH. If the binary is not on PATH, the spawn fails with `Error::ProcessSpawnFailed`.

### Agent Distribution Formats

**codex-acp** (Rust binary, zero runtime dependencies):

- GitHub Releases at `zed-industries/codex-acp`
- Archive naming: `codex-acp-{version}-{target}.{ext}`
- Platform targets:
  - macOS ARM64: `codex-acp-0.9.2-aarch64-apple-darwin.tar.gz`
  - macOS x64: `codex-acp-0.9.2-x86_64-apple-darwin.tar.gz`
  - Linux ARM64: `codex-acp-0.9.2-aarch64-unknown-linux-gnu.tar.gz`
  - Linux x64: `codex-acp-0.9.2-x86_64-unknown-linux-gnu.tar.gz`
  - Windows ARM64: `codex-acp-0.9.2-aarch64-pc-windows-msvc.zip`
  - Windows x64: `codex-acp-0.9.2-x86_64-pc-windows-msvc.zip`
- Binary size: ~20-26MB per platform
- Download URL pattern: `https://github.com/zed-industries/codex-acp/releases/download/v{version}/codex-acp-{version}-{arch}-{os}.{ext}`

**claude-code-acp** (TypeScript, requires Node.js 18+):

- npm package: `@zed-industries/claude-code-acp`
- Entry point: `dist/index.js` (ES Module)
- Package size: ~174KB
- Requires: Node.js 18+, npm
- Runtime command: `node dist/index.js`

### ACP Registry (Reference)

The official ACP Registry at `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json` contains standardized metadata for all ACP agents. The format is:

    {
      "version": "1.0.0",
      "agents": [
        {
          "id": "codex-acp",
          "name": "Codex CLI",
          "version": "0.9.2",
          "description": "ACP adapter for OpenAI's coding assistant",
          "repository": "https://github.com/zed-industries/codex-acp",
          "icon": "https://cdn.agentclientprotocol.com/registry/v1/latest/codex-acp.svg",
          "distribution": {
            "binary": {
              "darwin-aarch64": {
                "archive": "https://github.com/.../codex-acp-0.9.2-aarch64-apple-darwin.tar.gz",
                "cmd": "./codex-acp"
              },
              ...
            }
          }
        },
        {
          "id": "claude-code-acp",
          "name": "Claude Code",
          "version": "0.16.1",
          "distribution": {
            "npx": {
              "package": "@zed-industries/claude-code-acp@0.16.1"
            }
          }
        }
      ]
    }

This registry is not used in the initial implementation but the agent registry types are designed for future compatibility.

### Zed's Implementation (Reference)

Zed's agent download system is in `crates/project/src/agent_server_store.rs` (~500+ lines). Key patterns:

- `ExternalAgentServer` trait with `get_command()` method that returns the command to execute the agent
- `LocalCodex`: Downloads from GitHub Releases, stores in `external_agents/codex-acp/{version}/`, SHA-256 verification
- `LocalClaudeCode`: Uses `get_or_npm_install_builtin_agent()` with managed npm install
- Platform detection: `get_platform_info()` returns (arch, os, ext) tuple
- Fallback: If download fails, uses latest locally-cached version
- Version cleanup: Removes old version directories after successful download

## Implementation Rules

The following rules apply to all implementation work across every phase.

### Rule 1: TDD Workflow

All implementation across every phase must use the `tdd-workflow` skill (Kent Beck's canonical 5-step cycle: Test List → Write Test → Make Pass → Refactor → Repeat). When writing new code in each step (Step 21.1, 18.2, etc.), first write a failing test (Red), then write the minimum implementation to make it pass (Green), then refactor (Refactor). Test file naming and directory structure must follow existing project conventions:

- Rust tests: `#[cfg(test)] mod tests` blocks within the target module, or integration tests under `crates/tauri-plugin-acp/tests/`
- TypeScript/React tests: `*.test.ts` / `*.test.tsx` co-located with the target file

### Rule 2: Operational Requirements

1. **Self-containment**: All descriptions within the ExecPlan must be self-contained. Do not reference external links. Embed all necessary knowledge in your own words directly in the ExecPlan.
2. **Accurate path references**: File paths, function names, and module names must be specified accurately relative to the repository root. Explicitly identify the exact locations to be edited.
3. **Idempotence and recovery**: Maintain rollback and retry procedures in the ExecPlan that satisfy the conditions in the "Idempotence and Recovery" section.
4. **Prototyping**: When prototyping is required, explicitly label it as "prototyping" and document the acceptance criteria and observation procedures in the ExecPlan.
5. **Commit granularity**: Commit frequently at safe granularity. After each commit, update the Progress section and all related sections before proceeding to the next step.
6. **Updates on work stoppage**: Every time work is paused or stopped, the following ExecPlan sections must be brought up to date before ending the session. Batch-updating these sections after the fact is prohibited:
   - Progress
   - Surprises & Discoveries
   - Decision Log
   - Concrete Steps
   - Validation and Acceptance

## Plan of Work

### Phase 21: Setup Status Page (Frontend-Only, Immediate Value)

This phase adds an agent availability check and setup guidance UI. It does not download anything — it checks if agents are on PATH and shows instructions if they're missing. This provides immediate value while the download system is being built.

The setup page appears in the chat area when an agent fails to spawn. Instead of a cryptic error, users see: which agents are available, which are missing, and how to install them.

**Step 21.1: Add `acp_check_agent_available` command (Rust)**

In `crates/tauri-plugin-acp/src/commands.rs`, add a command that checks if a binary is available on PATH by attempting to run it with `--version` or simply checking `which`:

    #[tauri::command]
    pub async fn acp_check_agent_available(
        executable: String,
    ) -> Result<bool, Error> {
        // Try: which {executable} (Unix) or where {executable} (Windows)
        let which_cmd = if cfg!(windows) { "where" } else { "which" };
        let output = tokio::process::Command::new(which_cmd)
            .arg(&executable)
            .output()
            .await;
        Ok(output.map(|o| o.status.success()).unwrap_or(false))
    }

Register this command in `lib.rs`.

**Step 21.2: Add `checkAgentAvailable` to TypeScript SDK**

In `packages/tauri-acp/src/commands.ts`, add:

    export async function checkAgentAvailable(executable: string): Promise<boolean> {
      return invoke<boolean>("plugin:acp|acp_check_agent_available", { executable });
    }

Re-export from `packages/tauri-acp/src/index.ts`.

**Step 21.3: Create `AgentSetupStatus` component**

In `src/features/acp-chat/components/AgentSetupStatus.tsx`, create a component that shows agent availability status and install instructions. When an agent is not available, show the provider name, its status (available or missing), and platform-specific install commands with a copy-to-clipboard button.

For codex-acp missing:

    Setting up Codex

    codex-acp is not installed. Download it from GitHub:

    [macOS/Linux]
    curl -L https://github.com/zed-industries/codex-acp/releases/latest/download/codex-acp-{version}-{arch}.tar.gz | tar xz
    chmod +x codex-acp && mv codex-acp /usr/local/bin/

    [Copy Command]   [Check Again]

For claude-code-acp missing:

    Setting up Claude Code

    claude-code-acp is not installed. Install it via npm:

    npm install -g @zed-industries/claude-code-acp

    [Copy Command]   [Check Again]

If Node.js is not found, show that message first.

**Step 21.4: Integrate into `useAcpSession`**

Modify `useAcpSession.ts` to catch spawn failures and expose an `agentAvailable` state. When spawn fails with `ProcessSpawnFailed`, set `agentAvailable: false` and show the setup status component instead of the generic error.

**Step 21.5: Add CSS for setup status**

Add styles for `.agent-setup-status` to `AcpChat.css` using existing CSS custom properties for theming.

**Step 21.6: Tests**

Test that `AgentSetupStatus` renders install instructions for each agent type. Test the copy-to-clipboard button. Test that the component shows the correct instructions based on the platform.

Verification: `pnpm typecheck` and `pnpm test:run` pass. `cargo test -p tauri-plugin-acp` passes. Start the app with `codex-acp` not on PATH — see the setup status page with install instructions. Install codex-acp, click "Check Again" — the app connects normally.

### Phase 18: Agent Registry + Download Manager (Rust)

This phase implements the core Rust infrastructure for downloading and managing agent binaries. After this phase, the Rust plugin can resolve agent binaries from a managed directory, download them from GitHub Releases (codex-acp) or npm (claude-code-acp), and report progress to the frontend.

**Step 18.1: Add Rust dependencies**

In `crates/tauri-plugin-acp/Cargo.toml`, add:

    reqwest = { version = "0.12", features = ["stream", "json"] }
    futures-util = "0.3"
    flate2 = "1"
    tar = "0.4"
    zip = "2"
    sha2 = "0.10"
    tempfile = "3"

These provide: HTTP client with streaming (reqwest), stream utilities (futures-util), tar.gz extraction (flate2 + tar), zip extraction (zip), SHA-256 hashing (sha2), and temporary directories for downloads (tempfile).

**Step 18.2: Create `agent_registry.rs`**

Create `crates/tauri-plugin-acp/src/agent_registry.rs` with:

- `AgentDistribution` enum: `GithubRelease { owner, repo, asset_template }` and `NpmPackage { package_name, entry_point }`
- `VersionPolicy` enum: `Latest` and `Pinned(String)`
- `AgentRegistryEntry` struct: `{ id, label, distribution, version_policy }`
- `PlatformInfo` struct with `detect()` method: returns `{ arch, os, ext }` based on `std::env::consts::{ARCH, OS}`
- `default_registry()` function: returns a `Vec<AgentRegistryEntry>` with codex-acp and claude-code-acp entries

Platform detection maps:

- `aarch64` + `macos` → `("aarch64", "apple-darwin", "tar.gz")`
- `x86_64` + `macos` → `("x86_64", "apple-darwin", "tar.gz")`
- `aarch64` + `linux` → `("aarch64", "unknown-linux-gnu", "tar.gz")`
- `x86_64` + `linux` → `("x86_64", "unknown-linux-gnu", "tar.gz")`
- `aarch64` + `windows` → `("aarch64", "pc-windows-msvc", "zip")`
- `x86_64` + `windows` → `("x86_64", "pc-windows-msvc", "zip")`

**Step 18.3: Create `agent_download.rs`**

Create `crates/tauri-plugin-acp/src/agent_download.rs` with `AgentDownloadManager`:

- `new(app_data_dir: PathBuf)`: initializes with base path `{app_data_dir}/agents/`, creates directory if needed
- `check_status(entry) -> AgentStatus`: checks if agent binary exists on disk
- `resolve_executable(app, entry) -> Result<ResolvedAgent>`: downloads if needed, returns absolute path
- `download_github_release(app, entry, ...) -> Result<ResolvedAgent>`: fetches latest version from GitHub API, downloads archive, extracts, sets permissions
- `install_npm_package(app, entry, ...) -> Result<ResolvedAgent>`: detects Node.js, runs npm install, resolves entry point
- `download_file_with_progress(app, agent_id, url, dest)`: streams download with Tauri event progress reporting
- `cleanup_old_versions(agent_id, current_version)`: removes old version directories
- `detect_node() -> Result<String>`: finds Node.js on the system
- `detect_npm() -> Result<String>`: finds npm on the system

Helper functions:

- `extract_tar_gz(archive, dest)`: using flate2 + tar crates
- `extract_zip(archive, dest)`: using zip crate
- `verify_sha256(file, expected)`: using sha2 crate
- `emit_download_progress(app, agent_id, phase, bytes, total)`: emits `acp://download-progress` Tauri event

`AgentStatus` is a tagged enum:

- `NotInstalled`
- `Downloading { progress: f64 }`
- `Installed { version: String, executable_path: String }`
- `Failed { error: String }`

`DownloadPhase` is: `Resolving`, `Downloading`, `Verifying`, `Extracting`, `Complete`, `Failed`.

`ResolvedAgent` contains: `executable: String`, `args: Vec<String>`, `version: String`.

Storage layout:

- codex-acp: `{app_data_dir}/agents/codex-acp/{version}/codex-acp`
- claude-code-acp: `{app_data_dir}/agents/claude-code-acp/node_modules/@zed-industries/claude-code-acp/dist/index.js`

**Step 18.4: Extend PluginState**

In `state.rs`, add `download_manager: Arc<RwLock<Option<AgentDownloadManager>>>` and `registry: Arc<RwLock<Vec<AgentRegistryEntry>>>` to `PluginState`. Add `init_download_manager()` method.

**Step 18.5: Add new Tauri commands**

In `commands.rs`, add:

- `acp_check_agent(agent_id) -> AgentStatus`: checks if agent is downloaded
- `acp_download_agent(agent_id) -> ResolvedAgent`: triggers download, returns resolved path
- `acp_get_agent_registry() -> Vec<AgentRegistryEntry>`: returns the agent list

**Step 18.6: Extend error types**

In `error.rs`, add: `UnsupportedPlatform`, `DownloadManagerNotInitialized`, `HttpError`, `HashMismatch`, `UnsupportedArchive`, `NodeNotFound`, `NpmNotFound`, `NpmInstallFailed`, `EntryPointNotFound`, `GithubApiError`.

**Step 18.7: Update plugin setup**

In `lib.rs`, register the new commands and call `state.init_download_manager(app)` in the plugin setup closure.

**Step 18.8: Update capabilities**

In `src-tauri/capabilities/default.json`, add permissions for the three new commands.

**Step 18.9: Unit tests**

Write tests for:

1. `PlatformInfo::detect()` returns correct values for current platform
2. `default_registry()` returns entries for both agents
3. `AgentDownloadManager::check_status()` returns `NotInstalled` for non-existent paths
4. `AgentDownloadManager::check_status()` returns `Installed` for existing paths
5. `extract_tar_gz()` correctly extracts a test archive
6. `extract_zip()` correctly extracts a test archive
7. `verify_sha256()` passes for matching hashes, fails for mismatching
8. `detect_node()` returns a path or NodeNotFound error
9. GitHub release URL construction matches expected format

Target: 15+ new tests.

Verification: `cargo test -p tauri-plugin-acp` passes with all new tests. `cargo build` succeeds with new dependencies. The download manager can be exercised via the `acp_download_agent` command.

### Phase 19: Modified Agent Spawning Flow (Rust + TypeScript)

This phase modifies the agent spawning flow to automatically resolve executables from the download manager before falling back to PATH lookup.

**Step 19.1: Modify `acp_spawn_agent`**

In `commands.rs`, modify `acp_spawn_agent` to:

1. Check if `spec.executable` is an absolute path — if so, use as-is (custom override)
2. Look up the agent in the registry by `spec.id`
3. If found, call `download_manager.resolve_executable()` to get the absolute path
4. If resolution fails, log a warning and fall back to the original bare name (PATH lookup)
5. Construct a new `AgentSpec` with the resolved executable and any additional args

For claude-code-acp, the resolved `AgentSpec` becomes:

- `executable: "/usr/local/bin/node"` (or wherever Node.js is)
- `args: ["{app_data_dir}/agents/claude-code-acp/node_modules/@zed-industries/claude-code-acp/dist/index.js"]`

**Step 19.2: Update TypeScript SDK**

In `packages/tauri-acp/src/commands.ts`, add the new command wrappers: `checkAgent()`, `downloadAgent()`, `getAgentRegistry()`, `onDownloadProgress()`. Re-export all new types.

**Step 19.3: Integration test**

Write an integration test that:

1. Creates a temp directory as mock app_data_dir
2. Constructs an `AgentDownloadManager` pointing to that directory
3. Places a fake binary in the expected location
4. Verifies `resolve_executable()` returns the correct absolute path
5. Verifies the returned args are correct for npm packages (node + entry point)

Verification: `cargo test -p tauri-plugin-acp` passes. `pnpm typecheck` passes. Start the app with codex-acp not on PATH but downloaded via the manager — the agent spawns successfully.

### Phase 20: Frontend Download UX (React)

This phase adds the frontend hooks and UI components for download progress, error states, and setup guidance.

**Step 20.1: Create `useAgentDownload` hook**

In `src/features/acp-chat/hooks/useAgentDownload.ts`, create a hook that:

- Checks agent status on mount via `checkAgent()`
- Listens for `acp://download-progress` events
- Provides `download()` function that triggers the Rust download
- Exposes: `status`, `progress`, `download()`, `isReady`, `error`

**Step 20.2: Integrate download into session initialization**

Modify `useAcpSession.ts` to use `useAgentDownload`:

- Before spawning, check if agent is installed
- If not installed, trigger download automatically
- Show download progress in the status lifecycle (new status: "downloading")
- After download completes, proceed with spawn

**Step 20.3: Create `DownloadProgress` component**

In `src/features/acp-chat/components/DownloadProgress.tsx`, create a component that displays in the chat area's empty state during download. Shows: agent name, download phase, progress bar (if total bytes known), or spinner.

**Step 20.4: Enhance `AgentSetupStatus` with download button**

Update the setup status component (from Phase 21) to include a "Download" button that triggers the automatic download instead of only showing manual instructions.

**Step 20.5: Update status lifecycle**

Add new status states to the header display:

- `checking` — "Checking {provider}..." (during availability check)
- `downloading` — "Downloading {provider}..." with progress
- `installing` — "Installing {provider}..." (for npm install)
- `connecting` — "Connecting to {provider}..." (existing)
- `ready` — "Ready" (existing)

**Step 20.6: Tests**

Write tests for:

1. `useAgentDownload` returns correct initial status
2. `useAgentDownload` calls checkAgent on mount
3. `DownloadProgress` renders progress bar with percentage
4. `DownloadProgress` renders spinner when total bytes unknown
5. Setup status shows download button
6. Download button triggers downloadAgent call
7. Status lifecycle transitions correctly: checking → downloading → connecting → ready

Target: 10+ new tests.

Verification: `pnpm typecheck` and `pnpm test:run` pass. Start the app without agents installed — see download progress UI. After download completes, agent connects normally.

## Concrete Steps

### Phase 21 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After Rust changes:
    cargo test -p tauri-plugin-acp
    cargo build

    # After TypeScript SDK + React changes:
    pnpm typecheck
    pnpm test:run
    pnpm lint

    # Visual verification:
    pnpm tauri dev
    # Remove codex-acp from PATH temporarily
    # Select "Codex" provider → see setup status page with instructions
    # Click "Check Again" after installing → agent connects

### Phase 18 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After adding Rust dependencies:
    cargo build

    # After creating agent_registry.rs and agent_download.rs:
    cargo test -p tauri-plugin-acp
    cargo build

    # Manual verification of GitHub API:
    curl -s https://api.github.com/repos/zed-industries/codex-acp/releases/latest | jq '.tag_name, .assets[].name'

### Phase 19 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After Rust changes:
    cargo test -p tauri-plugin-acp
    cargo build

    # After TypeScript SDK changes:
    cd packages/tauri-acp && pnpm typecheck && cd ../..

    # After React changes:
    pnpm typecheck
    pnpm test:run

    # Integration verification:
    pnpm tauri dev
    # Ensure codex-acp is NOT on PATH
    # Select "Codex" provider → agent auto-downloads and connects
    # Check app data directory for downloaded binary:
    ls ~/Library/Application\ Support/com.sotayamashita.tauri-acp-kit/agents/codex-acp/

### Phase 20 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    pnpm typecheck
    pnpm test:run
    pnpm lint

    # Visual verification:
    pnpm tauri dev
    # Test: download progress for codex-acp
    # Test: Node.js not found error for claude-code-acp (if applicable)
    # Test: successful auto-download and connection

## Validation and Acceptance

### Build Validation

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit
    cargo test -p tauri-plugin-acp    # Expect: 65+ tests pass (existing + new)
    cargo build                        # Expect: No errors
    pnpm typecheck                     # Expect: No type errors
    pnpm test:run                      # Expect: 90+ tests pass (existing + new)
    pnpm lint                          # Expect: No lint errors

### Runtime Validation

With `pnpm tauri dev` running:

1. **Setup status (no agents)**: Remove agents from PATH. Select "Codex" → setup status page shows install instructions and "Download" button.
2. **Auto-download (codex-acp)**: Click "Download" → progress indicator shows phase transitions (resolving → downloading → extracting → complete). After completion, agent connects and "Ready" status appears.
3. **Chat works after download**: Send "hello" → streaming text response from codex-acp.
4. **Cached launch**: Quit and restart app. Select "Codex" → agent connects immediately (no re-download).
5. **PATH fallback**: Install codex-acp on PATH. Remove from app data dir. Select "Codex" → falls back to PATH-based resolution, agent connects.
6. **Claude Code with Node.js**: With Node.js installed, select "Claude Code" → npm install runs, agent connects.
7. **Claude Code without Node.js**: Without Node.js, select "Claude Code" → clear error: "Node.js 18+ required" with link to nodejs.org.
8. **Network error**: Disconnect network. Try to download → clear error message with retry button.

### Storage Validation

After successful download:

    ls ~/Library/Application\ Support/com.sotayamashita.tauri-acp-kit/agents/codex-acp/
    # Expected: version directory (e.g., 0.9.2/) containing codex-acp binary

    file ~/Library/Application\ Support/com.sotayamashita.tauri-acp-kit/agents/codex-acp/0.9.2/codex-acp
    # Expected: Mach-O 64-bit executable arm64 (on Apple Silicon)

## Idempotence and Recovery

Each phase maintains a buildable, testable state. If a phase is interrupted:

- Phase 21: Setup status page is purely additive UI. If interrupted, the app still works for users with agents on PATH. The setup page only appears on spawn failure.
- Phase 18: The download manager is a new module with no dependencies on existing code. If interrupted, the existing spawn flow continues to work. Partially downloaded files are stored in temp directories (via `tempfile` crate) and cleaned up automatically.
- Phase 19: The modified `acp_spawn_agent` falls back to PATH lookup if the download manager fails. This means even a buggy download manager won't break existing functionality.
- Phase 20: Frontend UX is additive. The download hook is optional — if it fails, the setup status page (Phase 21) still provides install instructions.

Recovery for partially downloaded agents:

- The download manager uses temp directories for in-progress downloads. If the app crashes during download, no partial files are left in the agent directory.
- If extraction fails, the version directory is not created, so the next attempt re-downloads.
- Old versions are cleaned up only after a successful download of a new version.

## Artifacts and Notes

### Research Sources — Detailed Log

All research was conducted on 2026-02-16 during the ExecPlan authoring session.

#### DeepWiki MCP Queries

1. **ACP Agent Distribution (claude-code-acp + codex-acp)**
   - Tool: `mcp__deepwiki__ask_question`
   - Repos: `["zed-industries/claude-code-acp", "zed-industries/codex-acp"]`
   - Query: Distribution formats, dependencies, platform support, versioning
   - Key findings: codex-acp is standalone Rust binary (GitHub Releases, 6 platforms). claude-code-acp is TypeScript npm package requiring Node.js 18+. Both use NDJSON over stdin/stdout.

2. **Zed Agent Download Mechanism**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/zed`
   - Query: Dynamic agent download, storage, versioning, platform detection
   - Key findings: `agent_server_store.rs` with `ExternalAgentServer` trait. `LocalCodex` downloads from GitHub Releases. `LocalClaudeCode` uses npm install via `NodeRuntime`. Storage in `~/Library/Application Support/Zed/external_agents/`.

3. **Zed agent_server_store.rs Implementation Details**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/zed`
   - Query: ExternalAgentServer trait, get_command, platform detection, download_server_binary
   - Key findings: `get_or_npm_install_builtin_agent()` for claude-code-acp (minimum version 0.5.2). `get_platform_info()` for platform detection. SHA-256 verification. npm install to managed directory.

4. **codex-acp Binary Distribution Format**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/codex-acp`
   - Query: npm package structure, platform-specific packages, GitHub release naming
   - Key findings: npm wrapper at `bin/codex-acp.js` detects OS/arch. GitHub release archives: `codex-acp-{version}-{target}.tar.gz/.zip`. 6 platform packages as optionalDependencies.

5. **ACP Registry**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/zed`
   - Query: ACP Registry structure, types, URL, agent registration
   - Key findings: Registry URL `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`. Contains 16 agents. Two distribution types: `binary` (platform archives) and `npx` (npm packages). `AgentRegistryStore` handles fetch, cache, refresh.

6. **Zed Gatekeeper/Binary Security**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/zed`
   - Query: macOS Gatekeeper handling, binary permissions, code signing
   - Key findings: Zed does NOT strip Gatekeeper quarantine. Only sets chmod +x. No code signing of downloaded binaries. Signing is only for the main app bundle.

7. **ACP Registry Schema Details**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/zed`
   - Query: RegistryIndex, RegistryEntry, RegistryTargetConfig struct definitions
   - Key findings: `RegistryDistribution` has `binary` (HashMap of target → archive config) and `npx` (package + args) variants. SHA-256 is optional in target config.

#### WebFetch Queries

8. **ACP Registry JSON (Live)**
   - Tool: `WebFetch`
   - URL: `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`
   - Key findings: 16 registered agents. codex-acp v0.9.2 (binary, 6 platforms). claude-code-acp v0.16.1 (npx `@zed-industries/claude-code-acp@0.16.1`). No SHA-256 hashes for codex-acp.

#### Codebase Exploration

9. **Current Agent Spawn Implementation**
   - Tools: Read (process.rs, commands.rs, protocol.rs, providers.ts, agent.ts)
   - Key findings: `AgentSpec { id, executable, args, env, cwd }`. `Command::new(&spec.executable)` with PATH lookup. `fix_path_env::fix()` ensures shell PATH. No download/registry logic exists.

### Agent Team Contributions — Detailed Record

Team name: `acp-dynamic-download`. Spawned 2026-02-16. Six agents ran with distinct research and analysis mandates.

#### Zed Researcher (`zed-researcher`)

- **Task**: Deep analysis of Zed's agent download mechanism
- **Tools used**: DeepWiki (zed-industries/zed, claude-code-acp, codex-acp)
- **Key deliverables**: Three distinct download systems (npm, GitHub Release, ACP Registry). Exact code paths in agent_server_store.rs. Platform detection mapping. Storage directory structure. Error handling patterns. Agent lifecycle flow.

#### Binary Researcher (`binary-researcher`)

- **Task**: Analyze agent binary distribution and requirements
- **Tools used**: DeepWiki (claude-code-acp, codex-acp), npm registry
- **Key deliverables**: Complete comparison table of both agents. Distribution formats, platform support (8 targets for codex-acp). Dependency analysis (Node.js for claude-code-acp, none for codex-acp). ACP protocol communication details.

#### Codebase Researcher (`codebase-researcher`)

- **Task**: Analyze current tauri-acp-kit agent spawning mechanism
- **Tools used**: Read (all relevant Rust and TypeScript files)
- **Key deliverables**: Full architecture flow diagram. Key finding: `AgentSpec.executable` already supports absolute paths — no Rust spawn changes needed. `fix-path-env` handles version manager paths. Plugin state is purely runtime, no registry.

#### UX Researcher (`ux-researcher`)

- **Task**: Analyze UX implications of dynamic agent downloading
- **Tools used**: Read (all component + CSS files), DeepWiki (Zed docs), WebFetch (Zed blog posts)
- **Key deliverables**: Lazy-download approach recommendation. ASCII wireframes for download progress and error states. Node.js dependency UX analysis. Phase prioritization: codex-acp first, claude-code-acp second. 3-phase implementation priority list.

#### Architect (`architect`)

- **Task**: Design technical architecture for download system
- **Tools used**: Read (all Rust + TypeScript source), DeepWiki (Zed, codex-acp, claude-code-acp)
- **Key deliverables**: Complete architectural design with module definitions, function signatures, data flow diagrams, storage layout, dependency list, state management, capabilities config. 13 file changes identified.

#### Devil's Advocate (`devils-advocate`)

- **Task**: Challenge assumptions, identify risks, propose alternatives
- **Tools used**: Read (process.rs, events.rs, providers.ts, state.rs), DeepWiki (claude-code-acp, codex-acp)
- **Key deliverables**: Complexity-vs-value analysis (40+ hours dev time). Security risk matrix (supply chain, Gatekeeper, antivirus). Node.js dependency hell scenarios. Top 10 failure scenarios. 6 alternatives ranked by effort. "Setup Status page" as minimum viable alternative (2-4 hours).

## Interfaces and Dependencies

### New Rust Types

In `crates/tauri-plugin-acp/src/agent_registry.rs`:

    pub enum AgentDistribution {
        GithubRelease { owner: String, repo: String, asset_template: String },
        NpmPackage { package_name: String, entry_point: String },
    }

    pub enum VersionPolicy {
        Latest,
        Pinned(String),
    }

    pub struct AgentRegistryEntry {
        pub id: String,
        pub label: String,
        pub distribution: AgentDistribution,
        pub version_policy: VersionPolicy,
    }

    pub struct PlatformInfo {
        pub arch: &'static str,
        pub os: &'static str,
        pub ext: &'static str,
    }

In `crates/tauri-plugin-acp/src/agent_download.rs`:

    pub enum AgentStatus {
        NotInstalled,
        Downloading { progress: f64 },
        Installed { version: String, executable_path: String },
        Failed { error: String },
    }

    pub enum DownloadPhase {
        Resolving, Downloading, Verifying, Extracting, Complete, Failed,
    }

    pub struct DownloadProgress {
        pub agent_id: String,
        pub bytes_downloaded: u64,
        pub total_bytes: Option<u64>,
        pub phase: DownloadPhase,
    }

    pub struct ResolvedAgent {
        pub executable: String,
        pub args: Vec<String>,
        pub version: String,
    }

    pub struct AgentDownloadManager { ... }

### New TypeScript Types

In `packages/tauri-acp/src/types.ts`:

    export type AgentStatus =
      | { status: "not_installed" }
      | { status: "downloading"; progress: number }
      | { status: "installed"; version: string; executable_path: string }
      | { status: "failed"; error: string };

    export interface DownloadProgress {
      agent_id: string;
      bytes_downloaded: number;
      total_bytes: number | null;
      phase: "resolving" | "downloading" | "verifying" | "extracting" | "complete" | "failed";
    }

    export interface ResolvedAgent {
      executable: string;
      args: string[];
      version: string;
    }

### New React Components

    src/features/acp-chat/
    ├── components/
    │   ├── AgentSetupStatus.tsx    # NEW: Setup guidance when agent not available
    │   └── DownloadProgress.tsx    # NEW: Download progress indicator
    └── hooks/
        └── useAgentDownload.ts    # NEW: Agent download status and actions

### New Rust Dependencies

    reqwest 0.12       # HTTP client with streaming
    futures-util 0.3   # Stream utilities (StreamExt::try_next)
    flate2 1           # gzip decompression
    tar 0.4            # tar archive extraction
    zip 2              # zip archive extraction
    sha2 0.10          # SHA-256 hashing
    tempfile 3         # Temporary directories for downloads

No new npm packages required. The frontend uses existing react, @tauri-apps/api, and lucide-react dependencies.

## Implementation Prompt

The following prompt is used to start each implementation session. Copy and paste the entire block when beginning work on a phase.

---

**Prompt: begin**

```
You are implementing the "Dynamic ACP Agent Download and Management" feature for tauri-acp-kit. Your authoritative source of truth is:

  .agents/plans/2026-02-16-dynamic-agent-download.md

Read the entire ExecPlan before doing anything. Every instruction, type definition, file path, function signature, and verification command you need is already embedded in the plan. Do not invent requirements or consult external sources — the plan is self-contained by design.

## What to do

1. Read the ExecPlan fully.
2. Check the "Progress" section to determine which phase/step is next.
3. Implement that step using the `tdd-workflow` skill:
   - Build the Test List for the step.
   - For each item: Write a failing test → Make it pass with minimum code → Refactor.
   - Run the verification commands listed in "Concrete Steps" for the current phase after each cycle.
4. After the step is green and verified, commit at a safe granularity with a Conventional Commit message.
5. Immediately update the ExecPlan:
   - "Progress": mark the step done with date and a one-line summary.
   - "Surprises & Discoveries": record anything unexpected.
   - "Decision Log": record any design choices made during implementation.
   - "Concrete Steps": adjust remaining commands if needed.
   - "Validation and Acceptance": update expected counts if tests were added/removed.
6. Repeat from step 2 until the phase is complete.

## Phase execution order

Phase 21 → Phase 18 → Phase 19 → Phase 20

Within each phase, execute steps in numerical order (e.g., 21.1 → 21.2 → … → 21.6).

## Mandatory constraints

- TDD is not optional. Every new function, command, component, and hook must have a test written first.
- Never modify existing tests to make them pass — fix the production code instead.
- All file paths in the plan are relative to the repository root. Use them exactly as written.
- Run verification commands (`cargo test`, `pnpm typecheck`, `pnpm test:run`, `pnpm lint`) after every step, not just at the end of a phase.
- If a verification command fails, fix the issue before moving on. Do not skip failures.
- If you encounter something not covered by the plan, record it in "Surprises & Discoveries", make a decision, record it in "Decision Log", and continue.
- When you stop working (whether the phase is complete or not), update all living sections of the ExecPlan before ending. Batch-updating after the fact is prohibited.
- Commit messages must follow Conventional Commits: `feat(acp):`, `test(acp):`, `refactor(acp):`, etc.
- Do not add features, refactor surrounding code, or make improvements beyond what the plan specifies.

## Context you will need

The ExecPlan contains:

- "Context and Orientation": repository structure, current spawn flow, agent distribution formats, Zed reference implementation, ACP Registry schema.
- "Interfaces and Dependencies": exact Rust type definitions, TypeScript type definitions, new React component paths, and new Rust crate dependencies.
- "Plan of Work": step-by-step instructions for each phase with code snippets and expected behavior.
- "Concrete Steps": shell commands to run for verification at each phase.
- "Validation and Acceptance": build validation commands and runtime validation scenarios.
- "Idempotence and Recovery": how to recover from interruptions at each phase boundary.

## Starting

Read the plan now:

  @.agents/plans/2026-02-16-dynamic-agent-download.md

Then check "Progress" and begin the next incomplete step.
```

**Prompt: end**

---

Plan Revision Note:

- 2026-02-16: Initial version created based on agent team research (UX researcher, architect, devil's advocate, zed researcher, binary researcher, codebase researcher), DeepWiki analysis (Zed agent_server_store.rs, agent_registry_store.rs, claude-code-acp, codex-acp), and ACP Registry analysis. Phase order chosen to provide immediate value (Setup Status page first) while building toward full dynamic download. Key decisions: hardcoded registry initially, system Node.js required, codex-acp first, app_data_dir for storage, PATH fallback preserved.
- 2026-02-16: Added "Implementation Rules" section (Rule 1: TDD Workflow, Rule 2: Operational Requirements) and "Implementation Prompt" section for session bootstrapping.
