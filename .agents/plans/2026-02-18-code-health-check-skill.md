# Code Health Check Skill

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document must be maintained in accordance with `.agents/PLANS.md`.

## Purpose / Big Picture

Create an agent skill that evaluates codebase health against the quality framework defined in CODE_QUALITY.md. After this change, a user can invoke the skill (e.g., "check code health" or "diagnose this module") and receive a structured health report that combines automated metrics with AI-powered qualitative evaluation.

The skill addresses a gap: CODE_QUALITY.md defines "good" but provides no mechanism to detect deviations. Traditional static analysis tools measure some aspects (parameter count, nesting depth) but cannot evaluate others (naming quality, convention adherence, local comprehensibility). This skill combines both.

## Three Roles: Why This Skill Exists

This skill sits at the intersection of two existing documents and fills a third role:

1. **CODE_QUALITY.md** (`.agents/CODE_QUALITY.md`) — defines **what** to evaluate. Provides the three dimensions (Cognitive Fit, Structural Integrity, Evolutionary Fitness), four decision gates, and the cognitive science foundations. This is the evaluation criteria. The skill bundles a reference copy of the relevant principles so it works across projects.

2. **AI_CODE_REVIEW.md** (`.agents/AI_CODE_REVIEW.md`) — defines **how** to evaluate with AI agents. Its key constraints are baked into the skill's workflow design:
   - Scope to specific dimensions or gates, never "check everything at once"
   - Use metrics for what is measurable, AI judgment for what is not
   - Use perspective-shifting (persona prompts) for overcomplication detection, not framework enumeration
   - Report findings using CODE_QUALITY.md's vocabulary (dimensions, gates, principles)

3. **The skill itself** — the **tool** that executes the evaluation. It operationalizes the criteria (from CODE_QUALITY.md) under the constraints (from AI_CODE_REVIEW.md).

In short: CODE_QUALITY.md is the textbook. AI_CODE_REVIEW.md is the manual for how AI should use the textbook. This skill is the diagnostic tool built from both.

## Progress

- [x] Milestone 1: Design skill structure and evaluation criteria
- [x] Milestone 2: Initialize skill with skill-creator (at `.claude/skills/code-health-check/`)
- [x] Milestone 3: Implement references (dimensions.md, metrics.md, ai-evaluation.md)
- [x] Milestone 4: Write SKILL.md workflow
- [x] Milestone 5: Package and validate skill (validation passed)

## Surprises & Discoveries

- Observation: The skill-creator's init_skill.py `--path` flag specifies the parent directory, not the skill directory itself. Running `init_skill.py code-health-check --path /some/dir/` creates `/some/dir/code-health-check/`.

- Observation: The initial instinct was to place the skill at the global `~/.claude/skills/` directory (where all other installed skills live). The user corrected this — project-specific skills belong under the project's `.claude/skills/` directory. This distinction matters: global skills are user-wide tools, project skills are project-specific diagnostics tied to the project's quality framework.

## Decision Log

- Decision: Bundle CODE_QUALITY.md principles as references rather than requiring the file to exist in the target project.
  Rationale: Makes the skill self-contained and usable across any project, per skill-creator's design principles. Projects can still have their own CODE_QUALITY.md; the skill's bundled reference serves as the default.
  Date/Author: 2026-02-18

- Decision: Bake AI_CODE_REVIEW.md constraints into SKILL.md workflow rather than bundling it as a reference.
  Rationale: AI_CODE_REVIEW.md is operational knowledge about how to structure AI evaluation. It should inform the skill's design (the workflow in SKILL.md), not be read at runtime. Loading it at runtime would add context overhead without benefit — the constraints are already embedded in the workflow structure.
  Date/Author: 2026-02-18

- Decision: Place skill at project-level `.claude/skills/code-health-check/` rather than global `~/.claude/skills/`.
  Rationale: This skill is tied to the project's quality framework (CODE_QUALITY.md). Project-level placement makes it version-controlled with the project and available to all contributors. Global placement would make it a personal tool invisible to the team.
  Date/Author: 2026-02-18

## Outcomes & Retrospective

Skill created and validated successfully. Structure:

    .claude/skills/code-health-check/
    ├── SKILL.md              — Workflow (6 steps: scope → read → metrics → AI judgment → overcomplication → report)
    └── references/
        ├── dimensions.md     — Three dimensions + four gates (distilled from CODE_QUALITY.md)
        ├── metrics.md        — 9 measurable metrics with thresholds by dimension
        └── ai-evaluation.md  — 10 AI judgment criteria as specific questions + overcomplication detection

Validation pending: invoke the skill on known problem files (ChatInput.tsx, useAcpSession.ts, AcpChat.tsx) to verify it identifies known issues.

## Context and Orientation

### Skill Location and Structure

The skill is located at `.claude/skills/code-health-check/` (project-level, version-controlled). The structure follows skill-creator conventions:

```
code-health-check/
├── SKILL.md              — Workflow instructions (what to do when triggered)
└── references/
    ├── dimensions.md     — The three dimensions and their principles (from CODE_QUALITY.md)
    ├── metrics.md        — Measurable metrics, thresholds, and tools
    └── ai-evaluation.md  — AI judgment criteria for unmeasurable aspects
```

### What the Skill Evaluates

The skill's evaluation is organized by CODE_QUALITY.md's three dimensions. Each dimension has aspects that are measurable by metrics and aspects that require AI judgment.

**Dimension 1: Cognitive Fit**

Measurable:

- Parameter count per function (threshold: >7 is a warning, from Cowan's 4±1 plus margin)
- Nesting depth (threshold: >3 levels)
- Cognitive complexity (SonarQube definition, preferred over cyclomatic complexity because it penalizes nesting)
- Function/file length (as proxy for working memory overflow)

AI judgment:

- Beacon-rich: Do names signal intent? Can the reader form a correct hypothesis before reading implementation?
- Conventional: Does the code follow ecosystem conventions? Would chunking work for an experienced developer?
- Locally comprehensible: Can this code be understood without navigating to other files?

**Dimension 2: Structural Integrity**

Measurable:

- Import/dependency count per module (coupling proxy)
- Export count per module (surface area)

AI judgment:

- Single responsibility: Does this unit have one reason to change?
- Low viscosity: Is the "right" change easier than the "wrong" change?
- Simple vs Easy: Are concepts entangled or independent?

**Dimension 3: Evolutionary Fitness**

Measurable:

- Test coverage (proxy, imperfect)
- Dead code (knip or equivalent)
- File churn rate (git log analysis — files that change frequently deserve more attention)

AI judgment:

- Habitable: Can a new contributor find where to make a change?
- Entropy-resistant: Is there an obvious place for new features?
- Testable: Can units be tested without elaborate setup?

### Workflow Design (from AI_CODE_REVIEW.md constraints)

The skill does NOT evaluate all three dimensions at once. The default workflow:

1. User triggers the skill (optionally specifying a dimension, gate, or file scope)
2. If no dimension specified, default to Dimension 1 (Cognitive Fit) — the highest-impact dimension
3. Run measurable metrics for the selected dimension
4. Apply AI judgment for unmeasurable aspects of the same dimension
5. For overcomplication detection specifically, use perspective-shifting: "Would a senior engineer say this is overcomplicated?"
6. Report findings using CODE_QUALITY.md vocabulary

## Plan of Work

### Milestone 1: Design skill structure and evaluation criteria

Finalize the evaluation criteria for each dimension. Map each criterion to either a metric (with threshold) or an AI judgment prompt. This milestone produces the content for the three reference files.

Review CODE_QUALITY.md to extract all evaluable principles. For each principle, determine:

- Is it measurable? If yes, what metric and what threshold?
- Is it AI-judgable? If yes, what specific question should the AI ask?

### Milestone 2: Initialize skill with skill-creator

Run the init_skill.py script to create the skill directory structure. Remove example files that are not needed. The skill needs only `references/` (no `scripts/` or `assets/`).

```
python /path/to/.claude/skills/skill-creator/scripts/init_skill.py code-health-check --path <output-directory>
```

### Milestone 3: Implement references

Create the three reference files:

- `references/dimensions.md` — Extract the three dimensions and their principles from CODE_QUALITY.md in a form optimized for the skill's evaluation workflow. Not a copy of CODE_QUALITY.md; a distilled, actionable version.
- `references/metrics.md` — Catalog of measurable metrics with thresholds, organized by dimension.
- `references/ai-evaluation.md` — Catalog of AI judgment criteria, each as a specific question the AI should ask about the code, organized by dimension.

### Milestone 4: Write SKILL.md workflow

Write the SKILL.md with:

- Frontmatter: name, description (including trigger phrases)
- Body: The evaluation workflow, scoped by default to one dimension at a time
- References to bundled files with clear "when to read" instructions
- Output format for the health report

The workflow must embed AI_CODE_REVIEW.md's constraints:

- Never evaluate all dimensions at once unless explicitly requested
- Use metrics first, then AI judgment
- Use perspective-shifting for overcomplication detection
- Report with CODE_QUALITY.md vocabulary

### Milestone 5: Package and validate

Run the package_skill.py script to validate and package the skill.

```
python /path/to/.claude/skills/skill-creator/scripts/package_skill.py <path/to/code-health-check>
```

Fix any validation errors and re-package.

## Validation and Acceptance

After creating the skill:

1. The skill should trigger when the user says "check code health", "diagnose this module", "run health check on this file", or similar phrases
2. By default, it should evaluate Dimension 1 (Cognitive Fit) only
3. When given a specific dimension ("check structural integrity of this module"), it should scope to that dimension
4. The output should use CODE_QUALITY.md terminology (dimension names, principle names)
5. Metrics should be reported with actual numbers and thresholds
6. AI judgments should be reported as specific observations with principle references
7. The skill should NOT try to fix code — it only diagnoses

Test by invoking the skill on known files in this project:

- `src/features/acp-chat/components/ChatInput.tsx` — known to have 14 props (Dimension 1 violation)
- `src/features/acp-chat/hooks/useAcpSession.ts` — known to have 11 mutable items (Dimension 1 violation)
- `src/features/acp-chat/components/AcpChat.tsx` — known God Component (Dimension 2 violation)

Expected: The skill identifies these known issues and reports them using CODE_QUALITY.md vocabulary.

## Idempotence and Recovery

The skill creation process is additive. If the skill directory already exists, edit files in place. The package_skill.py script can be run repeatedly.

## Artifacts and Notes

Skill initialization command used:

    python /path/to/.claude/skills/skill-creator/scripts/init_skill.py code-health-check --path /path/to/project/.claude/skills/

Packaging validation command used:

    python /path/to/.claude/skills/skill-creator/scripts/package_skill.py /path/to/project/.claude/skills/code-health-check

Both passed without errors.

## Interfaces and Dependencies

- skill-creator (`/path/to/.claude/skills/skill-creator/`) — provides init_skill.py and package_skill.py
- CODE_QUALITY.md (`.agents/CODE_QUALITY.md`) — source of evaluation criteria
- AI_CODE_REVIEW.md (`.agents/AI_CODE_REVIEW.md`) — source of operational constraints (baked into workflow, not bundled)
