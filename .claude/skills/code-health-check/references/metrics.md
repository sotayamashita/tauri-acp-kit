# Measurable Metrics Catalog

Metrics organized by dimension. Each metric includes what to measure, thresholds, and how to obtain the measurement.

Metrics are deviation detectors, not definitions of "good." A passing metric does not guarantee quality; a failing metric reliably signals a problem worth investigating.

## Dimension 1: Cognitive Fit

### Parameter count per function/component

- **What**: Number of parameters (including destructured props for components)
- **Threshold**: >7 is a warning (Cowan's 4±1 plus margin). >10 is critical.
- **How**: Count function parameters. For React components, count top-level props.
- **Why**: Each parameter competes for working memory slots.

### Nesting depth

- **What**: Maximum level of nested control structures (if/for/while/switch/try, plus callback nesting)
- **Threshold**: >3 levels is a warning.
- **How**: Count nested blocks. Each level of indentation from a control structure counts as one level.
- **Why**: Nested structures impose multiplicative cognitive cost — three demands simultaneously: encoding inner levels, maintaining outer levels, selective updating.

### Cognitive complexity

- **What**: SonarQube's Cognitive Complexity metric (2017). Increments for breaks in linear flow, with additional increments for nesting.
- **Threshold**: >15 per function is a warning. >25 is critical.
- **How**: Count breaks in linear flow (if, else, for, while, catch, switch, logical operators in conditions, recursion). Add a nesting increment for each level of nesting at the point of the break.
- **Why**: Better proxy for CODE_QUALITY.md's Dimension 1 than Cyclomatic Complexity because it penalizes nesting depth, which research shows is disproportionately expensive cognitively.

### Function/file length

- **What**: Lines of code per function and per file
- **Threshold**: Function >50 lines is a warning. File >300 lines is a warning.
- **How**: Count non-blank, non-comment lines.
- **Why**: Proxy for working memory overflow. Long functions likely contain multiple responsibilities.

## Dimension 2: Structural Integrity

### Import/dependency count per module

- **What**: Number of import statements (external dependencies)
- **Threshold**: >10 imports is a warning. >15 is critical.
- **How**: Count import statements at the top of the file.
- **Why**: Proxy for coupling. Many imports suggest the module depends on too many concepts.

### Export count per module

- **What**: Number of exported symbols (functions, types, constants)
- **Threshold**: >10 exports is a warning.
- **How**: Count exported declarations.
- **Why**: Large public surface area suggests the module has multiple responsibilities or is serving as a grab-bag.

## Dimension 3: Evolutionary Fitness

### Test coverage

- **What**: Percentage of lines/branches covered by tests
- **Threshold**: Project-dependent. Decreasing coverage trend is always a warning.
- **How**: Run `pnpm test:coverage` or equivalent project test command.
- **Why**: Imperfect proxy, but absence of tests is a reliable signal that refactoring is risky.

### Dead code

- **What**: Unused exports, types, and dependencies
- **Threshold**: Any dead code is a warning.
- **How**: Use knip or equivalent dead code detection tool.
- **Why**: Dead code adds cognitive load (reader wonders "is this used?") and entropy.

### File churn rate

- **What**: Frequency of changes to a file over recent history
- **Threshold**: No absolute threshold. Files with high churn AND high complexity deserve priority attention.
- **How**: `git log --format=format: --name-only -- <path> | sort | uniq -c | sort -rn`
- **Why**: High-churn files are where quality improvements have the most impact. A complex file that never changes is lower priority than a simpler file changed weekly.
