疑問（解決さら削除）:

- 既存の cyclomatic complexity などのメトリクスで図れるものはあるのか？
- リファクタリングしたい場合は横断的にどうすればいいのか？、どう使うのか?
- `"Would a senior engineer say this is overcomplicated? If yes, simplify."` が優れている点として焦点が単一の失敗モード（過剰複雑化）に絞られている点視点の切り替え（ペルソナ）が良い点として理解しました。ただ @CODE_QUALITY.md でも "Theme 1: Perspective " にかかれている

# Code Quality Definition: What "Good" Means

This document defines what "good code" means. It serves as a decision-making framework for refactoring work in any codebase. When evaluating whether a change improves code, consult this document.

This is a living document. Update it as understanding evolves.

## Why This Document Exists

Martin Fowler defines refactoring as "changing the internal structure of software to make it easier to understand and modify, without changing its external behavior." But what does "easier to understand" mean concretely? What makes code "easier to modify"? This document answers those questions, grounded in cognitive science research and software engineering principles, so that refactoring decisions are principled rather than aesthetic.

The key insight from Ward Cunningham's original technical debt metaphor: debt arises not from writing sloppy code, but from the gap between our current understanding and what the code reflects. As we learn more about the problem, the code should evolve to reflect that understanding. This document captures that understanding in a reusable form.

## How This Document Is Organized

Understanding "good code" requires perspectives from multiple disciplines. This document synthesizes them into three layers and two cross-cutting themes.

### Three Layers

The definition of "good" is built in three layers, each answering a different question:

| Layer             | Question                                        | Content in This Document                                                                              |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Layer 1: Why**  | Why do certain code qualities matter?           | Cognitive Foundations — grounded in cognitive science research on how humans read and understand code |
| **Layer 2: What** | What qualities should code have?                | The Three Dimensions of Good — principles synthesized from 12+ software quality frameworks            |
| **Layer 3: How**  | How do we achieve and maintain those qualities? | Decision Framework + Refactoring Methods — actionable processes for evaluating and performing changes |

Layer 1 provides the evidence base. Layer 2 defines the target. Layer 3 provides the means. Each layer builds on the one below it: the cognitive science (Layer 1) justifies the quality principles (Layer 2), which inform the practical methods (Layer 3).

### Two Cross-cutting Themes

Two themes cut across all three layers:

**Theme 1: Perspective — whose view defines "good"?**

Code is read, written, changed, and maintained by different people (or AI) at different times. "Good" depends on whose perspective you take:

- **The writer** optimizes for speed of expression — but code is read far more often than written
- **The reader** optimizes for comprehension — this is the primary audience (see "Who Reads Code")
- **The changer** optimizes for safe modification — the code must support change without surprise
- **The maintainer** optimizes for long-term sustainability — today's convenience must not become tomorrow's burden

Rich Hickey's "Simple vs Easy" distinction is central here: "easy" serves the writer (familiar, convenient, nearby), while "simple" serves everyone else (untangled, one concept per unit, independently understandable). When writer-convenience and reader-comprehension conflict, favor the reader.

**Theme 2: Invariants — principles that hold across all methods**

Regardless of which refactoring method or quality framework you apply, certain principles remain constant:

- **Small steps**: Every change should be small enough to verify. Large changes are sequences of small changes.
- **Behavior preservation**: Refactoring must not change observable behavior. If behavior changes, it is not a refactoring — it is a rewrite.
- **Always deployable**: The codebase should be in a deployable state after every change. Never "break things now, fix later."
- **Two hats** (Fowler): Either you are adding functionality or you are improving structure. Never both simultaneously.
- **Patterns emerge, not imposed** (Kerievsky): Abstraction should emerge from observed repetition (Rule of Three), not from anticipated future needs.

## Who Reads Code

Code is written once but read many times. The "readers" of any codebase include:

1. **The future maintainer** (likely the original author, weeks or months later, with faded context)
2. **AI assistants** (Claude, Copilot, etc.) asked to modify or extend the code, constrained by context windows
3. **New contributors** encountering the codebase for the first time

