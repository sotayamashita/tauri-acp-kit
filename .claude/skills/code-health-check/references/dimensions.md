# The Three Dimensions of Code Quality

Distilled from CODE_QUALITY.md for evaluation use. Each dimension is independent — improving one without considering the others can make code worse overall.

## Dimension 1: Cognitive Fit

Can the reader hold it in their head?

**Fits in working memory**: The number of concepts tracked simultaneously stays within human limits (~4-7 items). Applies to: function parameters, state variables, component responsibilities, nesting depth.

**Locally comprehensible**: Understanding the code does not require reading other files. Information needed is either present or obvious from naming.

**Conventional**: Code follows patterns recognizable to someone experienced in the project's language and framework. Enables cognitive chunking. Violating conventions neutralizes expertise advantages.

**Beacon-rich**: Names, patterns, and structure immediately signal intent. The reader forms a correct hypothesis before reading implementation details.

Cognitive science basis: Working memory ~4 chunks (Cowan, 2001). Nested structures impose multiplicative cognitive cost. Context switches take ~23 minutes to recover from (Mark, UC Irvine).

## Dimension 2: Structural Integrity

Does the structure support change?

**Single responsibility**: Each unit has one reason to change. Display logic changes should not affect data handling.

**Low coupling**: Units depend on minimal, well-defined interfaces. Changes do not ripple to unrelated units. Data drilling across layers is a coupling smell.

**High cohesion**: Everything within a unit relates to the same concept. A module managing both presentation and data fetching has low cohesion.

**Low viscosity**: The "right" change is easier than the "wrong" change. Code structure makes it natural to add features in the correct place.

**Simple, not Easy**: Concepts are not entangled (simple) rather than conveniently co-located (easy). Simple produces sustained long-term progress; easy produces decelerating progress.

## Dimension 3: Evolutionary Fitness

Can the code sustain development over time?

**Testable**: Every unit can be tested in isolation without elaborate setup. If testing requires mocking the entire application, the unit is too coupled.

**Habitable**: Predictable file locations, consistent patterns, no traps. A new contributor can find where to make a change quickly.

**Entropy-resistant**: New features have an obvious, correct place to go. The "Pit of Success" principle: doing the right thing is the easiest path.

**Incrementally improvable**: The Boy Scout Rule can be applied without risk. Small improvements are safe during normal development.

## Four Decision Gates

When evaluating whether a change improves code, apply in order:

1. **Gate 1 — Behavior preservation**: Does it preserve observable behavior? If not, stop. Write characterization tests first.
2. **Gate 2 — Cognitive load reduction**: Can a developer understand the modified code with less mental effort? Fewer items to track, shallower nesting, better names, less file navigation?
3. **Gate 3 — Structural integrity**: Does each unit have fewer reasons to change? Are dependencies simpler? Is the next change easier to make correctly?
4. **Gate 4 — Sustained development**: Is the code easier to test? Is there an obvious place for new features? Can a new contributor find their way?
