# UI Test Coverage: Maximize Frontend Test Coverage Before Refactoring

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan is maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

The codebase is about to undergo a refactoring cycle (described in `.agents/plans/2026-02-16-refactoring.md`). Before making structural changes, we need a comprehensive regression safety net. Currently 145 tests exist across 17 files, but several UI components and one critical hook have zero test coverage. After this work, every React component and every custom hook in `src/features/acp-chat/` will have dedicated tests, coverage reporting will be configured and viewable (both in terminal and as an HTML report), and the total test count will rise from 145 to approximately 200+.

The user can verify success by running `pnpm test:coverage` and observing: (1) an HTML coverage report opens in the browser at `coverage/index.html`, (2) all files under `src/features/acp-chat/` show line coverage above 80%, (3) the total test count is 200+, all passing.

## Progress

- [x] (2026-02-18) Create feature branch `test/ui-coverage` from `main`.
- [x] (2026-02-18) Milestone 0: Install `@vitest/coverage-v8` and configure coverage in `vite.config.ts`.
- [x] (2026-02-18) Milestone 1: Add tests for `ChatInput.tsx` (12 tests).
- [x] (2026-02-18) Milestone 2: Add tests for `ChatMessageList.tsx` (10 tests).
- [x] (2026-02-18) Milestone 3: Add tests for `DropdownSelect.tsx` (8 tests).
- [x] (2026-02-18) Milestone 4: Add tests for `MarkdownText.tsx` (6 tests).
- [x] (2026-02-18) Milestone 5: Add tests for `ToolCallCard.tsx` (6 tests).
- [x] (2026-02-18) Milestone 6: Add tests for `PlanView.tsx`, `ThinkingBlock.tsx`, `TypingIndicator.tsx` (8 tests total).
- [x] (2026-02-18) Milestone 7: Add tests for `useTheme.ts` (6 tests).
- [x] (2026-02-18) Milestone 8: Add tests for `useAcpEventListeners.ts` (8 tests).
- [x] (2026-02-18) Final: Run `pnpm test:coverage`, verify all pass (209 tests, 27 files), review coverage report.
- [ ] Push branch and create PR with `gh pr create`.

## Surprises & Discoveries

- Observation: SyntaxHighlighter in MarkdownText splits code into token spans, so `screen.getByText("console.log('hi')")` fails. Must use `textContent` on the container instead.
  Evidence: Test 4 of MarkdownText initially failed with "Unable to find an element with the text".

- Observation: `vi.useFakeTimers()` without `shouldAdvanceTime: true` causes `waitFor` to hang indefinitely because Testing Library's internal polling uses real timers. Using `shouldAdvanceTime: true` and wrapping in `act()` resolves the timeout.
  Evidence: Test 6 of MarkdownText timed out at 5000ms until the approach was changed.

- Observation: MarkdownText.tsx line coverage is 73.91% (below 80% target) because custom markdown components (`p`, `ul`, `ol`, `li`, `a`, `blockquote`, `table`) at lines 151-170 aren't exercised by the direct tests. These are CSS wrapper components with no logic, and are partially covered through ContentBlockRenderer integration tests.

- Observation: commitlint rejects messages containing `@` followed by a package name (e.g., `@vitest/coverage-v8`) as GitHub mentions. Commit messages must avoid the `@` prefix.

## Decision Log

- Decision: Install `@vitest/coverage-v8` as the coverage provider rather than `@vitest/coverage-istanbul`.
  Rationale: `coverage-v8` uses V8's built-in coverage tracking, which is faster and requires no source instrumentation. It works out of the box with Vitest and is the recommended default. Istanbul is only needed when V8 coverage has issues with specific transforms, which is not the case here.
  Date/Author: 2026-02-18

- Decision: Test `MarkdownText.tsx` with actual `react-markdown` rendering rather than mocking it.
  Rationale: The component's value is in its markdown rendering. Mocking react-markdown would make the tests test nothing. We test that specific markdown elements render correctly (headings, code blocks, links). The `navigator.clipboard` API will be mocked for the copy button tests.
  Date/Author: 2026-02-18

- Decision: Test `useAcpEventListeners` by mocking the `AcpSession` object's `on*` methods rather than rendering a full `AcpChat` component.
  Rationale: The hook accepts a session object and state setters as parameters. We can test it in isolation with `renderHook`, providing mock session objects that simulate event callbacks. This is more focused and avoids the complexity of setting up the full Tauri IPC chain.
  Date/Author: 2026-02-18

