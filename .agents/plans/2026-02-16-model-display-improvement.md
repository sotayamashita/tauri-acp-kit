# Improve Model Display: Use Provider-Supplied Names and Fix Reasoning Level Handling

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

After this change, the model dropdown in the chat UI will show provider-supplied human-readable names instead of hand-parsed model IDs. For Claude Code, the dropdown trigger shows the alias name (e.g., "Sonnet", "Haiku", "Default (recommended)") and the expanded dropdown shows both the alias name and the description (e.g., "Sonnet 4.5 · Best for everyday tasks") as secondary text. For Codex, the model dropdown will show deduplicated base model names (e.g., "gpt-5.3-codex") and a separate reasoning level dropdown will let users choose the effort level (e.g., "medium", "high") — matching the Codex CLI's UX pattern. The wire protocol will reconstruct the compound model ID (e.g., "gpt-5.3-codex/medium") from these two selections before sending to codex-acp via `session/set_model`. Additionally, the "Method not implemented" error from claude-code-acp's `authenticate()` call will be caught and handled gracefully instead of surfacing to users.

Verification: Run `pnpm tauri dev`, select each provider, and confirm that model names display correctly and reasoning level selection works independently. Run `pnpm test:run` and `pnpm typecheck` to confirm all tests pass.

## Workflow

1. **Create a topic branch** from `main`: `feature/model-display-improvement`
2. **Use the `tdd-workflow` skill** for implementation — write tests first, then make them pass, then refactor.
3. **Create a PR** using `gh pr create` in English after all milestones are complete and tests pass.

## Progress

- [x] Milestone 1: Use `model.name` for display instead of `formatModelId(model.id)`
- [x] Milestone 2: Separate model and reasoning level for Codex (parse/deduplicate compound IDs, reconstruct on send)
- [x] Milestone 3: Handle `authenticate()` "Method not implemented" error gracefully
- [x] Milestone 4: Update tests

## Surprises & Discoveries

