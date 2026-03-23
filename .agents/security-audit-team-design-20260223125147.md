# Security Audit: Agent Team Design Log

This document records the full 7-step LLM-as-Simulator team design process applied to a security audit of todo-scan. Created as a verification artifact for `team-designer.md` experimentation.

- **Date**: 2026-02-23
- **Task**: Comprehensive security review of todo-scan
- **Methodology**: `.agents/AGENT_DESIGN.md` + `.agents/LLM_AS_SIMULATOR.md`
- **Issue**: https://github.com/sotayamashita/todox/issues/123

---

## Step 1: Identify Evaluation Dimensions

12 evaluation concerns identified:

| #   | Evaluation Concern                   | Judgment Type                            | External Knowledge                                | Output                        |
| --- | ------------------------------------ | ---------------------------------------- | ------------------------------------------------- | ----------------------------- |
| 1   | Command injection / process spawning | git/gh argument construction safety      | OS command injection, argument injection patterns | Vulnerable call sites         |
| 2   | Input validation                     | CLI args, git ref, config validation     | Injection patterns, type safety                   | Insufficient validation sites |
| 3   | Output escaping (GitHub Actions)     | Workflow command injection prevention    | `::error` annotation spec                         | Injectable annotation sites   |
| 4   | Output escaping (HTML/SARIF/MD)      | XSS, JSON injection prevention           | HTML/SARIF/MD escaping requirements               | Unescaped output sites        |
| 5   | Output escaping (terminal)           | ANSI injection prevention                | Terminal escape sequence attacks                  | ANSI-injectable output sites  |
| 6   | Filesystem security                  | Path traversal, symlink following        | Filesystem attack vectors                         | Unsafe file operations        |
| 7   | Cache security                       | TOCTOU, cache poisoning                  | Race conditions, bincode deserialization          | Cache vulnerabilities         |
| 8   | Dependency vulnerabilities           | Known CVEs, supply chain                 | Rust crate ecosystem security                     | Vulnerable dependencies       |
| 9   | Regex DoS (ReDoS)                    | Scanner pattern computational complexity | Regex complexity analysis                         | ReDoS-vulnerable patterns     |
| 10  | Resource exhaustion                  | File size / directory depth limits       | Algorithmic complexity attacks                    | DoS vectors                   |
| 11  | Trust boundary analysis              | Untrusted data flow tracking             | Data flow analysis                                | Trust boundary violations     |
| 12  | Information disclosure               | Error message / cache content leakage    | Information disclosure patterns                   | Leakage sites                 |

---

## Step 2: Apply the Four Separation Tests

### Pairwise Test Results (Representative Pairs)

| Pair                               | Test 0 (Gen-Verify) |                   Test 1 (Context Interference)                    | Test 2 (Distribution Compat) | Test 3 (Attention Budget) | Conclusion   |
| ---------------------------------- | :-----------------: | :----------------------------------------------------------------: | :--------------------------: | :-----------------------: | ------------ |
| Input(1,2) × Output(3,4,5)         |        Pass         | **Fail** — input validation knowledge vs output escaping knowledge |             Pass             |           Pass            | **Separate** |
| Input(1,2) × FS(6,7)               |        Pass         |         **Fail** — command semantics vs filesystem attacks         |             Pass             |           Pass            | **Separate** |
| Output(3,4,5) × FS(6,7,8)          |        Pass         |         **Fail** — output specs vs FS/dependency knowledge         |             Pass             |           Pass            | **Separate** |
| Input(1,2) × Algorithm(9,10,11,12) |        Pass         |            **Fail** — injection vs complexity analysis             |             Pass             |           Pass            | **Separate** |
| 1 × 2 (within Input)               |        Pass         |                                Pass                                |             Pass             |           Pass            | **Merge OK** |
| 3 × 4 × 5 (within Output)          |        Pass         |                                Pass                                |             Pass             |           Pass            | **Merge OK** |
| 6 × 7 × 8 (within FS)              |        Pass         |                                Pass                                |             Pass             |           Pass            | **Merge OK** |
| 9 × 10 × 11 × 12 (within Algo)     |        Pass         |                                Pass                                |             Pass             |           Pass            | **Merge OK** |

### Grouping Result: 4 Agents + 1 Leader

