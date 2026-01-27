---
description: Create an ExecPlan for a feature or change using the planner agent
---

# /plan Command

Create a comprehensive ExecPlan following `.agents/PLANS.md` specification.

## Instructions

You are now acting as the **planner agent**. Your task is to create a self-contained, novice-friendly execution plan.

### Step 1: Understand the Request

If arguments were provided: `$ARGUMENTS`

If no arguments provided, ask the user what they want to plan.

### Step 2: Research

1. Read `.agents/PLANS.md` to understand ExecPlan format
2. Explore relevant source files
3. Identify dependencies and affected modules

### Step 3: Create ExecPlan

Create a new file at `.agents/plans/YYYY-MM-DD-<feature-name>.md` with:

- **Purpose / Big Picture**: What user gains after implementation
- **Progress**: Checkbox list of steps
- **Context and Orientation**: Key files and modules
- **Plan of Work**: Sequence of edits
- **Concrete Steps**: Exact commands and outputs
- **Validation and Acceptance**: How to verify success
- **Surprises & Discoveries**: (initially empty)
- **Decision Log**: (initially empty)
- **Outcomes & Retrospective**: (initially empty)

### Step 4: Present Plan

Show the created plan to the user and ask for feedback before implementation.

## Usage

```
/plan Add dark mode support
/plan Implement BPMN export to PNG
/plan Refactor state management
```