- **Claude Agent SDK returns aliases, NOT full display names.** The plan originally assumed `displayName` would be "Claude Opus 4.6" (matching the Anthropic API's `display_name`). Investigation of the actual SDK source (`@anthropic-ai/claude-agent-sdk@0.2.34`) revealed it returns short aliases: `value: "sonnet"`, `displayName: "Sonnet"`, `description: "Sonnet 4.5 · Best for everyday tasks"`. Similarly: `value: "default"`, `displayName: "Default (recommended)"`. The `displayName` does NOT match the Anthropic API `/v1/models` `display_name` field — it's a UI-friendly alias. This invalidated the plan's core assumption about `model.name` being a rich display name.
- **`description` field contains version-qualified names.** The SDK's `description` field has structured info: `"Sonnet 4.5 · Best for everyday tasks"`, `"Opus 4.6 · Most capable for complex work"`, `"Haiku 4.5 · Fastest for quick answers"`. For Codex: `"GPT 5.3 Codex with medium reasoning effort"`. The `description` flows through the entire pipeline (SDK → claude-code-acp → Rust backend → TypeScript `AcpModel.description`).
- **`getDisplayName` fallback approach failed.** An initial fix added `getDisplayName()` that checked if `model.name` had a space to determine if it was a "proper" display name. Since the SDK returns "Sonnet" (no space for some), it fell through to `formatModelId("sonnet")` → "Sonnet" — no improvement. This was reverted.
- **Stale models on provider switch.** When switching providers (A→B), models from provider A remained visible in the dropdown until B connected. Fixed by clearing `availableModels`, `currentModelId`, `isReady`, and `error` at the start of the `useEffect` in `useAcpSession.ts`.
- **Anthropic API `/v1/models` has a `display_name` field.** Each model object in the `GET /v1/models` response contains `display_name` (e.g., "Claude Opus 4.6"). However, the Claude Agent SDK does NOT pass this through — it uses its own alias system instead.

## Decision Log

- Decision: Use `AcpModel.name` as primary display label, with `formatModelId(model.id)` as fallback.
  Rationale: Both upstream ACP agents (claude-code-acp and codex-acp) already provide a human-readable `name` field in their model lists. The Rust backend (`commands.rs:356`) already parses and passes through this field. The frontend has access to it via `AcpModel.name` but currently ignores it, instead re-deriving display names from the `id` field via `formatModelId()`. Using the provider-supplied name is more accurate, future-proof, and requires minimal code changes. The `formatModelId()` function is kept as a fallback for edge cases where `name` equals `id` or is empty.
  Date/Author: 2026-02-16

- Decision: Do not create a custom model ID-to-display-name mapping table.
  Rationale: claude-code-acp internally calls the Claude Agent SDK's `supportedModels()`, which returns `ModelInfo.displayName` (e.g., "Claude Opus 4.6"), and maps it to the ACP response `name` field. The SDK likely sources this from the Anthropic API `/v1/models` endpoint's `display_name` field. The mapping is complete upstream (SDK -> claude-code-acp -> Rust backend -> frontend), so maintaining a custom mapping table in the frontend is unnecessary. When new models are added, the SDK automatically returns the correct `displayName`, requiring zero maintenance.
  Date/Author: 2026-02-17

- Decision: Keep `formatModelId()` as a fallback utility instead of removing it.
  Rationale: The Rust backend uses `id` as fallback when `name` is missing (`commands.rs:356`: `unwrap_or(id)`). In that case, `name` equals `id`, and we still want a human-readable display. The `formatModelId()` function handles this adequately for Claude model IDs. Removing it entirely would mean showing raw IDs like "claude-sonnet-4-20250514" when the provider fails to supply a name.
  Date/Author: 2026-02-16

- Decision: Separate model and reasoning level into distinct dropdowns for Codex, matching Codex CLI's UX.
  Rationale: Codex CLI shows model selection first, then reasoning level selection for the chosen model. Our UI should match this pattern. codex-acp returns each model x effort combination as a separate entry (e.g., "gpt-5.3-codex/low", "gpt-5.3-codex/medium", "gpt-5.3-codex/high"). The frontend will parse these compound IDs via `split('/')`, deduplicate base models, extract supported reasoning levels per model, and reconstruct compound IDs when sending via `session/set_model`. codex-acp does NOT implement `session/setConfigOption` (confirmed via DeepWiki), so the only way to change reasoning level is through compound model IDs in `session/set_model`.
  Date/Author: 2026-02-16 (revised 2026-02-17)

- Decision: Keep `supportsReasoningLevel` hardcoded in `providers.ts`.
  Rationale: Simple, explicit, and only needs one line added per new provider. Dynamic detection based on `/` in model IDs would be a fragile heuristic.
  Date/Author: 2026-02-17

- Decision: Catch and ignore `authenticate()` errors from claude-code-acp.
  Rationale: The "Method not implemented" error (JSON-RPC code -32603) comes from claude-code-acp's `authenticate()` method, which throws because authentication is handled externally via `claude /login`, not through the ACP protocol. Our Rust backend calls `send_authenticate()` as part of session startup and fails on this error. The fix is to treat authentication failure as non-fatal, since not all ACP agents support the authenticate step.
  Date/Author: 2026-02-16

- Decision: Eliminate double-encoding by separating base model tracking from wire ID construction.
  Rationale: With model/reasoning separation, `currentModelId` will store the **base model ID** (e.g., "gpt-5.3-codex") rather than the compound ID. The compound wire ID is constructed only at send-time from `{baseModelId}/{selectedReasoningLevel}`. This eliminates the double-encoding bug entirely rather than patching it with strip logic.
  Date/Author: 2026-02-17

- Decision: No new files, interfaces, or utility functions — use inline changes in existing code only.
  Rationale: Both providers already return correct display names in `model.name`. Display simply uses `m.name` directly — no `getModelDisplayName()` function needed. Codex compound ID deduplication is handled entirely within a `useMemo` in `useAcpChat` — no `parseCompoundModels()`, `buildCompoundModelId()`, `ParsedModelInfo`, or new files needed. A template literal `` `${baseId}/${level}` `` is sufficient.
  Date/Author: 2026-02-17

- Decision: Show `model.description` as secondary text in dropdown items for Claude Code only.
  Rationale: Claude Agent SDK returns short aliases as `displayName` ("Sonnet", "Haiku"), not full names. The `description` field contains version-qualified info ("Sonnet 4.5 · Best for everyday tasks"). Instead of trying to extract or reconstruct rich names, show `model.name` as the primary label and `model.description` as secondary text in dropdown items. This gives users full context without fragile string parsing. The trigger label (selected state) stays as `model.name`. `DropdownSelect.renderLabel` was changed from `string` to `ReactNode` to support the two-line layout.
  Date/Author: 2026-02-17

- Decision: Revert `getDisplayName` fallback and use description-based approach instead.
  Rationale: The `getDisplayName` approach assumed upstream `model.name` would sometimes be a rich display name (e.g., "Claude Sonnet 4.5"). Investigation revealed SDK always returns aliases. The fallback heuristic (check for space in name) was unreliable. Reverted to clean baseline and adopted the description-as-secondary-text approach.
  Date/Author: 2026-02-17

- Decision: Parse initial compound ID as derived state in `useMemo`, not via `useEffect`.
  Rationale: Per Vercel React Best Practices `rerender-derived-state-no-effect` (5.1) rule. `useEffect` + `setState` would cause an extra render cycle (one render with compound ID, then another after splitting). Deriving `baseModelId` and `initialReasoningLevel` inside `useMemo` completes in a single render pass.
  Date/Author: 2026-02-17

- Decision: Return `currentModelName` from `useAcpChat` to eliminate duplicate `availableModels.find()` calls.
  Rationale: Per Vercel React Best Practices `js-index-maps` rule. The original plan had `ChatInput.tsx`'s `triggerLabel` and `AcpChat.tsx`'s `modelDisplayName` prop both executing `availableModels.find((m) => m.id === currentModelId)`. Performing the lookup once in the hook and returning `currentModelName` eliminates the duplication.
  Date/Author: 2026-02-17

## Outcomes & Retrospective

All 4 milestones completed successfully. 145 TypeScript tests pass, 93 Rust tests pass, zero lint errors. Implementation followed the plan closely with one minor addition: non-compound models are preserved in dedup output to avoid breaking providers that return simple IDs alongside compound ones.

**Post-implementation corrections (2026-02-17):**

The plan's core assumption about Claude Agent SDK returning full display names (e.g., "Claude Opus 4.6") was wrong. The SDK returns short aliases ("Opus", "Sonnet", "Haiku", "Default (recommended)"). This was discovered during manual testing after the initial implementation. A `getDisplayName` fallback was attempted but proved unreliable and was reverted. The final approach shows `model.name` (alias) as the trigger label and `model.description` (contains version info) as secondary text in dropdown items for Claude Code only. Additionally, a stale-models-on-provider-switch bug was discovered and fixed by clearing state at the start of the `useAcpSession` effect.

Key lesson: Verify upstream data assumptions with actual SDK source code before finalizing the plan. The investigation chain (DeepWiki → claude-code-acp source → Claude Agent SDK source) revealed the truth only after deep inspection of the installed SDK package.

## Context and Orientation

This repository is a Tauri v2 desktop application with a React 19 + TypeScript frontend and a Rust backend. The app provides a chat interface that connects to AI agents via ACP (Agent Control Protocol). ACP is a JSON-RPC-based protocol where agents communicate via stdin/stdout. The Rust backend manages agent processes and relays protocol messages. The TypeScript frontend renders the chat UI.

Two ACP agent providers are currently supported:

1. **claude-code-acp** — Connects to Claude models. Returns model IDs like `"claude-sonnet-4-20250514"` with names like `"Claude Sonnet 4.5"` (or `"claude-opus-4-6"` -> `"Claude Opus 4.6"` etc). The `name` field originates from the Claude Agent SDK's `supportedModels()` -> `ModelInfo.displayName`, which matches the Anthropic API `/v1/models` `display_name` field. Does not support reasoning levels. Its `authenticate()` method throws "Method not implemented" because auth is handled externally.

2. **codex-acp** — Connects to OpenAI Codex models. Returns compound model IDs like `"gpt-5.3-codex/medium"` that embed reasoning level in the ID. Each model preset x reasoning effort is a separate entry. Reasoning levels are changed by sending the compound ID via `session/set_model`. Does NOT support `session/setConfigOption`.

Key files involved in model display:

- `packages/tauri-acp/src/types.ts` — Defines `AcpModel { id: string; name: string; description?: string }`. The `name` field is populated from upstream but currently unused in display.
- `src/features/acp-chat/format-model-id.ts` — `formatModelId(id)` function that transforms raw model IDs to display names (e.g., strips "claude" prefix, date suffixes). Currently the sole source of display names.
- `src/features/acp-chat/components/ChatInput.tsx` — Contains the model dropdown (`DropdownSelect`) that calls `formatModelId(m.id)` for display labels (lines 117, 119).
- `src/features/acp-chat/components/ChatMessageList.tsx` — Shows the model name in the empty chat state via `formatModelId(modelId)` (line 76).
- `src/features/acp-chat/hooks/useReasoningLevel.ts` — `getWireModelId()` appends `/{level}` to model IDs for the wire protocol (line 43).
- `src/features/acp-chat/hooks/useAcpChat.ts` — `handleSetModel()` (line 93) calls `getWireModelId()`, and `handleSetReasoningLevel()` (line 102) manually constructs `${currentModelId}/${level}`.
- `src/features/acp-chat/providers.ts` — `ProviderConfig` with `supportsReasoningLevel` boolean flag.
- `crates/tauri-plugin-acp/src/commands.rs` — `parse_available_models()` (line 335) parses model data from both providers, extracting `id`, `name`, and `description`. The `send_authenticate()` helper (called during session startup) triggers the "Method not implemented" error from claude-code-acp.

Test files:

- `src/features/acp-chat/format-model-id.test.ts` — 6 tests for `formatModelId()`
- `src/features/acp-chat/hooks/useReasoningLevel.test.ts` — 8 tests for reasoning level hook
- `src/features/acp-chat/hooks/useAcpChat.test.ts` — 12 tests for chat operations

## Plan of Work

### Milestone 1: Use `model.name` for Display

Both providers already return correct display names in `model.name`. Simply replace `formatModelId(m.id)` with `m.name`. No new functions needed.

**Step 1.1: ChatInput — change `renderLabel` to `m.name`**

`src/features/acp-chat/components/ChatInput.tsx` line 117:

    // Before
    renderLabel={(m) => formatModelId(m.id)}
    // After
    renderLabel={(m) => m.name}

**Step 1.2: Add `currentModelName` to `useAcpChat` return**

To avoid duplicate `availableModels.find()` calls (`js-index-maps` rule), perform the lookup once in `useAcpChat` and return the result:

    // Add before the return statement in useAcpChat.ts
    const currentModelName = displayModels.find((m) => m.id === currentModelId)?.name ?? null;

    return {
      ...
      currentModelName,
    };

This eliminates the need for duplicate `.find()` calls in both `ChatInput` and `AcpChat`.

**Step 1.3: ChatInput — use `currentModelName` for `triggerLabel`**

Add a `currentModelName` prop to `ChatInput` and use it for `triggerLabel`:

    // Add to ChatInputProps
    currentModelName: string | null;

    // Change line 119
    // Before
    triggerLabel={currentModelId ? formatModelId(currentModelId) : "Default"}
    // After
    triggerLabel={currentModelName ?? "Default"}

Since both `renderLabel` and `triggerLabel` no longer use `formatModelId`, its import can be removed from `ChatInput.tsx`.

**Step 1.4: ChatMessageList — add `modelDisplayName` prop**

`src/features/acp-chat/components/ChatMessageList.tsx` only receives `modelId` (string) and cannot directly access `model.name`. Add a `modelDisplayName?: string` prop:

    // Add to ChatMessageListProps
    modelDisplayName?: string;

    // Change line 76
    // Before
    {modelId ? <p className="acp-chat-empty-model">{formatModelId(modelId)}</p> : null}
    // After
    {modelId ? <p className="acp-chat-empty-model">{modelDisplayName || formatModelId(modelId)}</p> : null}

In the parent component `AcpChat.tsx` (line 190-197), pass `currentModelName` from `useAcpChat`:

    <ChatMessageList
      ...
      modelDisplayName={currentModelName}
    />

**Step 1.5: Clean up `formatModelId` imports**

`ChatInput.tsx` no longer uses `formatModelId` — remove the import. `ChatMessageList.tsx` keeps it as a fallback for `modelDisplayName`.

**Step 1.6: Verify**

    pnpm typecheck && pnpm test:run && pnpm lint

### Milestone 2: Separate Model and Reasoning Level for Codex

Deduplicate Codex compound model IDs using `useMemo` in `useAcpChat`. No new files, interfaces, or exported functions.

**Step 2.1: Add `useMemo` for deduplication + initial parse to `useAcpChat`**

Add a `useMemo` to `src/features/acp-chat/hooks/useAcpChat.ts`. Only parse compound IDs when `supportsReasoningLevel` is true. The initial `currentModelId` base/level split is also computed as derived state within the same `useMemo` (`rerender-derived-state-no-effect` rule: avoids extra render cycles from `useEffect` + `setState`):

    const { displayModels, reasoningLevelsMap, baseModelId, initialReasoningLevel } = useMemo(() => {
      if (!options.supportsReasoningLevel) {
        return { displayModels: availableModels, reasoningLevelsMap: null, baseModelId: currentModelId, initialReasoningLevel: null };
      }
      // Deduplicate models
      const map = new Map<string, string[]>();
      for (const m of availableModels) {
        const slash = m.id.indexOf("/");
        if (slash === -1) continue;
        const base = m.id.substring(0, slash);
        const level = m.id.substring(slash + 1);
        if (!map.has(base)) map.set(base, []);
        map.get(base)!.push(level);
      }
      const dedup: AcpModel[] = [...map.keys()].map((id) => ({ id, name: id }));
      // Split currentModelId into base and level if compound (derived state)
      let base = currentModelId;
      let level: string | null = null;
      if (currentModelId?.includes("/")) {
        const slash = currentModelId.indexOf("/");
        base = currentModelId.substring(0, slash);
        level = currentModelId.substring(slash + 1);
      }
      return { displayModels: dedup, reasoningLevelsMap: map, baseModelId: base, initialReasoningLevel: level };
    }, [availableModels, currentModelId, options.supportsReasoningLevel]);

Pass `displayModels` to the dropdown and `reasoningLevelsMap` to the reasoning level dropdown. Use `baseModelId` instead of `currentModelId` for display and sending.

**Step 2.2: No `useEffect` needed (derived state handles it)**

The `currentModelId` parsing is handled as derived state within Step 2.1's `useMemo`. No extra render cycles from `useEffect` + `setState`. This complies with Vercel React Best Practices `rerender-derived-state-no-effect` (5.1):

> If a value can be computed from current props/state, do not store it in state or update it in an effect. Derive it during render.

Note: The `reasoningLevel` initial value is set by `useReasoningLevel`'s `useState` lazy initializer, so `initialReasoningLevel` may need to be passed to `useReasoningLevel`. Coordinate with `useReasoningLevel`'s initialization logic during implementation.

**Step 2.3: `useReasoningLevel` hook — no changes needed**

`getWireModelId()` returns `${modelId}/${reasoningLevel}`. Since `currentModelId` will now be a base ID (no `/`), this works correctly. No changes needed.

**Step 2.4: `handleSetModel` / `handleSetReasoningLevel` — no changes**

The existing `handleSetModel` (line 93) calls `getWireModelId(modelId)`. Only the `modelId` changes (now a base ID), not the logic itself. `handleSetReasoningLevel` (line 102) also correctly reconstructs the compound ID via `${currentModelId}/${level}`.

**Step 2.5: Add `displayModels`, `reasoningLevelsMap`, and `currentModelName` to hook return**

Add to `useAcpChat` return:

    const currentModelName = displayModels.find((m) => m.id === (baseModelId ?? currentModelId))?.name ?? null;

    return {
      ...
      availableModels: displayModels,  // replaces existing availableModels
      currentModelName,  // used by ChatInput and AcpChat from Milestone 1
      reasoningLevels: reasoningLevelsMap?.get(baseModelId ?? currentModelId ?? "") ?? null,
      ...
    };

**Step 2.6: ChatInput — make reasoning level dropdown items dynamic**

In `ChatInput.tsx`'s reasoning level dropdown, use `reasoningLevels` from the hook instead of hardcoded `REASONING_LEVEL_ITEMS` (to support different levels per model).

**Step 2.7: Verify**

    pnpm typecheck && pnpm test:run

### Milestone 3: Handle `authenticate()` Error Gracefully

This milestone makes the Rust backend resilient to `authenticate()` failures from agents that don't implement authentication (like claude-code-acp).

**Step 3.1: Make `send_authenticate()` non-fatal**

In `crates/tauri-plugin-acp/src/commands.rs`, the `send_authenticate()` function is called during `acp_start_session()`. Currently, if it returns an error, session startup fails. Modify the caller to catch and log the error instead of propagating it.

In the `acp_start_session()` function, find where `send_authenticate()` is called:

    if let Some(ref result) = response.result {
        send_authenticate(&handle, result).await?;  // <-- this propagates errors
    }

Change to:

    if let Some(ref result) = response.result {
        if let Err(e) = send_authenticate(&handle, result).await {
            tracing::warn!(agent_id = %agent_id, "authenticate() failed (non-fatal): {}", e);
        }
    }

This allows session startup to continue even when authentication fails, which is correct for agents like claude-code-acp that handle auth externally.

**Step 3.2: Verify error handling**

Run `cargo test -p tauri-plugin-acp` to confirm all Rust tests pass. Then run `pnpm tauri dev` with claude-code-acp and verify that the "Method not implemented" error no longer prevents session startup.

### Milestone 4: Update Tests

No new exported functions, so no new test files needed. Update existing tests and add cases to `useAcpChat.test.ts`.

**Step 4.1: `useAcpChat.test.ts` — add compound model deduplication tests**

Add tests to `src/features/acp-chat/hooks/useAcpChat.test.ts` to verify Codex compound model ID deduplication:

    it("deduplicates compound model IDs when supportsReasoningLevel is true", () => {
      // When availableModels contains compound IDs,
      // displayModels should return deduplicated base models
    });

    it("derives base model ID and reasoning level from compound currentModelId", () => {
      // When currentModelId is "gpt-5.3-codex/medium",
      // it should be split into base ID "gpt-5.3-codex" and reasoningLevel "medium"
    });

**Step 4.2: `useAcpChat.test.ts` — update existing tests**

Update `setModel sends combined modelId/level when reasoning is supported` (line 158). Verify that `handleSetModel` receives a base model ID and `getWireModelId` reconstructs the compound ID.

**Step 4.3: Run all tests**

    pnpm typecheck
    pnpm test:run
    pnpm lint
    cargo test -p tauri-plugin-acp

## Concrete Steps

### Milestone 1 — Files changed: 4

    # Edit: src/features/acp-chat/hooks/useAcpChat.ts — add currentModelName to return
    # Edit: src/features/acp-chat/components/ChatInput.tsx — change renderLabel to m.name, triggerLabel to currentModelName
    # Edit: src/features/acp-chat/components/ChatMessageList.tsx — add modelDisplayName prop
    # Edit: src/features/acp-chat/components/AcpChat.tsx — pass currentModelName to ChatInput and ChatMessageList

    pnpm typecheck && pnpm test:run && pnpm lint

### Milestone 2 — Files changed: 1-2

    # Edit: src/features/acp-chat/hooks/useAcpChat.ts — useMemo for deduplication, initial parse, return update
    # Edit: src/features/acp-chat/components/ChatInput.tsx — dynamic reasoning level items (if needed)

    pnpm typecheck && pnpm test:run

### Milestone 3 — Files changed: 1

    # Edit: crates/tauri-plugin-acp/src/commands.rs — make send_authenticate() non-fatal

    cargo test -p tauri-plugin-acp

### Milestone 4 — Files changed: 1

    # Edit: src/features/acp-chat/hooks/useAcpChat.test.ts — add compound model tests, update existing tests

    pnpm typecheck && pnpm test:run && pnpm lint
    cargo test -p tauri-plugin-acp

### Final: Create Pull Request

    gh pr create --title "..." --body "..."

Use `gh pr create` with an English title and body.

### Final Manual Verification

    pnpm tauri dev

    # Claude Code: trigger shows "Sonnet", "Opus", etc. Dropdown items show name + description
    # Codex: deduplicated model names + reasoning level dropdown works
    # authenticate error does not block session startup

## Validation and Acceptance

After all milestones are complete:

1. `pnpm typecheck` — no type errors
2. `pnpm test:run` — all tests pass
3. `pnpm lint` — no lint errors
4. `cargo test -p tauri-plugin-acp` — all Rust tests pass
5. `pnpm tauri dev` — app works with both providers

Acceptance criteria:

- Claude Code: Model dropdown trigger shows `model.name` (e.g., "Sonnet", "Opus"). Expanded dropdown shows `model.name` + `model.description` as two-line items. Empty chat state shows `model.name`.
- Codex: Model dropdown shows deduplicated base models. Reasoning level dropdown works.
- `authenticate` error does not block session startup.

## Idempotence and Recovery

Each milestone is independently committable:

- Milestone 1: Display label changes only. If interrupted, `formatModelId()` still works as fallback.
- Milestone 2: `useMemo` addition in `useAcpChat`. If interrupted, existing compound ID display still works.
- Milestone 3: Single line change in Rust. If interrupted, existing behavior (error propagation) continues.
- Milestone 4: Test additions/updates only. No risk.

Recovery: `git checkout -- <file>` to restore individual files.

## Artifacts and Notes

### Current Display vs Final Display

    Claude Code models:
      Trigger (selected):
        "Default (recommended)" / "Sonnet" / "Opus" / "Haiku"  (= model.name, alias from SDK)

      Dropdown items (expanded):
        "Default (recommended)"                                  <- model.name (bold)
        "Use the default model (currently Sonnet 4.5) · ..."     <- model.description (secondary)

        "Sonnet"                                                  <- model.name (bold)
        "Sonnet 4.5 · Best for everyday tasks"                   <- model.description (secondary)

        "Opus"                                                    <- model.name (bold)
        "Opus 4.6 · Most capable for complex work"               <- model.description (secondary)

        "Haiku"                                                   <- model.name (bold)
        "Haiku 4.5 · Fastest for quick answers"                  <- model.description (secondary)

    Note: SDK returns aliases as displayName, NOT full API display_name.
      description field provides version-qualified names as secondary text.

    Codex models:
      Current:  Model dropdown shows "Gpt 5.3 Codex/medium", "Gpt 5.3 Codex/high", etc. (18 entries)
      Proposed: Model dropdown shows "gpt-5.3-codex", "o4-mini" (deduplicated, 3 entries)
                Reasoning dropdown shows "low", "medium", "high" (per selected model)

### Wire Protocol Fix

    Before (double-encoding risk):
      User selects model "gpt-5.3-codex/medium" from dropdown
      getWireModelId("gpt-5.3-codex/medium") -> "gpt-5.3-codex/medium/medium"
      session.setModel("gpt-5.3-codex/medium/medium")  <- BUG

    After (separate model + reasoning):
      User selects base model "gpt-5.3-codex" from model dropdown
      User selects "medium" from reasoning dropdown
      getWireModelId("gpt-5.3-codex") -> "gpt-5.3-codex/medium"
      session.setModel("gpt-5.3-codex/medium")  <- CORRECT

      User changes reasoning to "high":
      handleSetReasoningLevel("high")
      currentModelId = "gpt-5.3-codex" (base model)
      session.setModel("gpt-5.3-codex/high")  <- CORRECT

### Scope Explicitly Excluded

The following items are intentionally deferred or excluded:

1. **`session/setConfigOption` support**: codex-acp does not currently implement this method. If codex-acp adds support in the future, implementing it in our Rust backend + TypeScript SDK would allow cleaner model/reasoning separation.
2. ~~**DropdownSelect two-line items (showing both name and ID)**~~: Implemented — dropdown now shows `model.name` + `model.description` as two-line items for Claude Code. `renderLabel` changed from `string` to `ReactNode`.
3. ~~**Description tooltips on dropdown items**~~: Superseded by inline description display in dropdown items.
4. **Dynamic `supportsReasoningLevel` detection**: Kept hardcoded in `providers.ts` per user decision.
5. **Custom model ID-to-display-name mapping table**: Not needed. Use `model.name` directly.
6. **Dedicated utility functions/files**: `getModelDisplayName()`, `parseCompoundModels()`, `buildCompoundModelId()`, etc. are not created. Inline processing is sufficient.

## Interfaces and Dependencies

### New files, functions, interfaces: None

### TypeScript files changed

- `src/features/acp-chat/components/ChatInput.tsx` — `renderLabel` shows `model.name` + `model.description` two-line for Claude Code, `currentModelName` for `triggerLabel`
- `src/features/acp-chat/components/ChatMessageList.tsx` — add `modelDisplayName` prop
- `src/features/acp-chat/components/AcpChat.tsx` — pass `currentModelName` to ChatInput and ChatMessageList
- `src/features/acp-chat/components/DropdownSelect.tsx` — `renderLabel` return type changed from `string` to `ReactNode`
- `src/features/acp-chat/components/AcpChat.css` — added `.acp-chat-model-option` styles, dropdown `width: max-content`
- `src/features/acp-chat/hooks/useAcpChat.ts` — `useMemo` for compound ID deduplication + derived state parse, add `currentModelName` to return
- `src/features/acp-chat/hooks/useAcpSession.ts` — clear stale state at start of effect on provider switch
- `src/features/acp-chat/hooks/useAcpChat.test.ts` — add/update tests

### Rust files changed

- `crates/tauri-plugin-acp/src/commands.rs` — make `send_authenticate()` error non-fatal

### New dependencies: None

## Appendix: Raw Data Flow — Full Path of Model Data Retrieval, Transformation, and Transmission

This section covers the raw data returned by codex-acp and claude-code-acp, how this app processes it, and how it sends data back to the agents, at the protocol level.

### A1. Protocol Sequence at Session Startup

The app's Rust backend (`commands.rs:285-332` `acp_start_session()`) sends JSON-RPC requests in this order:

    1. initialize  ->  agent returns capabilities and authMethods
    2. authenticate ->  sent only when authMethods is returned
    3. session/new  ->  creates session, returns model list

### A2. Raw Data from codex-acp

#### A2.1 `session/new` Response Models Section (Raw JSON)

codex-acp includes the following structure in its `session/new` result. Each model preset x reasoning level combination is a separate entry:

    {
      "sessionId": "...",
      "models": {
        "current_model_id": "gpt-5.3-codex/medium",
        "available_models": [
          {
            "model_id": "gpt-5.3-codex/low",
            "name": "gpt-5.3-codex (low)",
            "description": "GPT 5.3 Codex with low reasoning effort"
          },
          {
            "model_id": "gpt-5.3-codex/medium",
            "name": "gpt-5.3-codex (medium)",
            "description": "GPT 5.3 Codex with medium reasoning effort"
          },
          {
            "model_id": "gpt-5.3-codex/high",
            "name": "gpt-5.3-codex (high)",
            "description": "GPT 5.3 Codex with high reasoning effort"
          },
          {
            "model_id": "o4-mini/minimal",
            "name": "o4-mini (minimal)",
            "description": "o4-mini with minimal reasoning effort"
          }
        ]
      }
    }

Field names are **snake_case** (`model_id`, `available_models`, `current_model_id`).

#### A2.2 Model ID Construction Rules

codex-acp constructs model IDs in `"{preset_id}/{reasoning_effort}"` format (via `model_id()` method). `ReasoningEffort` enum values: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`.

    ModelInfo::new(
        Self::model_id(&preset.id, effort.effort),           // -> "gpt-5.3-codex/medium"
        format!("{} ({})", preset.display_name, effort.effort), // -> "gpt-5.3-codex (medium)"
    )
    .description(format!("{} {}", preset.description, effort.description))

#### A2.3 Sending to `session/set_model` and `parse_model_id()`

codex-acp's `set_session_model` handler decomposes the received `model_id` using `parse_model_id()`:

    parse_model_id("gpt-5.3-codex/medium")
      -> model: "gpt-5.3-codex"
      -> reasoning_effort: ReasoningEffort::Medium

It splits on `split_once('/')` and deserializes the second part as `ReasoningEffort`. **The `/`-separated format (first part = model, second part = reasoning level) is codex-acp's official specification.**

### A3. Raw Data from claude-code-acp

#### A3.1 `session/new` Response Models Section (Raw JSON)

claude-code-acp calls `getAvailableModels()` within `createSession()`, converting from Claude Agent SDK `ModelInfo` objects:

    {
      "sessionId": "...",
      "models": {
        "availableModels": [
          {
            "modelId": "default",
            "name": "Default (recommended)",
            "description": "Use the default model (currently Sonnet 4.5) · Great balance of speed and capability"
          },
          {
            "modelId": "opus",
            "name": "Opus",
            "description": "Opus 4.6 · Most capable for complex work"
          },
          {
            "modelId": "sonnet",
            "name": "Sonnet",
            "description": "Sonnet 4.5 · Best for everyday tasks"
          },
          {
            "modelId": "haiku",
            "name": "Haiku",
            "description": "Haiku 4.5 · Fastest for quick answers"
          }
        ],
        "currentModelId": "sonnet"
      }
    }

Field names are **camelCase** (`modelId`, `availableModels`, `currentModelId`).

`ModelInfo`'s `value` field maps to `modelId`, and `displayName` maps to `name`. **IMPORTANT:** The SDK's `displayName` returns short aliases ("Sonnet", "Opus"), NOT the Anthropic API's `display_name` ("Claude Sonnet 4.5"). The `description` field contains version-qualified names (e.g., "Sonnet 4.5 · Best for everyday tasks"). Model IDs are short aliases ("sonnet", "opus", "haiku", "default"), not full API identifiers.

#### A3.1.1 displayName Source Chain (CORRECTED)

    Claude Agent SDK: supportedModels() -> ModelInfo { value: "opus", displayName: "Opus", description: "Opus 4.6 · Most capable for complex work" }
                            |
    claude-code-acp: getAvailableModels() -> { modelId: model.value, name: model.displayName, description: model.description }
                            |
    ACP wire: session/new response -> { "modelId": "opus", "name": "Opus", "description": "Opus 4.6 · ..." }
                            |
    Rust backend: parse_available_models() -> AcpModelInfo { id: "opus", name: "Opus", description: Some("Opus 4.6 · ...") }
                            |
    Frontend: AcpModel { id: "opus", name: "Opus", description: "Opus 4.6 · Most capable for complex work" }

Note: The SDK does NOT pass through the Anthropic API's `display_name` ("Claude Opus 4.6"). It uses its own alias system. The `description` field is the richest source of display information. The frontend shows `model.name` as the trigger label and `model.description` as secondary text in dropdown items.

#### A3.2 Reasoning Levels

claude-code-acp does **not** support reasoning levels. Model IDs are simple strings without `/`-based compound IDs.

#### A3.3 `authenticate()` "Method not implemented" Error

claude-code-acp's `initialize` response may return `authMethods`. However, the `authenticate` method explicitly throws an error:

    authenticate() {
      throw new Error("Method not implemented.");
    }

Authentication is handled externally via `claude /login`, so ACP protocol-level authentication is unnecessary. But when `authMethods` is returned, the app's Rust backend sends an `authenticate` request, receives this error, and session startup fails.

### A4. Transformation in the App's Rust Backend

#### A4.1 `parse_available_models()` (`commands.rs:335-370`)

Absorbs both formats:

    Field lookup order:
      id:   m.get("modelId") -> m.get("model_id")
      name: m.get("name") -> fallback to id
      desc: m.get("description")
    Array lookup order:
      models_obj.get("availableModels") -> models_obj.get("available_models")
    currentModelId lookup order:
      models_obj.get("currentModelId") -> models_obj.get("current_model_id")

The result is `AcpModelInfo { id: String, name: String, description: Option<String> }`, sent to the frontend as `SessionInfoResponse` JSON. **No information is lost in this transformation** — the upstream `name` field is preserved as-is.

#### A4.2 `acp_set_model()` (`commands.rs:472-495`)

Receives a `model_id` string from the frontend and sends the following JSON-RPC request:

    Wire method name: "session/set_model"
    Parameters: { "sessionId": "...", "modelId": "..." }

Both codex-acp and claude-code-acp use the `@agentclientprotocol/sdk` `SetSessionModelRequest` type, with wire method name `session/set_model`. claude-code-acp names it `unstable_setSessionModel` internally, but it's the same `session/set_model` on the wire.

### A5. Frontend Display and Send Flow

#### A5.1 Current Flow (Broken)

    [Backend] AcpModel { id: "gpt-5.3-codex/medium", name: "gpt-5.3-codex (medium)" }
                                  |
    [ChatInput]   formatModelId("gpt-5.3-codex/medium")  ->  "Gpt 5.3 Codex/medium" (broken display)
                  model.name is ignored
                                  |
    [setModel]    getWireModelId("gpt-5.3-codex/medium")  ->  "gpt-5.3-codex/medium/medium" (double-encoding)
                                  |
    [Backend] session/set_model { modelId: "gpt-5.3-codex/medium/medium" }  ->  codex-acp parse error or wrong model

    [Backend] AcpModel { id: "opus", name: "Opus", description: "Opus 4.6 · Most capable..." }
                                  |
    [ChatInput]   formatModelId("opus")  ->  "Opus" (ignores description, no version info shown)
                                  |
    [setModel]    getWireModelId("opus")  ->  "opus" (send is fine)

#### A5.2 Proposed Flow

**Codex (separate model and reasoning level):**

    [Backend] AcpModel[] = [
      { id: "gpt-5.3-codex/low", name: "gpt-5.3-codex (low)" },
      { id: "gpt-5.3-codex/medium", name: "gpt-5.3-codex (medium)" },
      { id: "gpt-5.3-codex/high", name: "gpt-5.3-codex (high)" },
    ]
                                  |
    [useMemo dedup]  ->  displayModels: [{ id: "gpt-5.3-codex", name: "gpt-5.3-codex" }]
                              reasoningLevelsMap: Map { "gpt-5.3-codex" -> ["low","medium","high"] }
                                  |
    [ChatInput model dropdown]    "gpt-5.3-codex" (deduplicated)
    [ChatInput reasoning dropdown]  "low" | "medium" | "high"
                                  |
    [handleSetModel("gpt-5.3-codex")]
      getWireModelId("gpt-5.3-codex")  ->  "gpt-5.3-codex/medium"
      session.setModel("gpt-5.3-codex/medium")
                                  |
    [Backend] session/set_model { modelId: "gpt-5.3-codex/medium" }

    [handleSetReasoningLevel("high")]
      session.setModel("gpt-5.3-codex/high")   <- currentModelId is "gpt-5.3-codex" (base ID)
                                  |
    [Backend] session/set_model { modelId: "gpt-5.3-codex/high" }

**Claude Code (description as secondary text):**

    [Backend] AcpModel { id: "opus", name: "Opus", description: "Opus 4.6 · Most capable for complex work" }
               Note: name is SDK alias, NOT Anthropic API display_name
                                  |
    [ChatInput trigger]   model.name  ->  "Opus" (selected state)
    [ChatInput dropdown]  model.name + model.description  ->  "Opus" + "Opus 4.6 · Most capable..." (two-line item)
                                  |
    [setModel]    sends model.id as-is  ->  "opus"
                                  |
    [Backend] session/set_model { modelId: "opus" }

### A6. Resolved Questions

The following questions have been resolved through research and discussion:

1. **Is a Codex Reasoning Level dropdown needed?** -> **Yes.** Match Codex CLI's UX (model selection -> reasoning level selection). Implemented by parsing/deduplicating compound IDs on the frontend.

2. **How to handle the `supportsReasoningLevel` flag:** -> **Keep hardcoded.** Manually set per provider in `providers.ts`.

3. **`session/setConfigOption` support:** -> **Not needed (codex-acp does not implement it).** Confirmed via DeepWiki that codex-acp does not implement `session/setConfigOption`. Zed editor has a client-side implementation, but codex-acp doesn't support it, so it's unusable. Reasoning level changes use compound IDs via `session/set_model`.

---

Plan Revision Note:

- 2026-02-16: Initial version created. Research performed by three parallel agents: UX Analyst (proposed using `model.name`), Technical Architect (identified double-encoding bug, wire protocol details, upstream agent behavior), and Devil's Advocate (challenged raw-ID approach, identified `authenticate()` as error source, recommended tight scope). All three converged on using `model.name` as the primary fix. Scope deliberately kept tight to display changes + wire protocol fix + auth error handling.
- 2026-02-16: Appendix A1-A6 added. Covered raw data flows from codex-acp and claude-code-acp (method names, raw JSON, transformations, send paths) based on DeepWiki research + Rust backend code review.
- 2026-02-17: Full ExecPlan revision reflecting all decisions. (1) Separated Codex model and reasoning level (matching Codex CLI UX). (2) supportsReasoningLevel kept hardcoded. (3) session/setConfigOption rejected (codex-acp doesn't implement it) -> frontend parses/reconstructs compound IDs via session/set_model. Milestone 2 fully rewritten from "Fix wire protocol" to "Separate model and reasoning level for Codex". A5.2 updated with new data flow diagrams. A6 questions marked as resolved.
- 2026-02-17: Investigated and confirmed source of claude-code-acp's `name` field. Claude Agent SDK `supportedModels()` -> `ModelInfo.displayName` (e.g., "Claude Opus 4.6") maps to `name`. Matches Anthropic API `/v1/models` `display_name` field. Added decision that custom mapping table is unnecessary. Recorded in Surprises & Discoveries. Updated display examples to actual model names. Added A3.1 sample JSON and A3.1.1 (displayName source chain diagram).
- 2026-02-17: Major simplification from complexity review. (1) Removed `getModelDisplayName()` -> use `m.name` inline. (2) Removed `parseCompoundModels()` / `buildCompoundModelId()` / `ParsedModelInfo` / `compoundModels.ts` -> absorbed into `useMemo` in `useAcpChat`. (3) Removed IIFE `currentModelLabel` -> one-liner with `?.name ?? formatModelId()`. (4) New files 2->0, new interfaces 1->0, new exported functions 3->0. Tests simplified to additions in `useAcpChat.test.ts` only.
- 2026-02-17: Two improvements from Vercel React Best Practices review. (1) `rerender-derived-state-no-effect` (5.1): Changed Step 2.2's initial compound ID parsing from `useEffect` + `setState` to derived state in `useMemo`. Avoids extra render cycle. (2) `js-index-maps`: Eliminated duplicate `availableModels.find()` — `useAcpChat` now returns `currentModelName`, removing the need for identical lookups in `ChatInput` and `AcpChat`. Renumbered Milestone 1 steps. Added 2 Decision Log entries.
- 2026-02-17: Translated entire plan to English. Added Workflow section: create topic branch `feature/model-display-improvement`, use `tdd-workflow` skill for implementation, create PR with `gh pr create` in English.
- 2026-02-17: **Critical correction** — Claude Agent SDK returns aliases ("Sonnet", "Opus"), NOT full display names ("Claude Sonnet 4.5"). Investigation of actual SDK source (`@anthropic-ai/claude-agent-sdk@0.2.34`) revealed `displayName` is a UI alias, not the Anthropic API `display_name`. Corrected A3.1 sample JSON (model IDs are "sonnet"/"opus"/"haiku"/"default", not full API IDs), A3.1.1 source chain, A5.1/A5.2 data flows, display examples, and acceptance criteria. Reverted `getDisplayName` fallback (wrong assumption). Adopted description-as-secondary-text approach: dropdown items show `model.name` (bold) + `model.description` (secondary) for Claude Code. `DropdownSelect.renderLabel` changed from `string` to `ReactNode`. Added stale-models-on-provider-switch fix to `useAcpSession.ts`. Added `width: max-content` to dropdown menu CSS.