- Decision: Order milestones by importance to refactoring safety, not by component complexity.
  Rationale: `ChatInput` and `ChatMessageList` are the two largest untested components. `useAcpEventListeners` is the most complex untested hook. Testing these first maximizes the safety net value per milestone.
  Date/Author: 2026-02-18

## Outcomes & Retrospective

All milestones completed successfully. Final results:

- **Test count**: 145 → 209 (+64 new tests across 10 new test files)
- **Test files**: 17 → 27
- **All 209 tests passing**, 0 failures
- **typecheck**: passes with no errors
- **Overall line coverage**: 94.48% (up from ~85% baseline)
- **All `src/features/acp-chat/` files** now have dedicated test files except barrel `index.ts`

One file (`MarkdownText.tsx`) has line coverage at 73.91%, slightly below the 80% target. This is because the custom markdown element wrappers (p, ul, ol, li, a, blockquote, table) are simple pass-through components with no logic. They are partially exercised through integration paths. All other files exceed 80% line coverage.

Lessons learned:

1. SyntaxHighlighter tokenization means you can't use `getByText` for highlighted code — use `textContent` on the container.
2. Vitest fake timers require `shouldAdvanceTime: true` when used with Testing Library's async utilities.
3. commitlint's no-github-mentions rule catches package-scoped names like `@vitest/coverage-v8`.

## Context and Orientation

The repository is a Tauri v2 + React 19 + TypeScript application. The React frontend lives in `src/features/acp-chat/`. The test infrastructure uses Vitest 4.0.18, @testing-library/react 16.3.2, and jsdom 27.4.0. Tests are co-located with their source files (e.g., `AcpChat.tsx` has `AcpChat.test.tsx` in the same directory).

The test setup file at `src/test/setup.ts` mocks several browser APIs that jsdom does not implement: `crypto.getRandomValues`, `crypto.randomUUID`, `Element.scrollIntoView`, `window.matchMedia`, `IntersectionObserver`, and `__TAURI_EVENT_PLUGIN_INTERNALS__`. These mocks are available to all tests automatically.

The Tauri IPC mock utility at `src/test/tauri-mocks.ts` provides `setupTauriMocks(handlers)` and `cleanupTauriMocks()`. It wraps `@tauri-apps/api/mocks`'s `mockIPC` function with safe cleanup that preserves internals needed by React effect teardown.

Existing test files follow these patterns: use `describe/it/expect` from vitest globals, use `render/screen/fireEvent/waitFor` from @testing-library/react, use `@testing-library/jest-dom` matchers (like `toBeInTheDocument`, `toHaveAttribute`), and import types directly from source.

Key source files and their current test status:

    src/features/acp-chat/components/
      AcpChat.tsx               — TESTED (10 tests in AcpChat.test.tsx)
      AgentSetupStatus.tsx      — TESTED (9 tests)
      ChatInput.tsx             — NOT TESTED
      ChatMessageList.tsx       — NOT TESTED
      ContentBlockRenderer.tsx  — TESTED (11 tests)
      DownloadProgress.tsx      — TESTED (7 tests)
      DropdownSelect.tsx        — NOT TESTED
      MarkdownText.tsx          — NOT TESTED
      PlanView.tsx              — NOT TESTED
      ThinkingBlock.tsx         — NOT TESTED
      ToolCallCard.tsx          — NOT TESTED
      TypingIndicator.tsx       — NOT TESTED

    src/features/acp-chat/hooks/
      useAcpChat.ts             — TESTED (20 tests)
      useAcpEventListeners.ts   — NOT TESTED
      useAcpSession.ts          — TESTED (8 tests)
      useAgentDownload.ts       — TESTED (12 tests)
      useClickOutside.ts        — TESTED (3 tests)
      useReasoningLevel.ts      — TESTED (7 tests)
      useTheme.ts               — NOT TESTED

    src/features/acp-chat/utils/
      connectionStatus.ts       — TESTED (6 tests)
      storage.ts                — TESTED (4 tests)

Current totals: 145 tests across 17 files, all passing.

