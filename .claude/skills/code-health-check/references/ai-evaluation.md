# AI Evaluation Criteria

Aspects of code quality that cannot be measured by metrics and require AI judgment. Each criterion is expressed as a specific question to ask about the code.

These criteria operationalize the AI_CODE_REVIEW.md constraints: scope to one dimension at a time, use perspective-shifting for overcomplication detection, report with CODE_QUALITY.md vocabulary.

## Dimension 1: Cognitive Fit

### Beacon-rich

Ask: "Can a reader form a correct hypothesis about what this code does from its names and structure alone, without reading the implementation details?"

Look for:

- Function names that describe intent, not mechanism (`calculateTotal` vs `processData`)
- Variable names that reveal purpose (`remainingAttempts` vs `n`)
- Structural patterns that signal purpose (event handler registration, factory pattern, guard clauses)

Report as: "Beacon quality: [strong/weak]. [Specific observation with example.]"

### Conventional

Ask: "Would an experienced developer in this ecosystem predict this code's structure? Does it enable cognitive chunking?"

Look for:

- Idiomatic patterns for the language and framework (e.g., React hook conventions, TypeScript discriminated unions)
- Surprising or "clever" deviations from standard patterns
- Consistency with patterns established elsewhere in the codebase

Report as: "Convention adherence: [high/low]. [Specific observation with example.]"

### Locally comprehensible

Ask: "Can this code be understood without opening other files?"

Look for:

- References to distant definitions that require navigation to understand
- Implicit dependencies on global state or context not visible in the file
- Magic values whose meaning requires looking up definitions elsewhere

Report as: "Local comprehensibility: [high/low]. [Specific observation with example.]"

## Dimension 2: Structural Integrity

### Single responsibility

Ask: "How many distinct reasons could this unit change? If requirement X changes, does only this unit need to change?"

Look for:

- Mixed concerns (UI rendering + data fetching + business logic in one component)
- Functions that do multiple unrelated things sequentially
- Modules where changes to one feature require modifying another feature's code

Report as: "Responsibilities: [count]. [List each distinct responsibility.]"

### Low viscosity

Ask: "Is the 'right' change easier to make than the 'wrong' change? Where would a new developer add the next feature?"

Look for:

- Clear extension points vs. needing to modify existing switch statements or if-else chains
- Whether adding a new variant requires touching many files
- Whether the path of least resistance leads to good structure or to degradation

Report as: "Viscosity: [low/high]. [Description of what the next change would require.]"

### Simple vs Easy

Ask: "Are concepts entangled or independent? Could you change one concern without understanding another?"

Look for:

- State that serves multiple purposes
- Functions where understanding one part requires understanding all parts
- Modules where removing one feature would break unrelated features

Report as: "Entanglement: [low/high]. [Specific concepts that are entangled.]"

## Dimension 3: Evolutionary Fitness

### Habitable

Ask: "Could a new contributor find where to make a change within minutes? Are file locations and patterns predictable?"

Look for:

- Consistent file organization (features grouped together, clear naming conventions)
- Surprising file locations or naming
- Whether similar features are structured similarly

Report as: "Habitability: [high/low]. [What would confuse a new contributor.]"

### Entropy-resistant

Ask: "Is there an obvious, correct place to add the next feature? Does the structure actively resist degradation?"

Look for:

- Clear boundaries between modules
- Whether adding a feature requires creating new patterns vs. following existing ones
- Presence of "junk drawer" modules that accumulate unrelated code

Report as: "Entropy resistance: [high/low]. [Where degradation is likely to occur.]"

### Testable

Ask: "Can this unit be tested without elaborate setup or mocking half the application?"

Look for:

- Dependencies that must be mocked (the fewer, the better)
- Setup required before the unit can be exercised
- Whether the unit's behavior can be verified through its return value or observable effects

Report as: "Testability: [high/low]. [What makes testing easy or difficult.]"

## Overcomplication Detection

This is a cross-cutting concern. Apply after evaluating the selected dimension.

Use perspective-shifting: "Would a senior engineer look at this code and say it is overcomplicated?"

Signs of overcomplication:

- Abstractions for things that are only used once
- Error handling for scenarios that cannot occur in this context
- Configuration or extensibility that no one requested
- Indirection layers that add complexity without reducing coupling
- Generic solutions for specific problems

Report as: "Overcomplication: [none detected / detected]. [Specific instance and what a simpler alternative would look like.]"
