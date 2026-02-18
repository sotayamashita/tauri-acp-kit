# React Patterns: Technology-Specific Guidelines for This Project

This document is a companion to `CODE_QUALITY.md`. Where `CODE_QUALITY.md` defines **why** certain qualities matter (cognitive science, software principles), this document specifies **how** to achieve those qualities within this project's technology stack: React 19 + TypeScript + Tauri v2.

This is a living document. Update it as patterns evolve.

## Relationship to CODE_QUALITY.md

Each pattern in this document maps to one or more dimensions defined in `CODE_QUALITY.md`:

- **Dimension 1: Cognitive Fit** -- Can the reader hold it in their head?
- **Dimension 2: Structural Integrity** -- Does the structure support change?
- **Dimension 3: Evolutionary Fitness** -- Can the code sustain development over time?

The Decision Framework (4 Gates) from `CODE_QUALITY.md` applies to all changes guided by this document.

## Scope: What Applies to This Project

This project is a **Tauri v2 desktop application**, not a Next.js web application. Many React best practices assume a server-rendering context. The following scope applies:

| Category                                      | Applies   | Reason                                                                    |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------- |
| Component Composition                         | Yes       | Framework-agnostic React patterns                                         |
| State Management                              | Yes       | Client-side React state                                                   |
| Re-render Optimization                        | Yes       | Client-side performance                                                   |
| React 19 APIs                                 | Yes       | Project uses React ^19.1.0                                                |
| Bundle Size                                   | Partially | No server/client boundary, but tree-shaking and lazy loading still matter |
| Server Components / RSC                       | No        | Tauri has no server rendering                                             |
| Next.js-specific (after(), cache(), metadata) | No        | Not a Next.js project                                                     |
| Server Actions / Auth                         | No        | Auth handled by Tauri backend                                             |

## Baseline: react-doctor Score

As of 2026-02-18, `npx react-doctor@latest . --verbose` reports:

    Score: 96 / 100 (Great)
    Warnings: 26 across 9/68 files

Actual code issues (3):

| Rule                  | File                | Line | Category     |
| --------------------- | ------------------- | ---- | ------------ |
| no-render-in-render   | DropdownSelect.tsx  | 60   | Architecture |
| no-array-index-as-key | ChatMessageList.tsx | 106  | Correctness  |
| no-children-prop      | MarkdownText.tsx    | 145  | Correctness  |

Dead code (21 warnings): Unused exports and types in `index.ts` barrel file and various hook type exports. These are barrel re-exports for external consumption that are currently unused within the app itself.

Run `npx react-doctor@latest . --verbose` after refactoring to verify score does not decrease.

---

## Anti-Patterns in This Codebase

These are observations about where the current code deviates from the principles in `CODE_QUALITY.md`, identified through the lens of that framework. Each represents an opportunity for improvement, not a criticism of past work.

### God Component: AcpChat.tsx (230 lines, 5+ responsibilities)

Violates: Cognitive Fit (Dimension 1), Single Responsibility (Dimension 2)

This component manages header UI, provider switching, message display, input handling, setup status, download progress, and error display. A change to the header layout requires understanding all 230 lines. The reader must hold multiple unrelated concerns in mind simultaneously.

Why it matters: Cognitive Dimensions framework identifies this as high "viscosity" -- making even small changes requires understanding the whole component, which resists modification.

### Props Overload: ChatInput.tsx (14 props)

Violates: Cognitive Fit / working memory (Dimension 1), Low Coupling (Dimension 2)

14 parameters exceed working memory capacity. The component conflates three distinct concerns: text input, model selection, and reasoning level selection. These three concerns change for different reasons.

Why it matters: Soloway & Ehrlich's research shows that when code violates discourse rules (here: a component doing too many things), even experienced developers lose their comprehension advantage.

### State Explosion: useAcpSession.ts (7 state + 4 ref = 11 mutable items)

Violates: Cognitive Fit (Dimension 1), Single Responsibility (Dimension 2)

11 mutable items that interact with each other cannot be held in working memory simultaneously. The relationships between states (e.g., spawnFailed implies not isReady) are implicit rather than explicit.

Why it matters: The reader must mentally track 11 items and their interdependencies. This exceeds even the generous 7 +/- 2 estimate.

### Repetitive Pattern: messageUpdaters.ts (5 functions, same structure)

Violates: DRY (partially)

Five functions follow the identical pattern of updating the last assistant message. The pattern is: clone messages, modify the last message, return new array. The repetition is not harmful enough to warrant abstraction (each function has distinct logic), but it signals that a shared helper could emerge if the pattern grows.