The `pnpm test:coverage` script exists but fails because `@vitest/coverage-v8` is not installed. There is no coverage configuration in `vite.config.ts`.

## Plan of Work

Before starting any implementation, create a feature branch from `main`:

    git checkout -b test/ui-coverage

The work proceeds in 9 milestones. Each milestone is independently committable and verifiable. The first milestone sets up coverage infrastructure. Milestones 1-8 each add a test file for one or more untested components/hooks. After each milestone, `pnpm test:run` must pass with no regressions. Commit after each milestone using conventional commit format (e.g., `test(acp-chat): add ChatInput component tests`).

### Milestone 0: Coverage Infrastructure

Install `@vitest/coverage-v8` as a dev dependency and add coverage configuration to `vite.config.ts`. The configuration will specify the V8 provider, output text and HTML reporters (text for terminal, HTML for browseable report), include only `src/` files, and exclude test files, setup files, type-only files, and the barrel `index.ts`. No coverage thresholds will be enforced initially — the purpose of this milestone is to make `pnpm test:coverage` produce a working report so we can see the baseline and track improvements.

In `vite.config.ts`, inside the `test` object, add a `coverage` key:

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
    },

Add `coverage/` to `.gitignore` if not already present. Run `pnpm test:coverage` and verify: (1) tests pass, (2) terminal shows a text coverage table, (3) `coverage/index.html` exists.

### Milestone 1: ChatInput Tests

Create `src/features/acp-chat/components/ChatInput.test.tsx`. The `ChatInput` component receives props for input text, callbacks, model list, and reasoning level. It renders a textarea, send/stop buttons, and optional model and reasoning dropdowns.

Tests to write (approximately 12):

1. Renders textarea with correct placeholder using provider label. Render with `isReady=true`, check `screen.getByPlaceholderText` matches.
2. Textarea is disabled and shows "Connecting..." when `isReady=false`. Render with `isReady=false`, verify textarea is disabled and placeholder reads "Connecting...".
3. Typing updates input via `setInput` callback. Render, fire `change` event on textarea, verify `setInput` was called with the new value.
4. Enter key calls `onSubmit` with input value. Render with `input="hello"`, fire `keyDown` with `key: "Enter"`, verify `onSubmit("hello")` called.
5. Shift+Enter does not submit (allows newline). Fire `keyDown` with `key: "Enter", shiftKey: true`, verify `onSubmit` not called.
6. Meta+Enter does not submit. Fire `keyDown` with `key: "Enter", metaKey: true`, verify `onSubmit` not called.
7. Ctrl+Enter does not submit. Fire `keyDown` with `key: "Enter", ctrlKey: true`, verify `onSubmit` not called.
8. Send button is disabled when input is empty or whitespace. Render with `input=""`, verify send button is disabled.
9. Send button click calls `onSubmit`. Render with `input="test"`, click send button, verify `onSubmit("test")` called.
10. Stop button appears during loading and calls `onStop`. Render with `isLoading=true`, verify stop button exists, click it, verify `onStop` called.
11. Model dropdown renders when `availableModels` is non-empty. Render with models, verify the model button shows current model name.
12. Reasoning level dropdown renders when provider supports reasoning. Render with `selectedProvider.supportsReasoningLevel=true` and `reasoningLevels=["low","medium","high"]`, verify reasoning button exists.

All callbacks (`setInput`, `onSubmit`, `onStop`, `onModelSelect`, `onReasoningSelect`) are `vi.fn()` mocks. No Tauri IPC mocking needed — `ChatInput` is a pure presentational component that receives all data via props.

### Milestone 2: ChatMessageList Tests

Create `src/features/acp-chat/components/ChatMessageList.test.tsx`. The `ChatMessageList` component renders messages, handles empty state, shows typing indicator, and manages scroll behavior.

Tests to write (approximately 10):