| Agent                            | Concerns Covered                                                           | Why Grouped (Which Tests Passed)                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **input-command-review**         | #1 Command injection, #2 Input validation                                  | Same context (external data → system). Distribution compatible. Criteria count = 2 (≤7). All 4 tests pass within pair.    |
| **output-injection-review**      | #3 GHA output, #4 HTML/SARIF/MD, #5 ANSI injection                         | Same context (system → external output). Distribution compatible. Criteria count = 6 (≤7). All 4 tests pass within group. |
| **filesystem-dependency-review** | #6 Path traversal, #7 Cache, #8 Dependencies                               | Same infrastructure layer. Distribution compatible. Criteria count = 6 (≤7). All 4 tests pass within group.               |
| **algorithmic-dataflow-review**  | #9 ReDoS, #10 Resource exhaustion, #11 Trust boundary, #12 Info disclosure | Same computation/data flow layer. Distribution compatible. Criteria count = 6 (≤7). All 4 tests pass within group.        |

---

## Step 3: Determine Dependency Chain

All agents are independent (no inter-agent dependencies). Leader depends on all 4.

```
input-command-review ─────────┐
output-injection-review ──────┤
filesystem-dependency-review ─┼──→ leader (validation + synthesis)
algorithmic-dataflow-review ──┘
```

- Dependencies are acyclic: ✓
- Leader depends on all simulations: ✓
- Independent simulations can run in parallel: ✓ (all 4)

---

## Step 4: Design Activation Strategy

### Activation Matrix

```
Full security audit     → All 4 simulations
CLI/input focused       → input-command + algorithmic-dataflow
Output focused          → output-injection
Dependency audit only   → filesystem-dependency
Code change review      → Selectively activate based on changed files
```

### Rationale

- Simple inputs (single-concern audits) activate 1 agent
- Complex inputs (full audit) activate all 4
- Adaptive activation: leader analyzes scope, applies matrix as upper bound

---

## Step 5: Write Simulation Specifications

### Simulation 1: input-command-review

```
Simulation:  Given the todo-scan Rust codebase, what command injection, argument
             injection, and input validation vulnerabilities would a security audit
             find in the CLI argument handling, git/gh process spawning, and
             configuration parsing?
Context:     OS command injection, argument injection (--flag confusion),
             TOML deserialization attacks, Rust process spawning semantics
Focus:
  1. Are all git refs validated against argument injection (refs starting with -)?
  2. Are all process spawning calls using array-based args (not shell strings)?
  3. Are CLI arguments properly typed and bounded by clap?
  4. Is TOML config parsing robust against malicious config files?
  5. Are git show / git ls-tree path arguments sanitized?
  6. Are gh CLI calls safe from argument injection?
Scope:       git.rs, diff.rs, clean.rs, blame.rs, config.rs, cli.rs, cmd/*.rs
             Do NOT evaluate: output formatting, filesystem traversal, regex patterns
Depends:     None
Output:      Finding[] { location: file:line, severity: critical|high|medium|low,
             vector: string, evidence: string, recommendation: string }
```

### Simulation 2: output-injection-review

```
Simulation:  Given the todo-scan output formatting code, what injection vulnerabilities
             would a security audit find in the GitHub Actions annotation output, SARIF
             output, HTML report generation, Markdown output, and terminal text output?
Context:     GitHub Actions workflow command injection (::error etc.), SARIF schema
             security, HTML/XSS injection, ANSI escape sequence injection
Focus:
  1. Are GitHub Actions annotations properly escaping TODO message text?
  2. Can malicious TODO comments inject workflow commands (:: prefix)?
  3. Is HTML report output properly escaping user-controlled content?
  4. Are SARIF outputs safe from JSON injection via message text?
  5. Is Markdown output safe from injection via TODO content?
  6. Can terminal output be exploited via ANSI escape sequences in TODO text?
Scope:       output/mod.rs, output/github_actions.rs, output/sarif.rs,
             output/html.rs, output/markdown.rs, report.rs
             Do NOT evaluate: input validation, filesystem operations, regex patterns
Depends:     None
Output:      Finding[] { location: file:line, severity: critical|high|medium|low,
             vector: string, evidence: string, recommendation: string }
```

### Simulation 3: filesystem-dependency-review

```
Simulation:  Given the todo-scan filesystem operations and dependency configuration,
             what path traversal, symlink following, cache poisoning, and dependency
             vulnerability issues would a security audit find?
Context:     Filesystem attack vectors (symlink attacks, path traversal, TOCTOU),
             Rust crate ecosystem security, cargo audit
Focus:
  1. Does the directory walker follow symlinks outside the project root?
  2. Are cache file operations atomic and resistant to TOCTOU?
  3. Can cache deserialization (bincode) be exploited with crafted cache files?
  4. Are there known CVEs in any dependencies?
  5. Is the watch command's file event handling safe from race conditions?
  6. Are output file paths (--output) validated against path traversal?
Scope:       scanner.rs, cache.rs, watch.rs, workspace.rs, Cargo.toml, Cargo.lock
             Do NOT evaluate: CLI argument handling, output formatting, regex patterns
Depends:     None
Output:      Finding[] { location: file:line, severity: critical|high|medium|low,
             vector: string, evidence: string, recommendation: string }
```