Why it matters: This is a case where premature abstraction would be worse than the repetition. Per Kerievsky: patterns should emerge, not be imposed. Monitor for growth.

---

## Pattern 1: Composition Over Props Proliferation

**Addresses**: CODE_QUALITY.md Dimension 1 (Cognitive Fit -- working memory), Dimension 2 (Structural Integrity -- single responsibility)

**Source**: vercel-composition-patterns (Section 1.1, 1.2)

### The Problem

Boolean and configuration props create exponential complexity. Each boolean doubles the number of possible states. A component with 4 boolean props has 16 possible configurations, most of which are untested and some of which are invalid.

In this codebase, `ChatInput.tsx` has 14 props. While not all are booleans, the component conflates three distinct concerns (text input, model selection, reasoning level selection) into a single interface. The reader must hold all 14 items in mind to understand the component.

### The Pattern

Replace a single component with many props with multiple explicit variant components that compose shared parts.

Before (monolithic):

    <ChatInput
      input={...}
      setInput={...}
      isReady={...}
      isLoading={...}
      onSubmit={...}
      onStop={...}
      availableModels={...}
      currentModelId={...}
      currentModelName={...}
      onModelSelect={...}
      selectedProvider={...}
      reasoningLevel={...}
      reasoningLevels={...}
      onReasoningSelect={...}
    />

After (composed):

    <ChatInputArea
      input={...}
      setInput={...}
      isReady={...}
      isLoading={...}
      onSubmit={...}
      onStop={...}
    />

Model selection and reasoning level selection become either separate composed components within a shared layout, or consume shared state via Context.

### When to Apply

- A component has more than 7 props
- A component handles more than one concept (input + model selection + reasoning)
- Adding a new feature requires modifying the props interface of an unrelated component

### When NOT to Apply

- The component genuinely has a single responsibility with many configuration options
- The props are cohesive (all related to the same concept)
- Splitting would require passing data between siblings that currently share scope

---

## Pattern 2: Compound Components with Shared Context

**Addresses**: CODE_QUALITY.md Dimension 1 (Cognitive Fit -- locality), Dimension 2 (Structural Integrity -- coupling)

**Source**: vercel-composition-patterns (Section 1.2, 2.2, 2.3)

### The Problem

Props drilling passes data through intermediate components that do not use it. Each intermediate component becomes coupled to the data it passes through. In this codebase, `AcpChat.tsx` passes numerous props from `useAcpChat` down to child components.

### The Pattern

Structure complex UI as compound components with a shared Context. Each subcomponent accesses shared state via Context, not props. The Provider component is the only place that knows how state is managed.

The pattern has three parts:

1. **Context Interface**: Define `state`, `actions`, and `meta` as a generic interface
2. **Provider**: A component that manages state and provides it via Context
3. **Subcomponents**: Components that consume the Context interface

Key insight from the composition patterns guide: "The provider boundary is what matters, not the visual nesting. Components that need shared state don't have to be inside the visual parent. They just need to be within the provider."

### React 19 Specifics

This project uses React 19. Use `use()` instead of `useContext()`:

    // React 18 (old)
    const value = useContext(MyContext)

    // React 19 (current)
    const value = use(MyContext)

`use()` can be called conditionally, unlike `useContext()`.

Also, `ref` is a regular prop in React 19. No need for `forwardRef`:

    // React 18 (old)
    const Input = forwardRef<HTMLInputElement, Props>((props, ref) => {
      return <input ref={ref} {...props} />
    })

    // React 19 (current)
    function Input({ ref, ...props }: Props & { ref?: React.Ref<HTMLInputElement> }) {
      return <input ref={ref} {...props} />
    }

### When to Apply

- Data is passed through 2+ intermediate components that do not use it
- Multiple siblings need access to the same state
- The component tree has a clear "ownership" boundary (e.g., chat session, input area)

### When NOT to Apply

- The data is used by exactly one child (direct props are simpler)
- The state is local to a single component (no sharing needed)
- Per YAGNI: do not introduce Context for hypothetical future sharing

---

## Pattern 3: Decouple State Management from UI

**Addresses**: CODE_QUALITY.md Dimension 2 (Structural Integrity -- low coupling), Dimension 3 (Evolutionary Fitness -- testability)

**Source**: vercel-composition-patterns (Section 2.1)

### The Problem

When UI components directly import and call state management hooks, they become tightly coupled to the state implementation. Changing how state is managed requires changing the UI components.