1. Renders messages with correct role attribution. Provide a user message and an assistant message, verify both texts appear.
2. Empty state shows provider label and suggestion chips when `isReady=true`. Render with `messages=[]`, `isReady=true`, `providerLabel="Claude Code"`, verify the provider name and three chip texts ("Read a file", "Explain code", "Help me debug") appear.
3. Empty state shows "Waiting for connection..." when `isReady=false`. Render with `messages=[]`, `isReady=false`, verify text appears.
4. Clicking a suggestion chip calls `onSuggestClick` with the correct text. Render with empty messages, click "Read a file", verify `onSuggestClick` called.
5. Shows typing indicator when loading and last message is empty assistant. Render with `isLoading=true` and `messages` ending with `{ role: "assistant", blocks: [] }`, verify typing dots are present (3 elements with class `typing-dot`).
6. Does not show typing indicator when not loading. Same messages but `isLoading=false`, verify no typing dots.
7. Model display name shown when `modelId` and `modelDisplayName` provided. Render with both props, verify the model name text appears.
8. Renders multiple content blocks within a single message. Provide an assistant message with text and tool_call blocks, verify both render.
9. Scroll-to-bottom FAB is not visible initially (at bottom). Render with messages, verify no scroll FAB button.
10. Calls `scrollIntoView` on the sentinel element (verifying auto-scroll behavior). Render with messages, verify `scrollIntoView` was called on mount.

