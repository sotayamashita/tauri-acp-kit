# Agent Design: From Simulation Specification to Implementation

## Purpose and Relationship to Other Documents

This document provides the practical process for designing LLM agent teams. It bridges theory and implementation:

```
.agents/LLM_AS_SIMULATOR.md     ← WHY: LLMs are simulators, not entities.
                                    Probability distribution mechanics.
                                    Universal separation tests.

.agents/AGENT_DESIGN.md          ← HOW: Design process. This document.
                                    Step-by-step from requirements to
                                    .claude/agents/*.md files.

.agents/CODE_QUALITY.md          ← APPLIED: Code quality domain.
  (Simulator-based Role              3 simulations + leader.
   Definitions section)              Activation matrix. V1-V8 verification.

.agents/AI_CODE_REVIEW.md        ← OPERATIONAL: How to use CODE_QUALITY.md
                                    with AI agents day-to-day.
```

Read `LLM_AS_SIMULATOR.md` first if you have not internalized the core thesis: an LLM has no identity — it is a simulator that produces output conditioned on context.

## Design Process

### Step 1: Identify the evaluation dimensions

List the distinct evaluation concerns your agent team must address. Each concern is a candidate simulation.

Questions to ask:

- What types of judgment does this task require?
- What external knowledge does each judgment need?
- What is the output of each judgment?

Example (code quality review):

```
Concern A: Domain naming and concept consistency  → needs domain glossary
Concern B: Structural integrity of dependencies   → needs ADRs, API contracts
Concern C: Alignment with future direction        → needs product roadmap
```

### Step 2: Apply the four separation tests

For every pair of candidate simulations, apply the tests. If any test fails, the pair must be separate agents.

**Test 0 — Generation-verification independence**

Does one simulation need to verify another's output? If yes, they cannot share an agent. The same conditional distribution that generated an output cannot reliably detect errors in it.

_This test also determines the leader's role: the leader must be separate from all generation agents._

**Test 1 — Context interference**

Do the two simulations require knowledge contexts that would dilute each other if co-located? Different abstraction levels, different vocabularies, or different source documents indicate dilution risk.

Diagnostic question: _If I inject both knowledge sets into one context, would the model's attention on knowledge set A degrade because of knowledge set B's presence?_

**Test 2 — Distribution compatibility**

Do the evaluation criteria shift the output distribution in compatible directions? Criteria are incompatible when they require different evaluation frameworks, different abstraction levels, or could produce contradictory conclusions about the same artifact.

Diagnostic question: _Could an agent simultaneously conclude "this is good" on criterion X and "this is bad" on criterion Y for the same code, where both conclusions are correct but require different reasoning frames?_

**Test 3 — Attention budget**

Does the combined criteria count exceed 7? This is a structural constraint of transformer attention mechanics, not a guideline. Claude-family models exhibit linear adherence decay with instruction count. Beyond 7 simultaneous criteria, omission errors increase.

### Step 3: Determine the dependency chain

If simulation B requires simulation A's output as input, B depends on A. Map all dependencies.

Rules:

- Dependencies must be acyclic (no circular dependencies between simulations)
- The leader depends on all simulations (it validates their outputs)
- Dependencies map directly to `blockedBy` in Claude Code Agent Teams task definitions

### Step 4: Design the activation strategy

Not every change requires every simulation. Define when each simulation is needed based on the input characteristics.

Two approaches:

**Static activation matrix** — Map input types to required simulations. Deterministic. No leader judgment needed for activation decisions.

```
Input type A → Simulation 1 only
Input type B → Simulation 1 + 2
Input type C → All simulations
```

**Adaptive activation** — The leader analyzes the input and determines which simulations are needed. The static matrix serves as an upper bound constraint.

```
Leader analyzes input → determines required simulations
                      → spawns only those agents
                      → never exceeds matrix upper bound
```

Adaptive activation reduces cost for simple inputs but adds leader judgment as a potential error source. Use static activation when input classification is straightforward; use adaptive when input types vary widely.

### Step 5: Write simulation specifications

Each simulation specification follows this template:

```
Simulation:  What evaluation process to simulate (as a question, not a command)
Context:     What knowledge conditions the simulation
Focus:       Specific criteria (≤ 7) — the simulation's lens
L0 elements: Which irreducible judgment elements this simulation covers (if applicable)
Scope:       What granularity the simulation operates at
Depends:     Which other simulations' results are needed as input
Output:      Structured format for simulation results
```

Writing guidelines:

- **Simulation** should be phrased as "Given [context], what would [evaluation process] find in [input]?" — not "You are X" or "Evaluate X"
- **Focus** criteria should be specific, testable questions — not vague directives
- **Output** should be a typed structure, not free-form prose (MetaGPT finding: structured artifacts achieve 3.9/4.0 executability vs. dialogue-based 2.1/4.0)

### Step 6: Write the leader specification

The leader has three phases:

```
Phase 1 — Activation decision:
  Analyze the input. Determine which simulations are needed.
  Apply the activation matrix or adaptive strategy.

Phase 2 — Validation (generation-verification separation):
  Cross-check simulation outputs for:
  - Contradictions between simulations
  - False positives (findings that don't hold under scrutiny)
  - Missing coverage (input aspects no simulation addressed)

Phase 3 — Synthesis:
  Integrate validated findings into actionable output.
```

### Step 7: Verify against separation criteria

Check the complete design against these criteria:

| #   | Criterion                          | Check                                                              |
| --- | ---------------------------------- | ------------------------------------------------------------------ |
| V1  | No contradictory judgments         | Each agent's criteria belong to a single coherent evaluation frame |
| V2  | No responsibility overlap          | Each evaluation concern maps to exactly one agent                  |
| V3  | Criteria count within limit        | Each agent has ≤ 7 criteria                                        |
| V4  | Generation-verification separation | No agent validates its own output                                  |
| V5  | Dependency chain respected         | Upstream outputs available before downstream starts                |
| V6  | Scope completeness                 | All input types have at least one responsible agent                |
| V7  | Adaptive activation                | Simple inputs activate fewer agents than complex inputs            |
| V8  | Structured communication           | All inter-agent communication uses typed format                    |

If any criterion fails, revise the design before implementation.

## Implementation: Claude Code Agent Teams

### Agent definition files

Each simulation becomes a `.claude/agents/*.md` file:

```markdown
---
name: domain-review
description: Simulates a domain-focused code review. Activates for Extract Function and above.
tools: Read, Glob, Grep
model: sonnet
---

Given the following domain glossary:
(Injected at runtime by the leader or via MCP/skill)

And the following code changes:
(Provided as task input)

What naming and concept boundary issues would a domain-focused
code review identify in these changes?

For each issue found, report as a structured finding:

location: file:line
l0_element: 1 | 2 | 4
dimension: cognitive_fit | structural_integrity | evolutionary_fitness
severity: high | medium | low
evidence: what you observed
judgment: why this is an issue and what should change

Focus criteria (evaluate these and only these):

1. Does each changed name match domain vocabulary?
2. Is each name's abstraction level appropriate for its module?
3. Are same-module concepts independent?
4. Do concept boundaries align with specification?
5. Is branching complexity attributable to domain requirements?
6. Is there unnecessary complexity beyond domain requirements?

Do not evaluate structural dependencies, temporal ordering, or
future extensibility — those are covered by other simulations.
```

Key implementation details:

- **`tools: Read, Glob, Grep`** — Simulation agents are read-only. They analyze, they do not modify code. This enforces generation-verification separation at the tool level.
- **`model: sonnet`** — Use cost-effective models for simulation agents. The leader (which runs in the main session) uses the session's default model.
- **Explicit scope boundaries** — The final paragraph ("Do not evaluate...") prevents scope creep. Without this, the agent's distribution will drift toward evaluating everything it can.

### Coordination via task dependencies

The leader creates tasks with `blockedBy` to enforce the dependency chain:

```
Task 1: "Domain review of PR #42"          → owner: domain-review
Task 2: "Structure review of PR #42"       → owner: structure-review, blockedBy: [1]
Task 3: "Evolution review of PR #42"       → owner: evolution-review, blockedBy: [1, 2]
Task 4: "Validate and synthesize findings" → owner: leader, blockedBy: [1, 2, 3]
```

For independent simulations (no dependency chain), omit `blockedBy` to enable parallel execution.

### Hooks for quality gates

Two Agent Teams hooks enforce design constraints at runtime:

**TaskCompleted hook** — Validates output structure before accepting:

```bash
#!/bin/bash
# .claude/hooks/validate-simulation-output.sh
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

# Check that output contains structured findings
if echo "$INPUT" | jq -r '.task_description' | grep -q "Finding\[\]"; then
  exit 0
fi

echo "Task output must contain structured Finding[] format." >&2
exit 2
```

**TeammateIdle hook** — Ensures simulation completed its scope:

```bash
#!/bin/bash
# .claude/hooks/check-simulation-complete.sh
INPUT=$(cat)
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name')

# Custom validation per simulation type
exit 0
```

### Knowledge injection strategies

Each simulation needs specific external knowledge. Three injection methods:

| Method                              | When to use                                                   | Trade-off                               |
| ----------------------------------- | ------------------------------------------------------------- | --------------------------------------- |
| **Static in agent file**            | Knowledge is stable and small (< 2K tokens)                   | Simple but inflexible                   |
| **Leader injects at task creation** | Knowledge varies per task or is large                         | Flexible but depends on leader judgment |
| **MCP server / skill**              | Knowledge lives in external systems (wikis, ADRs, glossaries) | Scalable but requires infrastructure    |

Placement rule (from attention research): inject knowledge at the **beginning** of the agent's context, before criteria. Middle-positioned information is underutilized (Lost in the Middle, Liu et al. TACL 2024).

## Design Anti-Patterns

### Anti-pattern 1: Entity agent

```
❌ "You are a senior domain expert with 20 years of experience..."
```

Persona names do not improve performance and can reduce it by 1–54% in code review tasks. Use simulation framing instead.

### Anti-pattern 2: Kitchen-sink agent

```
❌ One agent with 15 criteria covering domain, structure, and evolution
```

Exceeds attention budget. Criteria beyond position 7 will be silently omitted (IFScale: omission errors, not incorrect application).

### Anti-pattern 3: Symmetric agents

```
❌ Three agents that all review "code quality" from slightly different angles
```

Violates V2 (no responsibility overlap). If two agents can produce findings about the same issue, they will — creating contradictions and wasted effort.

### Anti-pattern 4: Self-validating agent

```
❌ Agent generates findings then self-reviews: "Let me check if these are correct..."
```

Same distribution cannot detect its own errors. Error detection rate: 10.1%. Move validation to a separate agent (the leader).

### Anti-pattern 5: Always-on activation

```
❌ Every commit triggers all simulation agents regardless of change type
```

Violates V7 (adaptive activation). Simple changes processed by all agents produce "no issues found" reports (wasted cost) or false positives (noise). Use the activation matrix.

## Worked Example: Code Quality Review Team

The code quality review team (defined in `CODE_QUALITY.md`, Simulator-based Role Definitions section) was designed using this process:

| Step                   | Outcome                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| 1. Identify dimensions | 3 concerns: domain naming, structural integrity, evolution alignment                    |
| 2. Separation tests    | All pairs fail at least one test → 3 separate agents + leader                           |
| 3. Dependency chain    | Domain → Structure → Evolution (L0 dependency chain: DK → AI → FD)                      |
| 4. Activation strategy | Adaptive with static matrix upper bound (Rename=1, Extract=2, Move=3, Interface/Arch=4) |
| 5. Simulation specs    | 3 specs with 6/4/4 criteria respectively                                                |
| 6. Leader spec         | Meta-simulation (activation) → validation → synthesis                                   |
| 7. Verification        | V1-V8 all pass                                                                          |

Implementation files:

```
.claude/agents/
├── domain-review.md       → Simulation 1 (L0 elements 1, 2, 4)
├── structure-review.md    → Simulation 2 (L0 element 3)
└── evolution-review.md    → Simulation 3 (L0 element 5)
```

The leader runs in the main Claude Code session — no agent file needed.

## Limitations

AGENT_DESIGN.md is optimized for evaluation and review tasks. This is because it assumes the pattern: "decompose into multiple judgment dimensions → execute as non-interfering simulations → leader integrates."

The following task types are not directly applicable:

- **Generative tasks** (writing code, designing systems) — the goal is creation, not evaluation
- **Single-judgment tasks** — all separation tests pass and a single agent is sufficient
- **Interactive tasks** — require iterative dialogue rather than one-directional evaluation

## References

- `.agents/LLM_AS_SIMULATOR.md` — Theoretical foundation (simulator framing, separation tests, probability mechanics)
- `.agents/CODE_QUALITY.md` — Domain application (code quality simulations, activation matrix, V1-V8)
- `.agents/AI_CODE_REVIEW.md` — Operational guidance (how to use CODE_QUALITY.md with AI agents)
- Claude Code Agent Teams: https://code.claude.com/docs/en/agent-teams
- Claude Code Subagents: https://code.claude.com/docs/en/sub-agents

---

## Open Questions

- ペルソナを決めるためにもこれは使えるのか？

---

Revision Note:

- 2026-02-22: Initial version. Created as the practical design process document bridging LLM_AS_SIMULATOR.md (theory) and CODE_QUALITY.md (domain application). Covers 7-step design process, Claude Code Agent Teams implementation details (.claude/agents/ format, task dependencies, hooks), knowledge injection strategies, 5 design anti-patterns, and worked example of code quality review team.