In this codebase, `AcpChat.tsx` directly calls `useAcpChat()` which in turn calls `useAcpSession()`, `useReasoningLevel()`, and `useAgentDownload()`. The component is coupled to all of these implementations.

### The Pattern

The Provider component is the only place that knows how state is managed. UI components consume a Context interface -- they do not know if state comes from `useState`, a custom hook, or a Tauri IPC call.

Benefits:

- UI components are testable with a simple test Provider
- State implementation can be swapped without changing UI
- Different Providers can serve different contexts (e.g., test vs. production)

### When to Apply

- State management logic is complex (multiple hooks, Tauri IPC, streaming refs)
- The same UI structure could work with different state sources
- Testing requires elaborate mock setups because UI is coupled to state

### When NOT to Apply

- State is simple (a single `useState` in a single component)
- The component is a leaf node with no children that need the state

---

## Pattern 4: Explicit Component Variants

**Addresses**: CODE_QUALITY.md Dimension 1 (Cognitive Fit -- beacons), Dimension 2 (Structural Integrity -- single responsibility)

**Source**: vercel-composition-patterns (Section 3.1)

### The Problem

A single component with conditional rendering for different modes creates hidden complexity. The reader must trace through all conditions to understand what renders in each mode.

In this codebase, `AcpChat.tsx` conditionally renders different UI based on `isDownloading`, `spawnFailed`, `isReady`, etc. The rendering path is not immediately obvious.

### The Pattern

Create explicit variant components that each compose the pieces they need:

    // Immediately clear what this renders
    <AcpChatConnecting />
    <AcpChatSetup />
    <AcpChatReady />

Each variant is self-contained and self-documenting. The parent component becomes a simple switch:

    if (isDownloading) return <AcpChatSetup />
    if (!isReady) return <AcpChatConnecting />
    return <AcpChatReady />

### When to Apply

- A component has 3+ rendering modes controlled by boolean/state checks
- The modes share some but not all of the UI structure

### When NOT to Apply

- There are only 2 modes with minimal differences (a simple ternary is fine)
- The modes share 90%+ of the UI (variants would be mostly duplicate)

---

## Pattern 5: Derive State During Rendering

**Addresses**: CODE_QUALITY.md Dimension 2 (Structural Integrity -- no state drift)

**Source**: vercel-react-best-practices (Section 5.1)

### The Problem

Storing derived values in state and synchronizing them via `useEffect` creates unnecessary re-renders and risks state drift (the derived value falling out of sync with its source).

### The Pattern

If a value can be computed from current props or state, compute it during render:

    // Incorrect: derived state in effect
    const [fullName, setFullName] = useState('')
    useEffect(() => {
      setFullName(firstName + ' ' + lastName)
    }, [firstName, lastName])

    // Correct: derived during render
    const fullName = firstName + ' ' + lastName

For expensive computations, use `useMemo`:

    const sortedItems = useMemo(
      () => items.toSorted((a, b) => a.name.localeCompare(b.name)),
      [items]
    )

### When to Apply

- Any value that is fully determined by existing props/state
- Connection status derived from multiple boolean states (already extracted to `connectionStatus.ts`)

### When NOT to Apply

- The value requires an async operation (network call, Tauri IPC)
- The value depends on external events (subscriptions, timers)

---

## Pattern 6: Avoid Inline Render Functions

**Addresses**: CODE_QUALITY.md Dimension 3 (Evolutionary Fitness -- correctness)

**Source**: react-doctor rule `no-render-in-render`

### The Problem

Defining components or render functions inline causes React to unmount and remount them on every render, destroying internal state and DOM nodes.

Current violation in this codebase:

    // DropdownSelect.tsx:60 -- inline renderLabel()
    // Creates a new function identity on every render

### The Pattern

Extract to a named component outside the render function:

    // Before: inline
    function Parent() {
      const renderItem = (item) => <div>{item.name}</div>  // new identity every render
      return items.map(renderItem)
    }

    // After: extracted
    function Item({ item }) {
      return <div>{item.name}</div>
    }

    function Parent() {
      return items.map(item => <Item key={item.id} item={item} />)
    }

### When to Apply

- Always. Inline render functions are a correctness issue, not just a style preference.

---

## Pattern 7: Stable Keys for Lists

**Addresses**: CODE_QUALITY.md Dimension 3 (Evolutionary Fitness -- correctness)

**Source**: react-doctor rule `no-array-index-as-key`

### The Problem

Using array index as key causes bugs when lists are reordered, filtered, or items are added/removed. React associates state with the key, so index-based keys cause state to "stick" to the wrong items.