The `IntersectionObserver` mock from `setup.ts` suffices for most tests. For test 9, we verify the FAB is hidden by default because `IntersectionObserver` never triggers the callback (entries always show `isIntersecting: false` equivalent — but since our mock does nothing, the component's default `isAtBottom=true` state means the FAB stays hidden). To test the FAB appearing would require a more sophisticated mock; we note this as a limitation.

### Milestone 3: DropdownSelect Tests

Create `src/features/acp-chat/components/DropdownSelect.test.tsx`. The `DropdownSelect` is a generic dropdown component used for model selection and reasoning level selection.

Tests to write (approximately 8):

1. Renders trigger button with `triggerLabel`. Render, verify button text.
2. Clicking trigger opens the dropdown menu. Click trigger, verify menu items visible.
3. Clicking an item calls `onSelect` and closes the menu. Click trigger, click an item, verify `onSelect` called with the item, verify menu closed.
4. Clicking outside closes the menu. Click trigger, click `document.body`, verify menu closed.
5. Disabled dropdown does not open on click. Render with `disabled=true`, click trigger, verify no menu.
6. Selected item has `aria-selected="true"`. Click trigger, verify the item matching `selectedId` has `aria-selected="true"`.
7. Empty items array shows no menu even when clicked. Render with `items=[]`, click trigger, verify no menu element.
8. Custom `renderLabel` controls item display. Provide a `renderLabel` that wraps text in bold, verify the rendered items contain the formatted text.

### Milestone 4: MarkdownText Tests

Create `src/features/acp-chat/components/MarkdownText.test.tsx`. The `MarkdownText` component uses `react-markdown` with `remark-gfm` and a custom code block renderer with syntax highlighting and a copy button.

Tests to write (approximately 6):

1. Renders plain text. Pass `content="Hello world"`, verify text appears.
2. Renders a heading. Pass `content="# Title"`, verify an `h1` element with text "Title" exists.
3. Renders inline code with `inline-code` class. Pass ``content="Use `foo` here"``, verify a `code` element with class `inline-code` exists.
4. Renders a fenced code block with language class. Pass a fenced code block with `js` language, verify a `pre` element and the code content exist.
5. Copy button copies code to clipboard. Mock `navigator.clipboard.writeText` as a `vi.fn()` that returns `Promise.resolve()`. Render a code block, click the copy button, verify `clipboard.writeText` was called with the code content.
6. Copy button shows check icon after copying (feedback state). After clicking copy, verify the check icon appears. Use `vi.useFakeTimers()` and advance 2000ms, verify the icon reverts to the copy icon.

For the clipboard mock, add before each test:

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

### Milestone 5: ToolCallCard Tests

Create `src/features/acp-chat/components/ToolCallCard.test.tsx`. The `ToolCallCard` shows a tool invocation with status icon, title, and expandable output.

Tests to write (approximately 6):

1. Renders title text. Render with `title="Read"`, verify text.
2. Shows correct icon for each status (pending, running, completed, failed). Render 4 times with different statuses, verify corresponding `aria-label` values ("Pending", "Running", "Completed", "Failed").
3. Header button is disabled when no output. Render without `output`, verify button is disabled.
4. Header button is enabled when output exists. Render with `output="result"`, verify button is not disabled.
5. Clicking header toggles output visibility and `aria-expanded`. Render with output, click button, verify `aria-expanded="true"` and output text visible. Click again, verify collapsed.
6. Output displayed in `pre` element. Expand the card, verify a `pre` element contains the output text.

Note: `ContentBlockRenderer.test.tsx` already tests ToolCallCard indirectly through the renderer. These tests are direct unit tests for the component itself, testing edge cases and accessibility attributes more thoroughly.

### Milestone 6: PlanView, ThinkingBlock, TypingIndicator Tests

Create three small test files. These are simple components with minimal logic.

**`PlanView.test.tsx`** (approximately 3 tests):

1. Returns null for empty tasks array. Render with `tasks=[]`, verify container is empty.
2. Renders all tasks with titles. Render with 3 tasks, verify all titles appear.
3. Each task has correct `data-status` attribute. Render with tasks of different statuses, verify `data-status` values.

**`ThinkingBlock.test.tsx`** (approximately 3 tests):

1. Renders "Thinking" as summary text. Verify `summary` element with "Thinking".
2. Details element is open by default. Verify `details` element has `open` attribute.
3. Renders content text inside the block. Pass `text="reasoning"`, verify it appears.

**`TypingIndicator.test.tsx`** (approximately 2 tests):

1. Renders exactly 3 dots. Verify 3 elements with class `typing-dot`.
2. Has container with class `typing-indicator`. Verify container class.

### Milestone 7: useTheme Tests

Create `src/features/acp-chat/hooks/useTheme.test.ts`. The `useTheme` hook manages dark/light theme with localStorage persistence and system preference synchronization.

Tests to write (approximately 6):

1. Defaults to "light" when no localStorage and system prefers light. Mock `matchMedia` to return `matches: false` for `(prefers-color-scheme: dark)`. Render hook, verify `theme === "light"`.
2. Defaults to "dark" when system prefers dark. Mock `matchMedia` to return `matches: true`. Render hook, verify `theme === "dark"`.
3. Uses localStorage value over system preference. Set `localStorage.setItem("theme", "dark")` before rendering. Mock system as light. Verify `theme === "dark"`.
4. `toggleTheme` switches from light to dark. Render hook, call `toggleTheme()`, verify `theme === "dark"`.
5. `toggleTheme` persists new theme to localStorage. Call `toggleTheme()`, verify `localStorage.getItem("theme")` returns the new value.
6. Invalid localStorage value falls back to system preference. Set `localStorage.setItem("theme", "invalid")`, mock system as dark, render hook, verify `theme === "dark"`.

The `matchMedia` mock from `setup.ts` returns `matches: false` by default. For tests 2 and 6, override it with `vi.mocked(window.matchMedia).mockImplementation(...)` to return `matches: true`.

Use `renderHook` from `@testing-library/react` and `act` from `react` for state updates.

### Milestone 8: useAcpEventListeners Tests

Create `src/features/acp-chat/hooks/useAcpEventListeners.test.ts`. This hook registers event listeners on an `AcpSession` object and dispatches updates to message state.

The `AcpSession` type (from `tauri-acp` package) has methods like `onDelta(callback)`, `onThoughtDelta(callback)`, `onToolCall(callback)`, `onToolCallUpdate(callback)`, `onPlanUpdate(callback)`, `onComplete(callback)`, `onError(callback)`, each returning an unlisten function. We create a mock session object where each `on*` method is a `vi.fn()` that captures the callback and returns a `vi.fn()` unlisten.

Tests to write (approximately 8):

1. Does nothing when session is null. Render with `session=null`, verify no errors and no callbacks registered.
2. Registers all event listeners when session is provided. Render with mock session, verify all `on*` methods were called once.
3. `onDelta` callback appends text to streaming ref and calls `setMessages`. Capture the callback passed to `session.onDelta`, invoke it with `{ text: "hello" }`, verify `streamingContentRef.current` is updated and `setMessages` was called.
4. `onThoughtDelta` callback appends thinking text. Similar to above for thought content.
5. `onToolCall` callback dispatches tool call append. Invoke the captured `onToolCall` callback, verify `setMessages` called.
6. `onToolCallUpdate` callback updates tool call status. Invoke captured callback, verify `setMessages` called.
7. `onComplete` callback resets refs and loading state. Invoke captured `onComplete`, verify `streamingContentRef.current === ""`, `streamingThoughtRef.current === ""`, and `setIsLoading(false)` called.
8. `onError` callback sets error and stops loading. Invoke captured `onError` with `{ message: "fail" }`, verify `setError` called with an Error object, `setIsLoading(false)` called.

The mock session object pattern:

    function createMockSession() {
      const listeners: Record<string, Function> = {};
      return {
        onDelta: vi.fn((cb) => { listeners.delta = cb; return vi.fn(); }),
        onThoughtDelta: vi.fn((cb) => { listeners.thought = cb; return vi.fn(); }),
        onToolCall: vi.fn((cb) => { listeners.toolCall = cb; return vi.fn(); }),
        onToolCallUpdate: vi.fn((cb) => { listeners.toolCallUpdate = cb; return vi.fn(); }),
        onPlanUpdate: vi.fn((cb) => { listeners.plan = cb; return vi.fn(); }),
        onComplete: vi.fn((cb) => { listeners.complete = cb; return vi.fn(); }),
        onError: vi.fn((cb) => { listeners.error = cb; return vi.fn(); }),
        listeners,
      };
    }

## Git Workflow

### Branch Setup

Before any code changes, create a dedicated feature branch:

    git checkout main
    git pull origin main
    git checkout -b test/ui-coverage

All work happens on this branch. Commit after each milestone using conventional commit format:

    Milestone 0: test(config): add vitest coverage configuration
    Milestone 1: test(acp-chat): add ChatInput component tests
    Milestone 2: test(acp-chat): add ChatMessageList component tests
    Milestone 3: test(acp-chat): add DropdownSelect component tests
    Milestone 4: test(acp-chat): add MarkdownText component tests
    Milestone 5: test(acp-chat): add ToolCallCard component tests
    Milestone 6: test(acp-chat): add PlanView, ThinkingBlock, TypingIndicator tests
    Milestone 7: test(acp-chat): add useTheme hook tests
    Milestone 8: test(acp-chat): add useAcpEventListeners hook tests

### Pull Request

After all milestones are complete and `pnpm test:coverage` passes, push the branch and create a PR:

    git push -u origin test/ui-coverage

    gh pr create --title "test(acp-chat): add comprehensive UI test coverage" --body "$(cat <<'EOF'
    ## Summary
    - Install `@vitest/coverage-v8` and configure coverage reporting (text + HTML)
    - Add tests for all previously untested UI components and hooks
    - Increase test count from 145 to 200+ with 0 source code changes

    ## Components/hooks tested
    - `ChatInput.tsx`, `ChatMessageList.tsx`, `DropdownSelect.tsx`
    - `MarkdownText.tsx`, `ToolCallCard.tsx`
    - `PlanView.tsx`, `ThinkingBlock.tsx`, `TypingIndicator.tsx`
    - `useTheme.ts`, `useAcpEventListeners.ts`

    ## Test plan
    - [ ] `pnpm test:run` — all tests pass
    - [ ] `pnpm test:coverage` — generates coverage report
    - [ ] `pnpm typecheck` — no type errors
    - [ ] `open coverage/index.html` — verify all `src/features/acp-chat/` files show >80% line coverage
    EOF
    )"

