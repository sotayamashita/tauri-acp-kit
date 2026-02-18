---
name: code-health-check
description: Evaluate codebase health against a cognitive-science-grounded quality framework. Use when the user says "check code health", "diagnose this module", "run health check", "evaluate code quality", "check cognitive fit", "check structural integrity", "check evolutionary fitness", or asks about code quality of specific files or modules. Combines automated metrics with AI-powered qualitative evaluation. Does NOT fix code — diagnosis only.
---

# Code Health Check

Evaluate code health by combining measurable metrics with AI judgment, organized by three quality dimensions. This skill diagnoses — it does not fix.

## Workflow

### 1. Determine scope

Identify what to evaluate:

- **File scope**: Which files or modules? Default to the file or module the user mentions. If none specified, ask.
- **Dimension scope**: Which dimension? Default to Dimension 1 (Cognitive Fit) unless the user specifies otherwise.

Dimension keywords to detect:

- "cognitive fit", "readability", "comprehension", "working memory" → Dimension 1
- "structural integrity", "coupling", "cohesion", "responsibility" → Dimension 2
- "evolutionary fitness", "testability", "maintainability", "entropy" → Dimension 3
- "all dimensions", "full check" → All three, reported separately

Never evaluate all dimensions at once unless explicitly requested. When evaluating all, report each dimension separately in sequence.

### 2. Read the target code

Read the files to be evaluated. For large modules, focus on the public API surface and the most complex functions.

### 3. Run metrics

Read [references/metrics.md](references/metrics.md) for the selected dimension's metrics catalog.

For each applicable metric, measure the value and compare against the threshold. Report as:

    [Metric name]: [value] ([pass/warning/critical] — threshold: [threshold])

Skip metrics that do not apply to the target (e.g., skip "test coverage" for a type definition file).

### 4. Apply AI judgment

Read [references/ai-evaluation.md](references/ai-evaluation.md) for the selected dimension's evaluation criteria.

For each criterion, ask the specified question about the code. Report observations using the prescribed format:

    [Criterion]: [rating]. [Specific observation with example from the code.]

### 5. Run overcomplication detection

After the dimension evaluation, apply the overcomplication check from [references/ai-evaluation.md](references/ai-evaluation.md) using perspective-shifting:

"Would a senior engineer look at this code and say it is overcomplicated?"

### 6. Produce the health report

Use this structure:

    ## Health Report: [file or module name]

    **Dimension**: [name]
    **Scope**: [files evaluated]

    ### Metrics

    [One line per metric with value and threshold comparison]

    ### AI Evaluation

    [One paragraph per criterion with the prescribed report format]

    ### Overcomplication Check

    [Result of perspective-shifting evaluation]

    ### Summary

    [2-3 sentences: overall health assessment, most important finding, suggested next step if any issues found]

Use CODE_QUALITY.md vocabulary throughout: dimension names, principle names, gate references.

## References

- **[references/dimensions.md](references/dimensions.md)** — Read when you need to understand the three dimensions and four decision gates in detail. Contains the quality principles that define what "good" means.
- **[references/metrics.md](references/metrics.md)** — Read during Step 3 (Run metrics). Contains measurable metrics with thresholds organized by dimension.
- **[references/ai-evaluation.md](references/ai-evaluation.md)** — Read during Step 4 (Apply AI judgment). Contains AI evaluation criteria as specific questions organized by dimension.