Current violation in this codebase:

    // ChatMessageList.tsx:106 -- array index "i" used as key

### The Pattern

Use a stable unique identifier:

    // Before
    messages.map((msg, i) => <Message key={i} message={msg} />)

    // After
    messages.map(msg => <Message key={msg.id} message={msg} />)

If items do not have a natural ID, generate one when the item is created, not during rendering.

### Exception

Index keys are acceptable for truly static lists that are never reordered, filtered, or modified. Chat messages can be reordered or deleted, so they need stable keys.

---

## Pattern 8: Pass Children via JSX, Not Props

**Addresses**: CODE_QUALITY.md Dimension 1 (Cognitive Fit -- convention)

**Source**: react-doctor rule `no-children-prop`, vercel-composition-patterns (Section 3.2)

### The Problem

Passing children via a prop instead of JSX nesting violates React conventions and reduces readability.

Current violation in this codebase:

    // MarkdownText.tsx:145 -- children passed as prop

### The Pattern

    // Before: children as prop
    <Component children={<Child />} />

    // After: JSX nesting
    <Component>
      <Child />
    </Component>

Exception: Render props that pass data back to the caller are appropriate when the parent needs to provide data or state to the child (e.g., `renderItem` in a list).

---

## Pattern 9: Clean Up Dead Code

**Addresses**: CODE_QUALITY.md Dimension 1 (Cognitive Fit -- signal vs noise), Dimension 3 (Evolutionary Fitness -- entropy resistance)

**Source**: react-doctor (knip analysis)

### The Problem

Unused exports and types create noise that increases cognitive load. They suggest connections that do not exist, misleading the reader. They also increase the surface area that must be considered during changes.

Current findings (21 warnings):

- `index.ts` barrel file re-exports types and components not consumed within the app
- Several hooks export type aliases (`UseAcpSessionOptions`, `UseAcpSessionReturn`, etc.) that are unused
- `ToolKind` type is defined but unused

### The Pattern

- Delete unused exports, types, and code. Do not comment it out.
- Barrel files (`index.ts`) should only export what is actually imported elsewhere.
- If a type was created for external API documentation but is unused, it should either be consumed (by adding explicit type annotations) or removed.
- Run `npx react-doctor@latest . --verbose` to detect dead code.

### When NOT to Apply

- The export is part of a published package API (the `acp-chat` feature may be extracted as a library in the future). In that case, document why it exists.

---

## Diagnostic Workflow

When evaluating React-specific code quality:

1. Run `npx react-doctor@latest . --verbose` for automated diagnostics
2. Review each warning against the patterns in this document
3. Check the score against the baseline (currently 96/100)
4. For architectural decisions, consult `CODE_QUALITY.md` Decision Framework

When planning a refactoring:

1. Identify which patterns from this document address the issue
2. Verify the change satisfies the 4 Gates from `CODE_QUALITY.md`
3. Apply the pattern, keeping existing tests green
4. Re-run `react-doctor` to confirm score does not decrease

## Tool Reference

| Tool            | Command                                  | Purpose                         |
| --------------- | ---------------------------------------- | ------------------------------- |
| react-doctor    | `npx -y react-doctor@latest . --verbose` | Automated codebase health check |
| Vitest Coverage | `pnpm test:coverage`                     | Test coverage report            |
| TypeScript      | `pnpm typecheck`                         | Type safety verification        |
| Oxlint          | `pnpm lint`                              | Lint rules                      |

## Sources

- [Vercel React Composition Patterns](~/.agents/skills/vercel-composition-patterns/AGENTS.md) -- Compound components, state lifting, explicit variants
- [Vercel React Best Practices](~/.agents/skills/vercel-react-best-practices/AGENTS.md) -- Performance optimization, re-render reduction, bundle size
- [react-doctor](https://www.react.doctor) -- Automated React codebase health diagnostics
- [React 19 Documentation](https://react.dev) -- `use()`, ref as prop, API changes

---

Revision Note:

- 2026-02-18: Initial version. Created based on analysis of three agent skills (vercel-composition-patterns, vercel-react-best-practices, react-doctor) applied to this project's technology stack (React 19 + TypeScript + Tauri v2). Nine patterns identified. react-doctor baseline established at 96/100. Next.js-specific patterns explicitly excluded with rationale (Tauri desktop app).
- 2026-02-18: Added Anti-Patterns section (moved from CODE_QUALITY.md during generalization). Anti-patterns are project-specific observations mapped to CODE_QUALITY.md dimensions.