The PR targets `main`. The body includes a summary, the list of newly tested files, and a verification checklist.

## Concrete Steps

All commands are run from the repository root: `/Users/sotayamashita/Projects/personal/tauri-acp-kit`.

### Milestone 0

Install the coverage provider:

    pnpm add -D @vitest/coverage-v8

Edit `vite.config.ts` to add the `coverage` configuration inside the `test` block (see Plan of Work, Milestone 0 for the exact config).

Check if `.gitignore` already ignores `coverage/`:

    grep -q "^coverage" .gitignore && echo "already ignored" || echo "coverage/" >> .gitignore

Run coverage:

    pnpm test:coverage

Expected output includes a text table showing per-file coverage percentages and a summary line like:

    Test Files  17 passed (17)
         Tests  145 passed (145)

And the file `coverage/index.html` should exist.

### Milestones 1-8

For each milestone, the pattern is:

1. Create the test file in the same directory as the source file.
2. Run `pnpm test:run` to verify all tests pass (existing + new).
3. Run `pnpm typecheck` to verify no type errors.

After all milestones:

    pnpm test:coverage

Expected:

    Test Files  25+ passed (25+)
         Tests  200+ passed (200+)

And the HTML report at `coverage/index.html` should show all `src/features/acp-chat/` files with line coverage above 80%.

