# AI Code Review: Using CODE_QUALITY.md with AI Agents

This document captures operational knowledge about how to use CODE_QUALITY.md effectively when working with AI coding agents. It is based on observed failure modes and successful patterns.

## The Core Distinction

CODE_QUALITY.md is a **framework** (systematic criteria for judgment), not a **heuristic** (a rule of thumb for immediate use). This distinction determines everything about how to use it.

A framework provides comprehensive coverage and principled reasoning. A heuristic provides fast, focused intervention. They serve different purposes and are not interchangeable.

## Why AI Agents Need Special Guidance

AI coding agents have a default tendency toward **writer-optimization**: they produce code that is thorough, comprehensive, and anticipates future needs. This manifests as:

- Adding error handling for scenarios that cannot occur
- Creating abstractions for one-time operations
- Building configurability that no one requested
- Preparing for hypothetical future requirements

This tendency directly conflicts with CODE_QUALITY.md's principles — particularly YAGNI, "Patterns emerge, not imposed," and the Simple vs Easy distinction. The irony is that an agent trying to follow the document's principles may violate them through over-application.

## How to Use CODE_QUALITY.md with AI Agents

### 1. Scope to a specific gate or dimension

Do not ask the agent to "review based on CODE_QUALITY.md." Instead, direct attention to one specific aspect.

Good examples:

- "Review this function from the perspective of Gate 2 (cognitive load reduction)."
- "Evaluate this module split against Dimension 2 (Structural Integrity)."
- "Verify whether this change passes Gate 1 (behavior preservation)."

Bad examples:

- "Review and fix this code based on CODE_QUALITY.md."
- "Check against all principles."

### 2. Use for justification, not discovery

CODE_QUALITY.md is most effective when the agent has already identified a problem and needs to articulate why it matters.

Good: "Explain the problems in this function using Dimension 1 principles."
Bad: "Find all violations of CODE_QUALITY.md."

The former produces focused, principled reasoning. The latter produces an exhaustive list where important issues are buried under trivial ones.

### 3. Use as shared vocabulary

The document's terminology — three dimensions, four gates, cognitive fit, structural integrity, evolutionary fitness — provides precise language for discussing code quality. Use these terms to communicate intent clearly.

Example: "I want to fix this as a Cognitive Fit issue" is more actionable than "this is hard to read, fix it."

### 4. Use for planning, not execution

CODE_QUALITY.md is effective in the planning phase of large refactoring: deciding which dimension to prioritize, which gate to focus on, which refactoring method to apply. It is less effective as a real-time guide during execution.

## How NOT to Use CODE_QUALITY.md with AI Agents

### 1. Do not give the full document with an open-ended instruction

"Read CODE_QUALITY.md and review and fix this code" causes two problems:

- **Focus dilution**: 3 dimensions x 4 gates x multiple principles = too many evaluation criteria applied simultaneously. The agent tries to address everything, and important issues drown in minor observations.
- **Over-application**: The agent finds violations of principles and "fixes" them, including changes that fall under "When NOT to refactor" (YAGNI, diminishing returns, premature patterns). The document warns against this, but the agent's default behavior overrides the warning.

### 2. Do not use as a substitute for perspective-shifting prompts

A prompt like "Would a senior engineer say this is overcomplicated? If yes, simplify." achieves something CODE_QUALITY.md cannot: it forces the agent to **switch perspective** from writer to reviewer.

CODE_QUALITY.md provides information. A persona prompt shifts viewpoint. These are cognitively different operations:

- **Information** (CODE_QUALITY.md): The agent evaluates code through its own lens with additional reference material. The lens does not change.
- **Perspective shift** (persona prompt): The agent adopts a different evaluative stance. The criteria emerge from the persona, not from a checklist.

For the specific problem of AI overcomplication — which is the most common failure mode — the persona prompt is more effective because it targets that single failure mode directly.

### 3. Do not use as an exhaustive checklist

Walking through every principle sequentially produces diminishing returns. The last 10 findings rarely justify the effort, and the agent may start finding "violations" that are not actually problems.

### 4. Do not use for small, obvious changes

A one-line fix does not need a framework evaluation. The overhead of consulting principles exceeds the benefit. Reserve CODE_QUALITY.md for decisions where principled reasoning adds value.

## Complementary Approaches

The most effective pattern combines both tools:

| Situation                         | Approach                                                               |
| --------------------------------- | ---------------------------------------------------------------------- |
| Quick review of AI-generated code | Persona prompt: "Would a senior engineer say this is overcomplicated?" |
| Justifying a refactoring decision | CODE_QUALITY.md: "This violates Dimension 1 because..."                |
| Planning a large refactoring      | CODE_QUALITY.md: Choose target dimension and gates                     |
| Reviewing a specific concern      | CODE_QUALITY.md scoped to one gate: "Does this pass Gate 2?"           |
| Preventing over-engineering       | Persona prompt targeting the specific failure mode                     |
| Team discussion about trade-offs  | CODE_QUALITY.md vocabulary: dimensions, gates, principles              |

## Key Insight

AI agents' primary failure mode when writing code is **overcomplication** (writer-optimization). CODE_QUALITY.md's primary value is **principled reasoning about quality** (systematic evaluation). These address different problems. Use the right tool for the right problem.

---

Revision Note:

- 2026-02-18: Initial version. Created based on analysis of how AI coding agents interact with comprehensive quality frameworks. Key finding: frameworks and heuristics serve complementary purposes; using a framework as a heuristic (or vice versa) produces suboptimal results.