All three share a common constraint: **limited working memory**. Humans hold 4 +/- 1 chunks in working memory (Cowan, 2001). AI assistants have finite context windows. New contributors have no prior schema for the codebase.

"Good code" is code that respects these constraints.

## Cognitive Foundations

The principles in this document are not aesthetic preferences. They are grounded in how humans process code.

### Working Memory Is the Bottleneck

Human working memory holds approximately 4 chunks without rehearsal (Cowan, 2001). Every parameter, state variable, and abstraction layer that must be held in mind simultaneously competes for these slots. When the limit is exceeded, comprehension degrades and errors increase.

Practical consequence: A function with 14 parameters cannot be understood as a whole. A component with 7 state variables plus 4 refs requires the reader to track 11 items simultaneously.

### Chunking Requires Convention

Experienced developers compress familiar patterns into single chunks. A "factory pattern" or "event listener registration" is one chunk, not dozens of lines. But this compression only works when code follows recognizable conventions (Soloway & Ehrlich, 1984).

Critical finding: When code violates programming discourse rules (conventions), the comprehension advantage of experienced developers over novices disappears. "Clever" unconventional code neutralizes expertise.

Practical consequence: Idiomatic code is not about aesthetics. It is about enabling cognitive compression. Follow the patterns established in the codebase and its ecosystem's conventions.

### Nested Structures Are Expensive