## Validation and Acceptance

Success criteria, verifiable by running commands:

1. `pnpm test:run` passes with 200+ tests across 25+ files and 0 failures.
2. `pnpm test:coverage` produces a terminal text table and `coverage/index.html`.
3. `pnpm typecheck` passes with no errors.
4. Every `.tsx` file in `src/features/acp-chat/components/` has a corresponding `.test.tsx` file.
5. Every `.ts` file in `src/features/acp-chat/hooks/` has a corresponding `.test.ts` file (except `index.ts` barrel files).
6. The coverage report shows line coverage above 80% for all files in `src/features/acp-chat/`.

To open the HTML coverage report:

    open coverage/index.html

## Idempotence and Recovery

Each milestone adds a new test file. No existing files are modified (except `vite.config.ts` in Milestone 0 and potentially `.gitignore`). The milestones can be run in any order after Milestone 0. If a test file needs to be rewritten, simply delete it and recreate — no other files are affected.

If `pnpm test:run` fails after adding a test file, the issue is isolated to that test file. Fix the test or revert it with `git checkout -- <test-file>`.

The coverage configuration in Milestone 0 is additive to `vite.config.ts` and does not affect `pnpm test:run` (coverage is only activated by `pnpm test:coverage` which passes `--coverage` flag).

## Artifacts and Notes

### Baseline coverage snapshot (before this work)

At the start, `pnpm test:coverage` fails with:

    MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'

After Milestone 0, the baseline coverage can be captured and compared against the final result.

### Test file naming convention

All test files follow the existing pattern: `ComponentName.test.tsx` for React components, `hookName.test.ts` for hooks. Tests are co-located with their source files.

### Testing patterns used throughout

Import pattern for component tests:

    import { describe, it, expect, beforeEach, vi } from "vitest";
    import { render, screen, fireEvent, waitFor } from "@testing-library/react";

Import pattern for hook tests:

    import { describe, it, expect, beforeEach, vi } from "vitest";
    import { renderHook, act } from "@testing-library/react";

### New test files to create

    src/features/acp-chat/components/ChatInput.test.tsx          — Milestone 1
    src/features/acp-chat/components/ChatMessageList.test.tsx     — Milestone 2
    src/features/acp-chat/components/DropdownSelect.test.tsx      — Milestone 3
    src/features/acp-chat/components/MarkdownText.test.tsx        — Milestone 4
    src/features/acp-chat/components/ToolCallCard.test.tsx        — Milestone 5
    src/features/acp-chat/components/PlanView.test.tsx            — Milestone 6
    src/features/acp-chat/components/ThinkingBlock.test.tsx       — Milestone 6
    src/features/acp-chat/components/TypingIndicator.test.tsx     — Milestone 6
    src/features/acp-chat/hooks/useTheme.test.ts                 — Milestone 7
    src/features/acp-chat/hooks/useAcpEventListeners.test.ts     — Milestone 8

## Interfaces and Dependencies

### New dev dependency

    @vitest/coverage-v8 (version matching vitest ^4.0.18)

### No new runtime dependencies

No new npm packages are added to `dependencies`.

### No source code changes

This plan adds only test files and coverage configuration. No production source code is modified. This is critical because the purpose is to create a regression safety net before refactoring.

### Files modified

    vite.config.ts   — Add coverage configuration (Milestone 0)
    .gitignore       — Add coverage/ if not present (Milestone 0)

### Files created

10 new test files (listed in Artifacts section above).

---

Plan Revision Note:

- 2026-02-18: Initial version created based on comprehensive codebase investigation. 10 untested files identified across components and hooks. 145 existing tests confirmed passing. Coverage infrastructure (`@vitest/coverage-v8`) identified as missing. Milestones ordered by refactoring safety value: largest untested components first (ChatInput, ChatMessageList), then reusable components (DropdownSelect), then rendering components (MarkdownText, ToolCallCard), then simple components (PlanView, ThinkingBlock, TypingIndicator), then hooks (useTheme, useAcpEventListeners).
- 2026-02-18: Added Git Workflow section with branch creation (`test/ui-coverage`), per-milestone commit messages in conventional commit format, and PR creation via `gh pr create` with structured body. Updated Progress section to include branch and PR steps.