### Simulation 4: algorithmic-dataflow-review

```
Simulation:  Given the todo-scan regex patterns and data processing pipeline, what
             ReDoS, resource exhaustion, and trust boundary violations would a security
             audit find?
Context:     Regular expression complexity analysis, algorithmic complexity attacks,
             Rust memory safety guarantees, trust boundary analysis
Focus:
  1. Are scanner regex patterns vulnerable to ReDoS with crafted input?
  2. Are there resource limits on file sizes processed?
  3. Are there limits on directory depth/breadth during scanning?
  4. Does untrusted data (TODO comment text) flow into security-sensitive operations
     without sanitization?
  5. Can crafted file contents cause excessive memory allocation?
  6. Are error messages disclosing sensitive information (paths, internals)?
Scope:       scanner.rs, config.rs, context.rs, cmd/*.rs, model.rs
             Do NOT evaluate: output formatting, process spawning, filesystem traversal
Depends:     None
Output:      Finding[] { location: file:line, severity: critical|high|medium|low,
             vector: string, evidence: string, recommendation: string }
```

---

## Step 6: Write Leader Specification

```
Phase 1 — Activation decision:
  Analyze the input. Determine which simulations are needed using the activation
  matrix. For this task (full security audit): all 4 simulations activated.

Phase 2 — Validation (generation-verification separation):
  Cross-check simulation outputs for:
  - Contradictions between simulations (same code assessed differently)
  - False positives (findings that don't hold under scrutiny)
  - Missing coverage (attack surfaces no simulation addressed)

Phase 3 — Synthesis:
  Integrate validated findings into a single severity-ranked security report.
  Each finding: location, severity, attack vector, evidence, fix recommendation.
  Group by severity: critical → high → medium → low.
```

---

## Step 7: Verify Against V1-V8

| #   | Criterion                          | Result   | Justification                                                                                        |
| --- | ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| V1  | No contradictory judgments         | **Pass** | Each agent limited to a single security evaluation frame (input/output/FS/algo)                      |
| V2  | No responsibility overlap          | **Pass** | Each concern maps to exactly one agent. Explicit "Do NOT evaluate" scope boundaries prevent overlap  |
| V3  | Criteria count within limit        | **Pass** | Each agent has 6 criteria (≤ 7)                                                                      |
| V4  | Generation-verification separation | **Pass** | Agents generate findings; leader validates and synthesizes. No self-validation                       |
| V5  | Dependency chain respected         | **Pass** | All agents independent (parallel). Leader runs after all complete                                    |
| V6  | Scope completeness                 | **Pass** | All attack surfaces covered: input (A1), output (A2), FS/deps (A3), algo/dataflow (A4)               |
| V7  | Adaptive activation                | **Pass** | Activation matrix: 1 agent for scoped reviews, 4 for full audit                                      |
| V8  | Structured communication           | **Pass** | All agents report Finding[] with typed fields (location, severity, vector, evidence, recommendation) |

---

## Design Summary

| Agent                        | Simulation Focus                                              | Criteria Count | Dependencies |
| ---------------------------- | ------------------------------------------------------------- | :------------: | :----------: |
| input-command-review         | CLI args, git/gh process spawning, config parsing             |       6        |     None     |
| output-injection-review      | GHA/SARIF/HTML/MD/ANSI output escaping                        |       6        |     None     |
| filesystem-dependency-review | Path traversal, cache security, dependency CVEs               |       6        |     None     |
| algorithmic-dataflow-review  | ReDoS, resource exhaustion, trust boundaries, info disclosure |       6        |     None     |
| **leader**                   | Validation, contradiction resolution, synthesis               |       —        |    All 4     |

---

## Agent Teams Prompt (Copy-Pasteable)