Research (Int'l Journal of STEM Education, 2023) shows that nested structures impose three simultaneous cognitive demands: fast encoding of inner levels, robust maintenance of outer levels, and selective updating across levels. This is why deeply nested code is disproportionately harder to understand than flat code of the same logical complexity.

Practical consequence: Prefer early returns, guard clauses, and extraction over nesting. Each level of nesting multiplies cognitive cost, not adds to it.

### Context Switching Destroys Focus

Recovery from a context switch takes an average of 23 minutes (Gloria Mark, UC Irvine). Attention residue from the previous context persists for 30-60 minutes (Sophie Leroy). Every file the reader must open, every abstraction they must look up, every distant definition they must find is a context switch.

Practical consequence: Code that can be understood without leaving the current file is strictly better than code that requires navigating to other files. Locality of information matters.

### Beacons Guide Comprehension

Experienced developers use "beacons" -- recognizable surface features that signal the code's purpose (Brooks, 1983; Wiedenbeck, 1986). A swap operation signals sorting. An `onDelta` callback signals event handling. Clear beacons accelerate understanding; absent or misleading beacons force slow, line-by-line reading.

Practical consequence: Function names, variable names, and structural patterns should immediately signal intent. The reader should be able to form a correct hypothesis about what code does before reading the implementation.

## The Three Dimensions of "Good"

"Good" is not a single axis. It has three independent dimensions. Improving one without considering the others can make the code worse overall.

### Dimension 1: Cognitive Fit -- Can the reader hold it in their head?

This dimension asks: can a single developer (or AI assistant) understand this unit of code without external aids, scrolling, or file navigation?

Principles:

- **Fits in working memory**: The number of concepts that must be simultaneously tracked is within human limits (roughly 4-7 items). This applies to: parameters of a function, state variables of a hook, responsibilities of a component, nesting depth.

- **Locally comprehensible**: Understanding a piece of code does not require reading other files. The information needed to understand what the code does is either present or obvious from naming.

- **Conventional**: The code follows patterns recognizable to someone experienced in the project's language and framework. A reader experienced in the ecosystem should be able to predict the structure of common abstractions. The code enables chunking.

- **Beacon-rich**: Names, patterns, and structure immediately signal intent. The reader can form a correct hypothesis before reading the implementation details.

Sources: Miller (1956), Cowan (2001), Soloway & Ehrlich (1984), Brooks (1983), Wiedenbeck (1986), "Code That Fits in Your Head" (Mark Seemann)

### Dimension 2: Structural Integrity -- Does the structure support change?

This dimension asks: when the requirements change (and they will, per Lehman's First Law), does the code structure make the change local or does it ripple across the system?

Principles:

- **Single responsibility**: Each unit (module, class, function) has one reason to change. If the display logic changes, only the display module changes. If the data format changes, only the data handling changes.

- **Low coupling**: Units depend on minimal, well-defined interfaces. Changing one unit does not force changes in unrelated units. Data drilling across multiple layers is a coupling smell.

- **High cohesion**: Everything within a unit is related to the same concept. A module that manages both presentation and data fetching has low cohesion.

- **Low viscosity**: Making the "right" change is easier than making the "wrong" change (Green & Petre's Cognitive Dimensions). The code structure should make it natural to add new features in the right place rather than bolting them onto existing components.

- **Simple, not Easy**: Following Rich Hickey's distinction -- prefer code where concepts are not entangled (simple) over code where everything is conveniently in one place (easy). Easy produces fast initial velocity but decelerating long-term progress. Simple produces slower initial velocity but sustained long-term progress.

Sources: SOLID (Martin), Simple Made Easy (Hickey), Cognitive Dimensions (Green & Petre), Lehman's Laws, CUPID (North)

### Dimension 3: Evolutionary Fitness -- Can the code sustain development over time?

This dimension asks: does the codebase support sustained development velocity, or does each change become harder than the last?

Principles:

- **Testable**: Every unit can be tested in isolation without elaborate setup. If testing requires mocking the entire application, the unit is too coupled. Tests serve as the safety net that makes refactoring possible (Feathers, 2004).

- **Habitable**: The codebase is a place where developers can work comfortably (Gabriel). This means: predictable file locations, consistent patterns, no traps or surprises. A new contributor should be able to find where to make a change within minutes.

- **Entropy-resistant**: The structure actively resists degradation. New features have an obvious, correct place to go. The "Pit of Success" principle: doing the right thing should be the easiest path. When adding a new variant to an existing feature, the developer should not have to touch 5 files.

- **Incrementally improvable**: The Boy Scout Rule can be applied without risk. Small improvements can be made safely during normal development, preventing the accumulation of entropy.

Sources: Working Effectively with Legacy Code (Feathers), Patterns of Software (Gabriel), Pit of Success (Mariani), Lehman's Laws, Software Entropy

## Decision Framework

When evaluating whether a refactoring improves the code, apply these questions in order:

### Gate 1: Does it preserve behavior?

If the refactoring changes observable behavior, it is not a refactoring. Stop. Write tests first to characterize the current behavior (Feathers' characterization tests), then refactor.

### Gate 2: Does it reduce cognitive load?

After the change, can a developer understand the modified code with less mental effort? Specifically:

- Are there fewer things to hold in mind simultaneously?
- Is the nesting shallower?
- Are the names more intention-revealing?
- Can the code be understood without navigating to other files?

If the refactoring moves complexity from one place to another without reducing it (e.g., extracting a function that is only called once and requires understanding the extraction site plus the extracted function), it may not be an improvement.

### Gate 3: Does it improve structural integrity?

After the change:

- Does each unit have fewer reasons to change?
- Are the dependencies between units simpler?
- Is it easier to make the next change in the right place?

### Gate 4: Does it support sustained development?

After the change:

- Is the code easier to test?
- Is there an obvious place for new features?
- Can a new contributor find their way?

### When NOT to refactor

- **YAGNI**: Do not refactor toward a hypothetical future requirement. Refactor to make the current code better, not to prepare for changes that may never come.
- **Diminishing returns**: Do not refactor code that is rarely changed. Prioritize code with high change frequency (hot paths).
- **Refactoring to patterns prematurely**: Patterns should emerge from the code's needs (Kerievsky), not be imposed. If the duplication count is below 3, extraction may be premature.

## Refactoring Methods

When performing refactoring, choose the method appropriate to the scale:

- **Small, local changes**: Apply Fowler's catalog directly (Extract Function, Rename Variable, Replace Nested Conditional with Guard Clauses, etc.). Use the Boy Scout Rule: leave code better than you found it.

- **Medium structural changes**: Use Kent Beck's two-step approach: "Make the change easy (warning: this is the hard part), then make the easy change." Separate preparatory refactoring from feature work. Always wear one hat at a time (Fowler's Two Hats).

- **Large cross-cutting changes**: Use the Mikado Method (set goal, try, revert on failure, identify prerequisites, resolve from leaves to root) or Branch by Abstraction (introduce abstraction layer, build new implementation behind it, migrate, remove old implementation).

- **Adding to untested code**: Use Sprout Method/Class (Feathers): isolate new functionality in a new, testable unit rather than modifying untested code. Write characterization tests for existing behavior before making structural changes.

## Applying This Framework

When planning a refactoring:

1. Read this document to calibrate your sense of "good"
2. Identify specific violations of the principles above in the code you intend to change
3. For each violation, articulate which dimension it affects and why it matters
4. Propose a change that addresses the violation
5. Verify the change passes all four gates in the Decision Framework
6. Apply the appropriate refactoring method for the scale of change

When reviewing a refactoring:

1. Verify behavior is preserved (Gate 1)
2. Evaluate cognitive load before and after (Gate 2)
3. Evaluate structural integrity before and after (Gate 3)
4. Consider long-term sustainability (Gate 4)

## Key References

### Cognitive Science

- Miller, G.A. (1956). "The Magical Number Seven, Plus or Minus Two." Psychological Review.
- Cowan, N. (2001). Working memory capacity: ~4 chunks without rehearsal.
- Soloway, E. & Ehrlich, K. (1984). "Empirical Studies of Programming Knowledge." IEEE TSE.
- Brooks, R. (1983). "Towards a Theory of the Comprehension of Computer Programs." IJMMS.
- Wiedenbeck, S. (1986). "Beacons in Computer Program Comprehension." IJMMS.
- Mark, G. (UC Irvine). Context switch recovery: average 23 minutes 15 seconds.
- Leroy, S. "Why Is It So Hard to Do My Work?" Attention residue: 30-60 minutes.
- Int'l J. STEM Education (2023). Nested structures and cognitive load.

### Software Quality Frameworks

- ISO/IEC 25010:2023. Software product quality model.
- Lehman, M.M. (1974-1996). Laws of Software Evolution.
- Hickey, R. (2011). "Simple Made Easy." Strange Loop.
- North, D. (2022). "CUPID: For Joyful Coding."
- Gabriel, R. "Patterns of Software." Habitable code.
- Green, T.R.G. & Petre, M. (1989+). Cognitive Dimensions of Notations.
- Mariani, R. (2003). The Pit of Success.
- Beck, K. Four Rules of Simple Design.
- Metz, S. "Practical Object-Oriented Design."

### Refactoring Methods

- Fowler, M. (2018). "Refactoring: Improving the Design of Existing Code." 2nd ed.
- Feathers, M. (2004). "Working Effectively with Legacy Code."
- Kerievsky, J. (2004). "Refactoring to Patterns."
- Seemann, M. (2021). "Code That Fits in Your Head: Heuristics for Software Engineering."
- Cunningham, W. (1992). Technical Debt (original meaning).
- Mikado Method. Large-scale refactoring via dependency graphs.
- Beck, K. "Make the change easy, then make the easy change."

---

Revision Note:

- 2026-02-18: Initial version. Created based on systematic survey of 12 software quality frameworks, 10 cognitive science research areas, and 12 refactoring methodologies. Three dimensions of "good" identified: Cognitive Fit, Structural Integrity, Evolutionary Fitness. Decision Framework with 4 gates established.
- 2026-02-18: Generalized for reuse across projects. Added "How This Document Is Organized" section (3 layers + 2 cross-cutting themes). Removed project-specific anti-patterns (moved to REACT_PATTERNS.md). Replaced technology-specific terminology with generic equivalents.
