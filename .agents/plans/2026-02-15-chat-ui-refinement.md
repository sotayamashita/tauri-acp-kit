# Refine Chat UI to Professional Coding Agent Standard

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

The current Chat UI (`src/features/acp-chat/`) provides basic send-and-receive functionality with streaming text, model selection, and provider switching. It works, but it feels like a prototype: it only renders plain text and markdown, cannot visualize tool calls, thinking/reasoning blocks, or plans, uses a single flat color scheme without dark mode, and lacks the polish of professional tools like Cursor, Zed, or VS Code Copilot Chat.

After this change, the Chat UI will render rich, structured messages that include collapsible thinking/reasoning blocks, tool call cards with status indicators (pending, running, completed, failed), and plan task lists. The visual design will support both light and dark themes via CSS custom properties, use refined typography and spacing inspired by professional coding tools, and meet Vercel Web Interface Guidelines for accessibility and interaction quality. The message data model will use a parts-based architecture (inspired by Vercel AI SDK's `UIMessage`) that cleanly separates text, reasoning, tool calls, and other content types, making the rendering pipeline composable and extensible.

Verification method: Run `pnpm tauri dev` with either `claude-code-acp` or `codex-acp`, send prompts that trigger tool calls (e.g., "read the file src/App.tsx"), and observe structured rendering of the agent's thinking process, tool invocations with live status, and final text response. Toggle between light and dark themes. Run `pnpm test:run` to verify all existing and new tests pass.

Deliverables:

1. **Parts-based message architecture** — `Message.blocks: ContentBlock[]` replacing `Message.content: string`
2. **Extended ACP event pipeline** — Rust plugin parses `session/update` notifications for thought chunks, tool calls, tool call updates, and plans; TypeScript SDK surfaces these as typed events
3. **Rich message rendering** — New components: `ThinkingBlock`, `ToolCallCard`, `PlanView`, updated `ChatMessageList` rendering pipeline
4. **Dark mode + visual polish** — CSS custom properties theming system, dark palette, refined spacing/typography
5. **Improved interaction patterns** — "New Chat" button, keyboard shortcut (Cmd+N), scroll-to-bottom FAB, empty state refinement

## Progress

- [x] (2026-02-15 22:00JST) Research phase completed
  - DeepWiki: Zed AgentPanel/AcpThreadView patterns, claude-code-acp/codex-acp ACP architecture
  - Context7: Vercel AI SDK UIMessage parts architecture, useChat patterns
  - WebFetch: chat-sdk.dev architecture, Vercel Web Interface Guidelines
  - Agent team exploration: UX researcher, architect, devil's advocate
- [ ] Phase 13: Parts-based message architecture (frontend refactor)
- [ ] Phase 14: Extended ACP event pipeline (Rust + TypeScript SDK)
  - [ ] Step 14.0: Wire protocol discovery — log ALL session/update types from real agents
  - [ ] Step 14.1-14.6: Extend event pipeline based on discovery results
- [ ] Phase 15: Rich message rendering (React components) — conditional on Phase 14 discovery
- [ ] Phase 16: Dark mode + visual polish (CSS theming) — independent, can proceed in parallel
- [ ] Phase 17: Interaction improvements (New Chat, keyboard shortcuts) — independent

## Surprises & Discoveries

- (2026-02-15) The Rust plugin (`process.rs`) currently only parses `session/update` notifications to extract `delta` text from `agent_message_chunk`. All other notification content types (`agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `user_message_chunk`) are silently ignored. This means adding rich rendering requires Rust changes, not just frontend work.

- (2026-02-15) Vercel AI SDK's `UIMessage` uses a `parts[]` array instead of a flat `content` string. Each part is a discriminated union: `text`, `reasoning`, `tool-${name}` (with state machine: `input-streaming` → `input-available` → `output-available` | `output-error`), `source-url`, `file`, `data-${name}`. This architecture cleanly separates concerns and makes rendering composable. Our current `Message.content: string` is the main bottleneck.

- (2026-02-15) ACP `session/update` notifications carry a `content` array where each item has a `type` field: `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `user_message_chunk`, `plan`. The `tool_call` type includes `status` (pending, in_progress, completed, failed, rejected, canceled) and optional `content` (text output, diff, terminal output). This maps well to our planned `ContentBlock` types.

- (2026-02-15) Zed's tool call rendering uses `ToolCallStatus` enum with 7 states (Pending, WaitingForConfirmation, InProgress, Completed, Failed, Rejected, Canceled). For our initial implementation, 4 states (pending, running, completed, failed) are sufficient since we don't yet support interactive tool approval.

- (2026-02-15) Devil's advocate analysis identified that virtual scrolling, message editing, slash commands, context mentions (@file), thread history sidebar, and follow-agent mode are all high-effort features that provide diminishing returns for a personal project. The minimum viable improvement is: parts architecture + tool call visualization + thinking blocks + dark mode.

- (2026-02-15) The current cream/beige palette (#F5F0E6 background, #E8E0C8 user messages, #8B7355 accent) is distinctive but unusual for a coding tool. Professional tools (Cursor, Zed, VS Code) use neutral gray palettes. However, the beige palette is a deliberate aesthetic choice and could be kept as the light theme while adding a proper dark theme.

- (2026-02-15) **CRITICAL (Devil's Advocate): We don't know what `session/update` content types the agents actually send.** The Rust plugin's `parse_notification` in `process.rs:308-348` only handles `agent_message_chunk`. All other types fall through to a debug log and are discarded. The ACP protocol docs say these types "may include tool use, file changes, etc." but this is speculative — we have no empirical evidence that `claude-code-acp` or `codex-acp` actually emit `agent_thought_chunk`, `tool_call`, etc. over the wire. **We must add wire protocol logging first and observe real data before building UI components.** Building UI for data that doesn't arrive is the highest-risk failure mode.

- (2026-02-15) Architect identified that tool call updates may arrive rapidly (many `tool_call_update` events per second). Using `setMessages(prev => ...)` for each update creates many intermediate arrays. Mitigation: use a `Map<string, {messageIdx, blockIdx}>` ref for O(1) tool call lookup, and debounce status updates via `requestAnimationFrame` batching, similar to the existing `streamingContentRef` pattern.

- (2026-02-15) Architect recommended using `blocks[]` naming instead of `parts[]` to avoid confusion with Vercel AI SDK's parts (which have different semantics). Our `ContentBlock` types are simpler: `TextBlock`, `ThinkingBlock`, `ToolCallBlock`. The AI SDK's `UIContentBlock` includes `source-url`, `file`, `data-*` which we don't need.

## Decision Log

- Decision: Adopt parts-based message architecture inspired by Vercel AI SDK
  Rationale: The AI SDK's `UIMessage.blocks[]` pattern cleanly separates text, reasoning, tool calls, and other content types into a discriminated union. This makes rendering composable (each part type has its own component) and extensible (new part types can be added without touching existing rendering logic). The current flat `Message.content: string` cannot represent tool calls or thinking blocks.
  Date/Author: 2026-02-15 / Team (architect recommendation)

- Decision: Use CSS custom properties for theming instead of CSS-in-JS or Tailwind
  Rationale: The project already uses vanilla CSS (AcpChat.css). CSS custom properties provide zero-runtime theming, work with the existing stylesheet approach, and are the standard recommended by Vercel Web Interface Guidelines. Adding Tailwind or CSS-in-JS would be a large infrastructure change with no clear benefit for this project's scale.
  Date/Author: 2026-02-15 / Team (architect recommendation)

- Decision: Keep the cream/beige palette as light theme, add dark theme
  Rationale: The existing palette is a deliberate aesthetic choice and works well. Rather than replacing it, we add a proper dark theme alongside it. Users can toggle via `prefers-color-scheme` media query (auto) or manual toggle.
  Date/Author: 2026-02-15 / Team (UX + devil's advocate consensus)

- Decision: Start with 4 tool call states (pending, running, completed, failed) instead of Zed's 7
  Rationale: Zed's WaitingForConfirmation, Rejected, and Canceled states require interactive tool approval UI, which depends on ACP's tool approval protocol. Our current ACP implementation doesn't support interactive approval. Adding the 4 core states covers 95% of use cases; the remaining states can be added when tool approval is implemented.
  Date/Author: 2026-02-15 / Team (devil's advocate recommendation)

- Decision: Defer thread management, slash commands, context mentions, virtual scrolling, message editing
  Rationale: Devil's advocate analysis showed these are high-effort, lower-impact features for a personal project. "New Chat" (conversation reset) is the only thread-related feature worth implementing now. The rest can be added incrementally after the core rich-rendering pipeline is solid.
  Date/Author: 2026-02-15 / Team (devil's advocate recommendation)

- Decision: Implement phase order: Parts architecture → Rust pipeline → Rich rendering → Dark mode → Interaction polish
  Rationale: Each phase builds on the previous. Parts architecture is the foundation; without it, rich rendering is impossible. Rust pipeline provides the data; rich rendering displays it. Dark mode and interaction polish are independent finishing touches. This order minimizes rework and keeps the app functional between phases.
  Date/Author: 2026-02-15 / Team (architect recommendation)

- Decision: Add wire protocol discovery logging BEFORE building rich rendering UI
  Rationale: Devil's advocate identified the highest-risk failure mode: building UI components for ACP event types that agents don't actually send. The current Rust plugin drops all `session/update` content types except `agent_message_chunk` into a debug log. We must capture and analyze real wire data from `claude-code-acp` and `codex-acp` to confirm which content types are actually emitted. Phase 14 includes a Step 14.0 that adds comprehensive logging and requires empirical validation before proceeding to UI work.
  Date/Author: 2026-02-15 / Team (devil's advocate critical finding)

- Decision: Use `blocks[]` naming instead of `parts[]` for message content array
  Rationale: Architect recommended avoiding confusion with Vercel AI SDK's `UIContentBlock` types, which include `source-url`, `file`, `data-*` that we don't support. Our `ContentBlock` union is simpler: `TextBlock`, `ThinkingBlock`, `ToolCallBlock`. The name `blocks` also aligns better with Zed's `EntryViewState` pattern.
  Date/Author: 2026-02-15 / Team (architect recommendation)

- Decision: Keep blocks inside Messages, not as separate state
  Rationale: Architect identified that tool calls as top-level state would require cross-referencing with messages for rendering. Keeping them as blocks within the message they belong to maintains a single, ordered data structure and simplifies the rendering pipeline (ChatMessageList → ChatMessage → block.map → BlockRenderer).
  Date/Author: 2026-02-15 / Team (architect recommendation)

## Outcomes & Retrospective

(To be updated as phases complete)

## Context and Orientation

### Repository Structure (Relevant Files)

The Chat UI lives in `src/features/acp-chat/` within a Tauri v2 + React 19 + TypeScript application. The Tauri Rust plugin at `crates/tauri-plugin-acp/` manages agent processes and ACP protocol communication. The TypeScript SDK at `packages/tauri-acp/` wraps Tauri commands and events.

    src/features/acp-chat/
    ├── components/
    │   ├── AcpChat.tsx              # Main container (134 lines)
    │   ├── AcpChat.css              # All styles (~500 lines)
    │   ├── ChatMessageList.tsx      # Message list with auto-scroll
    │   ├── ChatInput.tsx            # Input textarea + toolbar
    │   ├── MarkdownText.tsx         # Markdown rendering (react-markdown + Prism)
    │   ├── TypingIndicator.tsx      # 3-dot loading animation
    │   └── DropdownSelect.tsx       # Generic dropdown
    ├── hooks/
    │   ├── useAcpChat.ts            # Main chat logic (118 lines)
    │   ├── useAcpSession.ts         # ACP agent/session lifecycle
    │   └── useReasoningLevel.ts     # Reasoning level + localStorage
    ├── types.ts                     # Message, UseAcpChatOptions, UseAcpChatReturn
    ├── providers.ts                 # ProviderConfig, PROVIDERS array
    ├── format-model-id.ts           # Model ID → display name
    ├── format-error.ts              # Error message formatting
    └── index.ts                     # Public exports

    crates/tauri-plugin-acp/src/
    ├── process.rs                   # Agent process management, notification parsing
    ├── events.rs                    # AcpEvent enum (Delta, Complete, Error, AgentTerminated)
    ├── commands.rs                  # Tauri commands (spawn, session, prompt, cancel, setModel)
    ├── protocol.rs                  # JSON-RPC types
    ├── state.rs                     # Plugin state (agents, sessions)
    └── lib.rs                       # Plugin registration

    packages/tauri-acp/src/
    ├── types.ts                     # AgentSpec, AcpEvent, AcpModel, SessionInfo
    ├── events.ts                    # Event listener helpers
    ├── session.ts                   # AcpSession class
    ├── agent.ts                     # AcpAgent class
    └── commands.ts                  # Tauri invoke wrappers

### Current Message Type

The current message type uses a flat `content: string`:

    interface Message {
      id: string;
      role: "user" | "assistant";
      content: string;       // ← flat string, cannot represent structured content
      createdAt: Date;
    }

### Current ACP Event Pipeline

The Rust plugin's `process.rs` has a `parse_notification` function that handles `session/update` notifications. Currently it only extracts text from `agent_message_chunk` content blocks and emits `AcpEvent::Delta`. All other content types are ignored.

The `events.rs` defines:

    pub enum AcpEvent {
        Delta { session_id: String, text: String },
        Complete { session_id: String, stop_reason: String },
        Error { session_id: Option<String>, message: String },
        AgentTerminated { agent_id: String, exit_code: Option<i32> },
    }

### ACP Protocol: session/update Notification

When an ACP agent processes a prompt, it sends `session/update` notifications with a `content` array. Each content item has a `type` field identifying what kind of content it is. The types sent by claude-code-acp and codex-acp include:

**agent_message_chunk** — Streaming text from the agent. Contains `{ type: "agent_message_chunk", text: "..." }`. Currently handled by our Rust plugin.

**agent_thought_chunk** — Reasoning/thinking text from the agent. Contains `{ type: "agent_thought_chunk", text: "..." }`. Shows the agent's internal reasoning process. Currently ignored.

**tool_call** — The agent is invoking a tool. Contains `{ type: "tool_call", tool_call_id: "...", tool_name: "...", status: "pending"|"in_progress"|"completed"|"failed", input: {...}, content: [...] }`. The `content` array can contain text, diffs, or terminal output. Currently ignored.

**tool_call_update** — Update to a previous tool call. Contains `{ type: "tool_call_update", tool_call_id: "...", status: "completed"|"failed", content: [...] }`. Currently ignored.

**plan** — A task list or plan update. Contains `{ type: "plan", tasks: [{id, title, status}] }`. Currently ignored.

**user_message_chunk** — Echo of the user's input. Currently ignored.

### Vercel AI SDK UIMessage Parts Architecture (Reference)

The Vercel AI SDK uses a parts-based message model where each message has a `parts[]` array of discriminated union types:

    type UIContentBlock =
      | { type: "text"; text: string; state?: "streaming" | "done" }
      | { type: "reasoning"; text: string; state?: "streaming" | "done" }
      | { type: "tool-call"; toolName: string; toolCallId: string; state: "input-streaming" | "input-available" | "output-available" | "output-error"; input: unknown; output?: unknown; errorText?: string }
      | { type: "source-url"; sourceId: string; url: string; title?: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }

This pattern enables composable rendering: each part type maps to a dedicated React component, and new part types can be added without modifying existing components.

### Zed UI Patterns (Reference)

Zed's AI assistant uses `AcpThreadView` with `EntryViewState` to render messages. Tool calls are rendered as collapsible sections with status icons (pending spinner, completed checkmark, failed X). Thinking blocks use a `Disclosure` component with "Thinking" label and brain icon. File diffs use a `DiffView` with Accept/Reject buttons. Terminal output uses a `TerminalView`.

### Vercel Web Interface Guidelines (Reference — Key Rules)

These rules from the Vercel Web Interface Guidelines must be followed in all new UI code:

- All interactive elements need visible focus states (`:focus-visible`)
- Icon-only buttons require `aria-label`
- Honor `prefers-reduced-motion` for animations
- Animate only `transform` and `opacity`
- Never use `transition: all`
- Use semantic HTML (`<button>`, `<details>`, `<summary>`)
- Text containers must handle long content (truncation, word-break)
- Handle empty states gracefully
- Lists >50 items should use virtualization
- URL reflects state via query params
- `touch-action: manipulation` on interactive elements
- Apply `color-scheme: dark` on `<html>` for dark themes

## Plan of Work

### Phase 13: Parts-Based Message Architecture

This phase refactors the `Message` type from a flat `content: string` to a `parts: ContentBlock[]` array. This is the foundation that enables all subsequent rich rendering. After this phase, messages are stored as arrays of typed parts, but rendering still concatenates text parts into a single markdown block (no visual change yet). All existing tests must be updated but the UI behavior remains identical.

The `ContentBlock` type is a discriminated union:

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "reasoning"; text: string; isCollapsed?: boolean }
      | { type: "tool-call"; toolCallId: string; toolName: string; status: ToolCallStatus; input?: unknown; content?: ToolCallContent[] }
      | { type: "tool-call-update"; toolCallId: string; status: ToolCallStatus; content?: ToolCallContent[] }
      | { type: "plan"; tasks: PlanTask[] }

    type ToolCallStatus = "pending" | "running" | "completed" | "failed";

    type ToolCallContent =
      | { type: "text"; text: string }
      | { type: "diff"; path: string; hunks: string }
      | { type: "terminal"; command: string; output: string; exitCode?: number }

    type PlanTask = { id: string; title: string; status: "pending" | "in_progress" | "completed" }

Changes required:

1. Update `src/features/acp-chat/types.ts` — Add `ContentBlock`, `ToolCallStatus`, `ToolCallContent`, `PlanTask` types. Change `Message.content: string` to `Message.blocks: ContentBlock[]`.

2. Update `src/features/acp-chat/hooks/useAcpSession.ts` — The `onDelta` callback currently concatenates text into `streamingContentRef.current`. Change it to push `{ type: "text", text }` parts into the last assistant message's `parts` array. The `onComplete` callback behavior remains the same.

3. Update `src/features/acp-chat/hooks/useAcpChat.ts` — The `append` function currently creates assistant messages with `content: ""`. Change to `parts: []`. The streaming accumulation logic updates the last text part instead of a content string.

4. Update `src/features/acp-chat/components/ChatMessageList.tsx` — Extract text from `message.blocks.filter(p => p.type === "text").map(p => p.text).join("")` for the current rendering. This is a transitional step; Phase 15 adds per-part rendering.

5. Update all test files — Change `content: "..."` to `parts: [{ type: "text", text: "..." }]` in test fixtures.

6. Add a helper function `getMessageText(message: Message): string` that extracts all text parts and joins them. This is used during the transition and for accessibility (aria-label on messages).

Verification: `pnpm test:run` passes. `pnpm typecheck` passes. The Chat UI looks identical before and after — messages still render as markdown text. The only difference is the internal data structure.

### Phase 14: Extended ACP Event Pipeline

This phase extends the Rust plugin and TypeScript SDK to parse and emit the new ACP notification content types: `agent_thought_chunk`, `tool_call`, `tool_call_update`, and `plan`.

**CRITICAL PREREQUISITE (Devil's Advocate finding):** We do not have empirical evidence that `claude-code-acp` or `codex-acp` actually emit these content types over the wire. The ACP protocol docs say they "may include" these types, but the current Rust plugin drops everything except `agent_message_chunk`. Step 14.0 must be completed first to capture real wire data and confirm which types are actually sent.

**Step 14.0: Wire Protocol Discovery (MUST DO FIRST)**

Before building any new event types or UI components, add comprehensive logging to capture ALL `session/update` content types that agents actually send. This is a small, safe Rust change.

In `crates/tauri-plugin-acp/src/process.rs`, modify the `parse_notification` function's fallthrough case from a debug log to an info-level log that captures the full JSON of unknown content types:

    // Current (drops data silently):
    _ => {
        tracing::debug!("Session update: {}", update_type);
        None
    }

    // New (captures full data for analysis):
    _ => {
        tracing::info!(
            "DISCOVERY: session/update type='{}' full_content={}",
            update_type,
            serde_json::to_string(&update).unwrap_or_default()
        );
        None
    }

Then run `pnpm tauri dev` and:

1. Connect to `claude-code-acp` and send: "read the file src/App.tsx" (should trigger tool calls)
2. Connect to `codex-acp` and send: "explain this codebase" (should trigger thinking)
3. Inspect the terminal output for `DISCOVERY:` lines
4. Document which content types are actually received and their exact JSON structure

**If no `agent_thought_chunk`, `tool_call`, or `tool_call_update` are observed**, skip Steps 14.1-14.6 and Phase 15 entirely. Proceed directly to Phase 16 (dark mode) and Phase 17 (interaction improvements) which are frontend-only and guaranteed to work.

**If discovery confirms data exists**, proceed with Steps 14.1-14.6 using the actual JSON structure (not the speculative structure from the protocol docs).

**Step 14.1: Rust — Extend AcpEvent enum**

In `crates/tauri-plugin-acp/src/events.rs`, add new variants:

    pub enum AcpEvent {
        Delta { session_id: String, text: String },
        ThoughtDelta { session_id: String, text: String },
        ToolCall { session_id: String, tool_call_id: String, tool_name: String, status: String, input: Option<serde_json::Value>, content: Option<serde_json::Value> },
        ToolCallUpdate { session_id: String, tool_call_id: String, status: String, content: Option<serde_json::Value> },
        PlanUpdate { session_id: String, tasks: serde_json::Value },
        Complete { session_id: String, stop_reason: String },
        Error { session_id: Option<String>, message: String },
        AgentTerminated { agent_id: String, exit_code: Option<i32> },
    }

All new `Option<T>` fields must have `#[serde(skip_serializing_if = "Option::is_none")]` to avoid null/undefined mismatch (per Phase 12 learning).

**Step 14.2: Rust — Update parse_notification**

In `crates/tauri-plugin-acp/src/process.rs`, extend `parse_notification` to handle new content types in the `session/update` notification's `content` array. Currently only `agent_message_chunk` is handled. Add cases for:

- `agent_thought_chunk` → emit `AcpEvent::ThoughtDelta`
- `tool_call` → emit `AcpEvent::ToolCall`
- `tool_call_update` → emit `AcpEvent::ToolCallUpdate`
- `plan` → emit `AcpEvent::PlanUpdate`

Each case extracts the relevant fields from the JSON content item and constructs the appropriate `AcpEvent` variant. The `parse_notification` function is a pure function (no side effects), making it unit-testable.

**Step 14.3: Rust — Add unit tests**

Add unit tests for each new content type in `parse_notification`. Test both valid and malformed inputs. Target: 10+ new tests covering the new content types.

**Step 14.4: TypeScript SDK — Extend AcpEvent type**

In `packages/tauri-acp/src/types.ts`, extend the `AcpEvent` union:

    export type AcpEvent =
      | { type: "delta"; sessionId: string; text: string }
      | { type: "thought_delta"; sessionId: string; text: string }
      | { type: "tool_call"; sessionId: string; toolCallId: string; toolName: string; status: string; input?: unknown; content?: unknown }
      | { type: "tool_call_update"; sessionId: string; toolCallId: string; status: string; content?: unknown }
      | { type: "plan_update"; sessionId: string; tasks: unknown }
      | { type: "complete"; sessionId: string; stopReason: StopReason }
      | { type: "error"; sessionId?: string; message: string }
      | { type: "agent_terminated"; agentId: string; exitCode?: number };

**Step 14.5: TypeScript SDK — Extend AcpSession**

In `packages/tauri-acp/src/session.ts`, add new event subscription methods:

    onThoughtDelta(callback: (text: string) => void): Promise<UnlistenFn>
    onToolCall(callback: (event: ToolCallEvent) => void): Promise<UnlistenFn>
    onToolCallUpdate(callback: (event: ToolCallUpdateEvent) => void): Promise<UnlistenFn>
    onPlanUpdate(callback: (event: PlanUpdateEvent) => void): Promise<UnlistenFn>

Also add a convenience method `onSessionEvent(callback: (event: AcpEvent) => void)` that listens to all event types with a single handler, similar to the existing `onEvent` helper in `events.ts`. This reduces boilerplate in the React hooks.

**Step 14.6: React hook — Update useAcpSession**

In `src/features/acp-chat/hooks/useAcpSession.ts`, subscribe to the new events and push corresponding `ContentBlock` entries into the current assistant message's `parts` array:

- `onThoughtDelta`: Accumulate text into a `{ type: "reasoning", text }` part (similar to how Delta accumulates into a text part)
- `onToolCall`: Add a `{ type: "tool-call", toolCallId, toolName, status, input, content }` part
- `onToolCallUpdate`: Find the existing tool-call part by `toolCallId` and update its `status` and `content`
- `onPlanUpdate`: Add or update a `{ type: "plan", tasks }` part

Verification: `cargo test -p tauri-plugin-acp` passes with new tests. `pnpm test:run` passes. `pnpm typecheck` passes. Send a prompt to claude-code-acp that triggers tool use (e.g., "read the file src/App.tsx") and verify in the browser console that `thought_delta`, `tool_call`, and `tool_call_update` events are received.

### Phase 15: Rich Message Rendering

This phase adds new React components that render each `ContentBlock` type with appropriate visual treatment. After this phase, tool calls appear as collapsible cards with status icons, thinking blocks appear as collapsible dimmed sections, and plans appear as task lists.

**Step 15.1: Create ContentBlockRenderer component**

Create `src/features/acp-chat/components/ContentBlockRenderer.tsx`. This is a switch component that dispatches to the appropriate renderer based on `part.type`:

    function ContentBlockRenderer({ part }: { part: ContentBlock }) {
      switch (part.type) {
        case "text": return <MarkdownText content={part.text} />;
        case "reasoning": return <ThinkingBlock text={part.text} />;
        case "tool-call": return <ToolCallCard {...part} />;
        case "tool-call-update": return null; // Updates are applied to existing tool-call parts
        case "plan": return <PlanView tasks={part.tasks} />;
        default: return null;
      }
    }

**Step 15.2: Create ThinkingBlock component**

Create `src/features/acp-chat/components/ThinkingBlock.tsx`. Uses the native `<details>` / `<summary>` elements for collapsible behavior (semantic HTML per Web Interface Guidelines). Shows a brain/sparkle icon and "Thinking" label in the summary. The thinking text is rendered in a dimmed, smaller font.

    <details className="thinking-block" open>
      <summary className="thinking-block-summary">
        <SparkleIcon /> Thinking
      </summary>
      <div className="thinking-block-content">
        <MarkdownText content={text} />
      </div>
    </details>

CSS: `.thinking-block` has a left border accent, dimmed text (`opacity: 0.7`), smaller font size. Summary has cursor pointer. The `<details>` element provides built-in keyboard accessibility (Enter/Space to toggle).

**Step 15.3: Create ToolCallCard component**

Create `src/features/acp-chat/components/ToolCallCard.tsx`. Shows the tool name, status indicator, and collapsible content.

    <div className="tool-call-card" data-status={status}>
      <div className="tool-call-header" role="button" onClick={toggle} aria-expanded={isOpen}>
        <StatusIcon status={status} />
        <span className="tool-call-name">{formatToolName(toolName)}</span>
        <ChevronIcon direction={isOpen ? "up" : "down"} />
      </div>
      {isOpen && (
        <div className="tool-call-content">
          {content?.map(renderToolContent)}
        </div>
      )}
    </div>

Status indicators:

- `pending`: Pulsing dot (CSS animation)
- `running`: Spinning loader icon
- `completed`: Green checkmark
- `failed`: Red X icon

The `formatToolName` function converts tool names like `Read`, `Edit`, `Bash`, `Glob`, `Grep` to human-readable labels.

Tool content rendering supports text (rendered as markdown), and falls back to JSON for unknown types. Diff and terminal rendering are deferred to a later phase.

**Step 15.4: Create PlanView component**

Create `src/features/acp-chat/components/PlanView.tsx`. Renders a task list with status indicators.

    <div className="plan-view">
      <div className="plan-header">Plan</div>
      <ul className="plan-tasks">
        {tasks.map(task => (
          <li key={task.id} className="plan-task" data-status={task.status}>
            <TaskStatusIcon status={task.status} />
            <span>{task.title}</span>
          </li>
        ))}
      </ul>
    </div>

Task status icons: pending (circle outline), in_progress (filled circle), completed (checkmark).

**Step 15.5: Update ChatMessageList**

Replace the current rendering logic that extracts `message.content` or text from parts. Instead, iterate over `message.blocks` and render each with `ContentBlockRenderer`. For user messages, concatenate all text parts and render as before (user messages don't have tool calls or thinking blocks).

**Step 15.6: Add CSS for new components**

Add styles for `.thinking-block`, `.tool-call-card`, `.plan-view` to `AcpChat.css`. Follow the existing design language (border radius, spacing, color palette). Use CSS custom properties for colors so they work with the theming system in Phase 16.

**Step 15.7: Tests (TDD)**

Write tests for:

1. `ContentBlockRenderer` dispatches to correct component for each part type
2. `ThinkingBlock` renders as `<details>` with correct content
3. `ToolCallCard` shows correct status icon for each status
4. `ToolCallCard` toggles content on click
5. `PlanView` renders all tasks with correct status icons
6. `ChatMessageList` renders mixed text + tool-call + thinking parts in order
7. Accessibility: `ThinkingBlock` is keyboard-operable, `ToolCallCard` has aria-expanded

Target: 15+ new tests.

Verification: `pnpm test:run` passes. Send prompts to claude-code-acp that trigger tool use and observe structured rendering. Thinking blocks are collapsible. Tool calls show live status transitions.

### Phase 16: Dark Mode + Visual Polish

This phase introduces a CSS custom properties theming system and a dark color palette, along with visual refinements to typography, spacing, and animations.

**Step 16.1: CSS custom properties theming system**

Replace all hardcoded color values in `AcpChat.css` with CSS custom properties. Define two themes:

    :root, [data-theme="light"] {
      --chat-bg: #F5F0E6;
      --chat-surface: #FFFFFF;
      --chat-user-bg: #E8E0C8;
      --chat-border: #D4CFC0;
      --chat-text: #2D2D2D;
      --chat-text-secondary: #6B6B6B;
      --chat-accent: #8B7355;
      --chat-code-bg: #E5DFD0;
      --chat-error: #D64545;
      --chat-success: #4A7C4E;
      --chat-thinking-border: #C4B99A;
      --chat-thinking-text: #6B6B6B;
      --chat-tool-pending: #B89B6A;
      --chat-tool-running: #5B8DB8;
      --chat-tool-completed: #4A7C4E;
      --chat-tool-failed: #D64545;
    }

    [data-theme="dark"] {
      --chat-bg: #1A1A1A;
      --chat-surface: #242424;
      --chat-user-bg: #2A2520;
      --chat-border: #3A3A3A;
      --chat-text: #E0E0E0;
      --chat-text-secondary: #999999;
      --chat-accent: #C4A87A;
      --chat-code-bg: #2D2D2D;
      --chat-error: #E06060;
      --chat-success: #6AAF6E;
      --chat-thinking-border: #4A4A3A;
      --chat-thinking-text: #999999;
      --chat-tool-pending: #C4A87A;
      --chat-tool-running: #6AAFCF;
      --chat-tool-completed: #6AAF6E;
      --chat-tool-failed: #E06060;
    }

Apply `color-scheme: dark` on `[data-theme="dark"]` per Web Interface Guidelines.

**Step 16.2: Theme toggle**

Add a theme toggle button to the AcpChat header. Use `data-theme` attribute on the chat container. Persist choice to localStorage (`acp-theme`). Default to `prefers-color-scheme` media query.

**Step 16.3: Replace all hardcoded colors**

Find-and-replace all hex color values in `AcpChat.css` with the corresponding CSS custom property. Also update `MarkdownText.tsx`'s inline Prism theme to use custom properties for the code syntax highlighting colors.

**Step 16.4: Typography and spacing refinements**

- Font: Keep Inter/system font stack. Add `font-variant-numeric: tabular-nums` for timestamps and model names.
- Spacing: Ensure consistent 8px grid. Messages have 12px vertical gap. Tool call cards have 8px internal padding.
- Text: Use `text-wrap: pretty` on message text to prevent orphans (per Web Interface Guidelines).
- Animations: Ensure all animations honor `prefers-reduced-motion`. Only animate `transform` and `opacity`. Remove `transition: all` if present.

**Step 16.5: Scrollbar styling for dark mode**

Update the webkit scrollbar styles to use custom properties so they adapt to the theme.

Verification: Toggle dark mode and verify all elements are readable and correctly themed. Run `pnpm test:run`. Check `prefers-reduced-motion` with macOS accessibility settings.

### Phase 17: Interaction Improvements

This phase adds the most impactful interaction improvements without over-engineering.

**Step 17.1: "New Chat" button**

Add a "New Chat" button to the AcpChat header (replacing the current "+" button's provider-dropdown-only behavior). Clicking "New Chat" calls the existing `reset()` function from `useAcpChat`, which clears messages and resets state.

Keyboard shortcut: `Cmd+Shift+N` (macOS) / `Ctrl+Shift+N` (other). Add a `useEffect` with `keydown` listener in `AcpChat.tsx`.

**Step 17.2: Scroll-to-bottom FAB**

When the user scrolls up in the message list, show a floating "scroll to bottom" button at the bottom-right of the message area. Clicking it scrolls to the latest message. The button disappears when the user is already at the bottom.

Implementation: Add an `IntersectionObserver` on a sentinel element at the bottom of the message list. When the sentinel is not visible, show the FAB.

**Step 17.3: Empty state refinement**

Redesign the empty state (no messages) to be more welcoming:

- Show the provider name and model in the center
- Add 2-3 suggested prompt chips (e.g., "Read a file", "Explain this code", "Help me debug")
- Clicking a chip inserts the text into the input

**Step 17.4: Status lifecycle improvements**

Show more granular connection status in the header:

- `connecting` — "Connecting to {provider}…" with pulse animation
- `ready` — Green dot with provider name
- `generating` — "Generating…" with typing animation
- `error` — Red dot with "Disconnected"

Map these from the existing `isReady`, `isLoading`, `error` state values.

**Step 17.5: Tests**

Write tests for:

1. "New Chat" button clears messages
2. Keyboard shortcut Cmd+Shift+N triggers new chat
3. Scroll-to-bottom FAB appears when scrolled up
4. Empty state shows suggested prompts
5. Clicking a prompt chip populates input

Target: 8+ new tests.

Verification: `pnpm test:run` passes. Start app, verify "New Chat" works, scroll behavior works, empty state is visually appealing.

## Concrete Steps

### Phase 13 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After editing types.ts, hooks, and components:
    pnpm typecheck
    pnpm test:run
    pnpm lint

    # Verify no visual regression:
    pnpm tauri dev

### Phase 14 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After Rust changes:
    cargo test -p tauri-plugin-acp
    cargo build

    # After TypeScript SDK changes:
    cd packages/tauri-acp && pnpm typecheck && cd ../..

    # After React hook changes:
    pnpm typecheck
    pnpm test:run

    # Verify events in browser console:
    pnpm tauri dev
    # Send: "read the file src/App.tsx"
    # Check console for thought_delta, tool_call, tool_call_update events

### Phase 15 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After creating new components:
    pnpm typecheck
    pnpm test:run
    pnpm lint

    # Visual verification:
    pnpm tauri dev
    # Send prompts that trigger tool use
    # Verify: thinking blocks collapsible, tool calls show status

### Phase 16 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After CSS theming:
    pnpm typecheck
    pnpm test:run

    # Visual verification:
    pnpm tauri dev
    # Toggle dark mode
    # Check all elements are readable

### Phase 17 Commands

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit

    # After interaction improvements:
    pnpm typecheck
    pnpm test:run
    pnpm lint

    # Visual verification:
    pnpm tauri dev
    # Test: New Chat button, scroll-to-bottom, empty state, keyboard shortcuts

## Validation and Acceptance

### Build Validation

    cd /Users/sotayamashita/Projects/personal/tauri-acp-kit
    cargo test -p tauri-plugin-acp    # Expect: 50+ tests pass (42 existing + new)
    cargo build                        # Expect: No errors
    pnpm typecheck                     # Expect: No type errors
    pnpm test:run                      # Expect: 75+ tests pass (60 existing + new)
    pnpm lint                          # Expect: No lint errors

### Runtime Validation

With `pnpm tauri dev` running:

1. **Basic chat**: Send "hello" → streaming text response appears as before
2. **Tool calls**: Send "read the file src/App.tsx" → tool call card appears with:
   - Pending → Running → Completed status transition
   - Collapsible content showing file contents
3. **Thinking blocks**: Send a complex question → thinking block appears, collapsible
4. **Dark mode**: Toggle theme → all elements correctly themed, readable
5. **New Chat**: Click "New Chat" or press Cmd+Shift+N → messages cleared
6. **Scroll**: Send many messages, scroll up → FAB appears → click → scrolls to bottom
7. **Empty state**: After new chat → welcoming empty state with suggested prompts

### Accessibility Validation

- Tab through all interactive elements → visible focus rings
- Toggle theme → no broken elements
- Enable "Reduce Motion" in macOS → animations disabled
- Screen reader announces message roles and content

## Idempotence and Recovery

Each phase maintains a buildable, testable state. If a phase is interrupted:

- Phase 13: Revert types.ts and related files if tests fail. The old `content: string` type can coexist during transition via a union type.
- Phase 14: Rust changes are additive (new enum variants). Existing Delta/Complete events continue to work. TypeScript SDK changes are backward-compatible (new event types don't break existing subscriptions).
- Phase 15: New components are additive. If rendering fails, `ContentBlockRenderer` falls back to `null` for unknown types.
- Phase 16: CSS custom properties replacement can be done incrementally per component.
- Phase 17: Each interaction improvement is independent and can be reverted individually.

## Artifacts and Notes

### Research Sources — Detailed Log

All research was conducted on 2026-02-15 during the ExecPlan authoring session. Each entry records the tool used, the query or URL, and the key findings extracted.

#### DeepWiki MCP Queries

1. **ACP Architecture (claude-code-acp + codex-acp)**
   - Tool: `mcp__deepwiki__ask_question`
   - Repos: `["zed-industries/claude-code-acp", "zed-industries/codex-acp"]`
   - Query: "How does the ACP work for integrating Claude Code and Codex as coding agents? Architecture, message format, UI patterns?"
   - Key findings:
     - Both agents implement ACP v1 over stdin/stdout using NDJSON streams
     - `ClaudeAcpAgent` bridges ACP ↔ Claude Agent SDK; `CodexAgent` bridges ACP ↔ codex-core
     - Protocol translation: `promptToClaude()` converts ACP `PromptRequest` → `SDKUserMessage`
     - SessionNotification types: `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `user_message_chunk`
     - `toAcpNotifications()` converts SDK content blocks → ACP notifications
     - Slash commands advertised as `AvailableCommand` objects
     - Terminal output via `terminal-auth` (claude-code-acp) or `meta.terminal_output` (codex-acp)

2. **Zed AI Assistant Chat UI**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/zed`
   - Query: "How is the AI assistant chat UI implemented in Zed? Key UI components, message rendering patterns, interaction design?"
   - Key findings:
     - `AgentPanel` → `AcpThreadView` → `EntryViewState` component hierarchy
     - `MessageEditor` with @mentions and slash commands
     - `ThreadState` enum: Loading, Ready, LoadError, Unauthenticated
     - Message types: `UserMessage`, `AssistantMessage`, `ToolCall`
     - Tool approval: `agent.tool_permissions.default` (confirm/allow/deny)
     - Message queueing, follow agent mode, model/profile selectors

3. **Zed Tool Call Visualization**
   - Tool: `mcp__deepwiki__ask_question`
   - Repo: `zed-industries/zed`
   - Query: "Key UI components for tool call visualization? How are tool calls rendered (pending, in-progress, completed, failed)? Diffs? Terminal? Thinking blocks?"
   - Key findings:
     - `ToolCallStatus` enum: Pending, WaitingForConfirmation, InProgress, Completed, Failed, Rejected, Canceled
     - File diffs via `render_diff_editor` + `AgentDiffPane` with Accept/Reject buttons
     - Terminal via `render_terminal_tool_call` (collapsible)
     - Thinking: `<details>` with `IconName::ToolThink` + "Thinking" label, markdown content
     - Tool icons: `ToolTerminal`, `ToolPencil`, file icon

#### Context7 MCP Queries

4. **Vercel AI SDK — useChat + Tool Calls**
   - Tool: `mcp__context7__query-docs`
   - Library ID: `/vercel/ai`
   - Query: "useChat hook chatbot UI architecture, message parts, tool calls, streaming, UIMessage type, status lifecycle, rendering patterns"
   - Key findings:
     - Messages rendered via `parts[]` with `switch(part.type)` dispatch
     - Tool call state machine: `input-streaming` → `input-available` → `output-available` | `output-error`
     - Per-tool part types: `tool-${toolName}` (e.g., `tool-getWeather`)
     - `addToolOutput()` for interactive tool confirmation
     - `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` for multi-step chains

5. **Vercel AI SDK — UIMessage Type Definitions**
   - Tool: `mcp__context7__query-docs`
   - Library ID: `/vercel/ai`
   - Query: "UIMessage type definition, message parts types, reasoning parts, source parts, file parts, all part types, full TypeScript interface"
   - Key findings:
     - `UIMessage<METADATA, DATA_PARTS, TOOLS>` with 3 generic type parameters
     - Part types: `TextUIPart` (state: streaming|done), `ReasoningUIPart` (+ providerMetadata), `ToolUIPart` (toolCallId + state + input + output + errorText), `SourceUrlUIPart`, `SourceDocumentUIPart`, `FileUIPart`, `DataUIPart`
     - Custom data parts: `data-${NAME}` pattern for application-specific content

#### WebFetch Queries

6. **AI SDK UI Chatbot Documentation**
   - Tool: `WebFetch`
   - URL: `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot`
   - Key findings:
     - `useChat` returns: `messages`, `sendMessage`, `status`, `error`, `stop`, `regenerate`, `setMessages`
     - Status lifecycle: `submitted` → `streaming` → `ready` | `error`
     - Transport: Hook-level, Request-level, Direct Agent (3-tier)
     - `experimental_throttle` for batching UI updates
     - `onFinish` with `isAbort`, `isDisconnect`, `isError` flags
     - `setMessages()` for delete/edit/history

7. **Chat SDK (chat-sdk.dev)**
   - Tool: `WebFetch`
   - URL: `https://chat-sdk.dev/docs`
   - Key findings:
     - Open-source template by Vercel for chatbot applications
     - Generative UIs, Artifacts (persistent workspaces), Multimodal support
     - Resumable streams for generation recovery
     - Built on Next.js App Router + AI SDK

8. **Vercel Web Interface Guidelines**
   - Tool: `WebFetch`
   - URL: `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
   - Key rules applied to this plan:
     - `:focus-visible` on all interactive elements
     - `aria-label` on icon-only buttons
     - `prefers-reduced-motion` honored
     - Animate only `transform` and `opacity`
     - Semantic HTML (`<button>`, `<details>`, `<summary>`)
     - `color-scheme: dark` for dark themes
     - `touch-action: manipulation`, `font-variant-numeric: tabular-nums`
     - Placeholders end with `…`, Title Case for headings

#### Codebase Exploration

9. **Current Chat UI Implementation**
   - Tool: `Task (Explore agent)`
   - Scope: `src/features/acp-chat/**` — all components, hooks, types, providers, tests
   - Key findings:
     - 6 components: AcpChat (134L), ChatMessageList, ChatInput, MarkdownText, TypingIndicator, DropdownSelect
     - 3 hooks: useAcpChat (118L), useAcpSession, useReasoningLevel
     - Palette: cream (#F5F0E6), sand beige (#E8E0C8), greige (#E5DFD0), brown (#8B7355)
     - CSS: ~500 lines in AcpChat.css, vanilla CSS, hardcoded colors
     - Tests: ~60 Vitest (format-model-id, format-error, useAcpChat, useReasoningLevel, providers)
     - Markdown: react-markdown + remark-gfm + react-syntax-highlighter (Prism, custom theme)

10. **Existing ExecPlan (Phase 1-12)**
    - Tool: `Read`
    - File: `.agents/plans/2026-01-27-tauri-acp-library.md`
    - Key findings:
      - 12 phases completed (workspace → plugin → SDK → Chat UI → ACP v1 → model selector → provider redesign → code review)
      - Wire method names: `session/new`, `session/prompt`, `session/cancel`, `session/set_model`
      - `Option<T>` requires `skip_serializing_if` for Rust↔TypeScript boundary
      - `parse_notification` must be pure function for testability
      - Totals: 42 Rust tests, 60 Vitest tests

### Agent Team Contributions — Detailed Record

Team name: `chat-ui-refinement`. Spawned 2026-02-15. Three agents ran in parallel with distinct research mandates.

#### UX Researcher (`ux-researcher`)

- **Task**: Analyze Cursor/Zed/VS Code chat UI patterns, propose prioritized improvements, wireframes, color/typography recommendations
- **Tools used**: Read (all component + CSS files), DeepWiki (Zed AgentPanel), WebFetch (chat-sdk.dev)
- **Skills loaded**: `web-design-guidelines`, `frontend-design`
- **Key deliverables**:
  - Prioritized list: must-have (dark mode, tool call cards, thinking blocks), nice-to-have (thread tabs, command palette)
  - ASCII wireframes for redesigned layout with tool call and thinking block areas
  - Color: keep cream/beige as light theme, add neutral dark theme
  - Interaction flows for tool call status transitions and thinking block collapse/expand

#### Architect (`architect`)

- **Task**: Component structure, state management, TypeScript interfaces, performance, phasing
- **Tools used**: Read (all source: components, hooks, SDK, Rust plugin), DeepWiki (claude-code-acp types)
- **Skills loaded**: `vercel-react-best-practices`, `vercel-composition-patterns`
- **Key deliverables**:
  - Component tree: extracted ChatHeader, ErrorBanner, UserMessage, AssistantMessage, ThinkingBlock, ToolCallGroup, ToolCallItem
  - State: blocks inside Messages, `toolCallMapRef: Map<string, {messageIdx, blockIdx}>` for O(1) updates
  - `ContentBlock` union: `TextBlock | ThinkingBlock | ToolCallBlock` (renamed from `parts` to `blocks`)
  - Rust `parse_notification` expansion pseudocode for new content types
  - AcpSession SDK extension: `onThoughtDelta()`, `onToolCall()`, `onToolCallUpdate()`
  - Performance audit: `content-visibility: auto` (applied), `memo()` (extend), hoisted constants (applied), functional setState (applied)
  - Phasing: Content blocks → Tool calls → Component extraction → Advanced features
  - **Critical gap**: `parse_notification` (`process.rs:308-348`) only handles `agent_message_chunk`

#### Devil's Advocate (`devils-advocate`)

- **Task**: Challenge assumptions, identify risks, recommend cuts, propose minimum viable plan
- **Tools used**: Read (process.rs, events.rs, types.ts, session.ts, events.ts — protocol feasibility focus), DeepWiki (claude-code-acp, codex-acp — SessionNotification types)
- **Key deliverables**:
  - Risk matrix for all 12 proposed features (complexity × value × feasibility)
  - **CRITICAL finding**: No empirical evidence agents emit `agent_thought_chunk`, `tool_call`, etc. Protocol says "may include" — needs wire verification
  - Cut list:
    - **Cut**: Diff view, terminal output, follow agent mode, message editing (deceptive UX)
    - **Defer**: Context mentions, virtual scrolling, slash command autocomplete
    - **Build**: Dark mode, keyboard shortcuts, New Chat button
  - **Minimum viable plan**: New Chat + 3 shortcuts + CSS custom properties + dark mode + wire protocol logging
  - Over-engineering warnings: no premature types, no state library, no component library from 6 components
  - Recommended Step 14.0: Wire Protocol Discovery before any rich rendering work

## Interfaces and Dependencies

### New TypeScript Types

In `src/features/acp-chat/types.ts`:

    export type ContentBlock =
      | TextBlock
      | ThinkingBlock
      | ToolCallBlock;

    export interface TextBlock {
      type: "text";
      text: string;
    }

    export interface ThinkingBlock {
      type: "thinking";
      text: string;
      isCollapsed?: boolean;  // UI-only state
    }

    export type ToolCallStatus = "pending" | "running" | "completed" | "failed";
    export type ToolKind = "read" | "write" | "terminal" | "browser" | "unknown";

    export interface ToolCallBlock {
      type: "tool_call";
      toolCallId: string;
      title: string;
      kind: ToolKind;
      status: ToolCallStatus;
      input?: string;
      output?: string;
    }

    export type MessageRole = "user" | "assistant";

    export interface Message {
      id: string;
      role: MessageRole;
      blocks: ContentBlock[];
      createdAt: Date;
    }

    // Helper for backward compatibility and accessibility
    export function getMessageText(msg: Message): string {
      return msg.blocks
        .filter((b): b is TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

### New Rust Types

In `crates/tauri-plugin-acp/src/events.rs`:

    #[derive(Debug, Clone, Serialize)]
    #[serde(tag = "type", rename_all = "snake_case")]
    pub enum AcpEvent {
        Delta {
            session_id: String,
            text: String,
        },
        ThoughtDelta {
            session_id: String,
            text: String,
        },
        ToolCall {
            session_id: String,
            tool_call_id: String,
            tool_name: String,
            status: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            input: Option<serde_json::Value>,
            #[serde(skip_serializing_if = "Option::is_none")]
            content: Option<serde_json::Value>,
        },
        ToolCallUpdate {
            session_id: String,
            tool_call_id: String,
            status: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            content: Option<serde_json::Value>,
        },
        PlanUpdate {
            session_id: String,
            tasks: serde_json::Value,
        },
        Complete {
            session_id: String,
            stop_reason: String,
        },
        Error {
            #[serde(skip_serializing_if = "Option::is_none")]
            session_id: Option<String>,
            message: String,
        },
        AgentTerminated {
            agent_id: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            exit_code: Option<i32>,
        },
    }

### New React Components

    src/features/acp-chat/components/
    ├── ContentBlockRenderer.tsx    # NEW: Switch component for part types
    ├── ThinkingBlock.tsx          　# NEW: Collapsible reasoning block
    ├── ToolCallCard.tsx           　# NEW: Tool call with status indicators
    ├── PlanView.tsx               　# NEW: Task list rendering
    └── ScrollToBottomFab.tsx      　# NEW: Floating scroll button

### Dependencies

No new npm packages required. All new components use:

- `react-markdown` (already installed) for text rendering in ThinkingBlock and ToolCallCard
- Native `<details>`/`<summary>` for collapsible sections
- CSS animations for status indicators

No new Rust crates required. The Rust changes only extend existing `serde_json::Value` parsing.

---

Plan Revision Note:

- 2026-02-15: Initial version created based on agent team research (UX researcher, architect, devil's advocate), DeepWiki analysis (Zed, claude-code-acp, codex-acp), Context7 analysis (Vercel AI SDK), Web Interface Guidelines, and chat-sdk.dev patterns. Scope focused on highest-impact improvements (parts architecture, tool calls, thinking blocks, dark mode) per devil's advocate recommendation. Thread management, slash commands, context mentions, and virtual scrolling deferred.
- 2026-02-15 (Rev 2): Incorporated agent team reports. Added Step 14.0 (wire protocol discovery) per devil's advocate critical finding: must confirm agents actually emit `agent_thought_chunk`, `tool_call`, etc. before building UI. Added conditional skip path: if discovery finds no structured events, skip Phases 14-15 and proceed to dark mode + interaction improvements. Adopted architect's `blocks[]` naming (instead of `parts[]`) and `ContentBlock` union types (`TextBlock`, `ThinkingBlock`, `ToolCallBlock`). Added `getMessageText()` helper. Added `toolCallMapRef` performance strategy for rapid tool call updates. Added decisions for wire protocol discovery, `blocks[]` naming, and blocks-inside-messages architecture.
- 2026-02-15 (Rev 3): Expanded "Research Sources" section into "Research Sources — Detailed Log" with 10 numbered entries recording tool, query/URL, and key findings for each investigation. Expanded "Agent Team Contributions" into detailed records per agent (tools used, skills loaded, deliverables). Added AI SDK UI chatbot docs (`ai-sdk.dev/docs/ai-sdk-ui/chatbot`) findings from user-provided reference.