```
I need a comprehensive security audit of the todo-scan Rust CLI tool. Create an agent team with 4 teammates, all running in parallel:

**Teammate 1 (input-command-review):** Analyze what command injection, argument injection, and input validation vulnerabilities a security audit would find in the CLI argument handling, git/gh process spawning, and configuration parsing. Focus on these 6 criteria:
1. Are all git refs validated against argument injection (refs starting with `-`)?
2. Are all process spawning calls using array-based args (not shell strings)?
3. Are CLI arguments properly typed and bounded by clap?
4. Is TOML config parsing robust against malicious config files?
5. Are git show / git ls-tree path arguments sanitized?
6. Are gh CLI calls safe from argument injection?
Scope: git.rs, diff.rs, clean.rs, blame.rs, config.rs, cli.rs, cmd/*.rs. Do NOT evaluate output formatting, filesystem traversal, or regex patterns.
Report each finding as: { location: file:line, severity: critical|high|medium|low, vector: description, evidence: code excerpt, recommendation: fix }

**Teammate 2 (output-injection-review):** Analyze what injection vulnerabilities a security audit would find in the output formatting code — GitHub Actions annotations, SARIF, HTML reports, Markdown, and terminal text. Focus on these 6 criteria:
1. Are GitHub Actions annotations properly escaping TODO message text?
2. Can malicious TODO comments inject workflow commands (:: prefix)?
3. Is HTML report output properly escaping user-controlled content?
4. Are SARIF outputs safe from JSON injection via message text?
5. Is Markdown output safe from injection via TODO content?
6. Can terminal output be exploited via ANSI escape sequences in TODO text?
Scope: output/mod.rs, output/github_actions.rs, output/sarif.rs, output/html.rs, output/markdown.rs, report.rs. Do NOT evaluate input validation, filesystem operations, or regex patterns.
Report each finding as: { location: file:line, severity: critical|high|medium|low, vector: description, evidence: code excerpt, recommendation: fix }

**Teammate 3 (filesystem-dependency-review):** Analyze what path traversal, symlink following, cache poisoning, and dependency vulnerability issues a security audit would find. Focus on these 6 criteria:
1. Does the directory walker follow symlinks outside the project root?
2. Are cache file operations atomic and resistant to TOCTOU?
3. Can cache deserialization (bincode) be exploited with crafted cache files?
4. Are there known CVEs in any dependencies (run cargo audit)?
5. Is the watch command's file event handling safe from race conditions?
6. Are output file paths (--output) validated against path traversal?
Scope: scanner.rs, cache.rs, watch.rs, workspace.rs, Cargo.toml, Cargo.lock. Do NOT evaluate CLI argument handling, output formatting, or regex patterns.
Report each finding as: { location: file:line, severity: critical|high|medium|low, vector: description, evidence: code excerpt, recommendation: fix }

**Teammate 4 (algorithmic-dataflow-review):** Analyze what ReDoS, resource exhaustion, trust boundary violations, and information disclosure issues a security audit would find. Focus on these 6 criteria:
1. Are scanner regex patterns vulnerable to ReDoS with crafted input?
2. Are there resource limits on file sizes processed?
3. Are there limits on directory depth/breadth during scanning?
4. Does untrusted data (TODO comment text) flow into security-sensitive operations without sanitization?
5. Can crafted file contents cause excessive memory allocation?
6. Are error messages disclosing sensitive information (paths, internals)?
Scope: scanner.rs, config.rs, context.rs, cmd/*.rs, model.rs. Do NOT evaluate output formatting, process spawning, or filesystem traversal mechanics.
Report each finding as: { location: file:line, severity: critical|high|medium|low, vector: description, evidence: code excerpt, recommendation: fix }

After all 4 teammates complete their analysis, validate their findings by cross-checking for:
- Contradictions between teammates (same code assessed differently)
- False positives (findings that don't hold under scrutiny)
- Missing coverage (attack surfaces no teammate addressed)

Then synthesize all validated findings into a single severity-ranked security report with actionable recommendations, grouped by severity (critical → high → medium → low).
```

---

## Observations for team-designer.md Verification

### What Worked Well

- The 12 concerns mapped cleanly into 4 groups via separation tests
- Test 1 (context interference) was the primary separator — security domains have naturally distinct knowledge contexts
- All agents ended up independent (no dependency chain needed), enabling full parallelism
- The 6-criteria-per-agent distribution was balanced without forcing

### What Could Be Improved

- The activation matrix is hypothetical — actual usage patterns would refine it
- Step 2 pairwise testing becomes combinatorial with 12 concerns (66 pairs) — in practice, group-level testing was used after initial obvious separations
- The "Do NOT evaluate" scope boundaries are critical for V2 compliance but add prompt length

### Design Decisions

- **Why 4 agents, not 3 or 5?** The separation tests naturally produced 4 groups. Merging filesystem+algorithmic would fail Test 1 (FS attack knowledge dilutes regex complexity analysis). Splitting output into GHA vs HTML would violate Test 3 (each would have too few criteria to justify a separate agent).
- **Why no dependency chain?** Security evaluation dimensions are naturally orthogonal — input security findings don't inform output security analysis. This is domain-specific; code quality reviews (the AGENT_DESIGN.md worked example) have natural dependencies (domain → structure → evolution).
- **Why simulator framing matters here?** "What vulnerabilities would a security audit find?" produces more specific findings than "You are a security expert, review this code" because it conditions on an evaluation process rather than a persona.
