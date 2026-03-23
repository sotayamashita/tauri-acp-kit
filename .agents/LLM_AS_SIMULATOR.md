# LLM as Simulator: Why Framing Matters for Agent Design

## Core Thesis

> "Don't think of LLMs as entities but as simulators."
> — Andrej Karpathy

An LLM has no identity, no opinions, no expertise. It is a next-token predictor: given context, it outputs a probability distribution over possible next tokens. Every appearance of "judgment," "expertise," or "perspective" is the result of how that distribution is shaped by the input context.

When you write `"You are a senior engineer"`, the LLM does not become a senior engineer. It adopts a personality embedding vector implied by the statistics of its finetuning data and simulates that. The simulation may produce useful output, but the mechanism is impersonal — it is pattern completion conditioned on context, nothing more.

This distinction is not philosophical. It has measurable consequences for how agents should be designed.

## Why Entity Framing Fails

Entity framing treats the LLM as if it _is_ something: "You are an expert," "You are a security specialist," "You are a senior code reviewer." Research consistently shows this approach is ineffective or harmful.

### Persona names do not improve performance

- **Zheng et al. (EMNLP 2024 Findings)**: Tested 162 personas across 4 LLM families on 2,410 factual questions. Persona prompts did not consistently improve performance over no-persona baselines. The average effect was slightly _negative_.
- **Mollick et al. (Wharton GAIL, 2025)**: Evaluated 6 models on GPQA and MMLU-Pro. Expert personas — including domain-matched ones (e.g., "physicist" for physics questions) — showed no statistically reliable improvement. 9 statistically significant _negative_ effects were observed.
- **Pornprasit & Tantithamthavorn (IST, 2024)**: In code review automation, adding a persona ("pretend you're an expert software developer") reduced Exact Match by 1–54%. Persona-free prompts with fine-tuning or few-shot examples consistently outperformed persona-based prompts.
- **CoReEval (2025)**: Directly compared Junior vs. Senior personas for code readability evaluation. Average scores: 3.75 vs. 3.77. No meaningful difference.

### The mechanistic explanation

Kirsanov et al. (NAACL 2025 Findings, "The Geometry of Prompting") analyzed how different prompt types affect internal representations:

| Prompt type                | Affected layers                                | Depth of distribution shift                  |
| -------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Persona / instruction text | Primarily final layers (output packaging)      | Shallow — changes readout alignment only     |
| Few-shot examples (ICL)    | Intermediate layers fundamentally restructured | Deep — alters representation geometry itself |

Persona names operate at the shallowest level of influence. They nudge the output packaging without restructuring how the model processes the input. This is why they produce weak, unreliable effects.

### The personality embedding vector problem

When forced via "you," the LLM adopts a generic personality vector derived from finetuning statistics. This vector:

- Is not tailored to the specific task
- Mixes in irrelevant traits associated with the persona label in training data
- Can introduce noise: Hu et al. (2024) found that irrelevant persona details (name, preferences) caused up to 30 percentage point performance degradation
- Competes with task-relevant information for attention weight

## Why Simulator Framing Works

Simulator framing does not ask the LLM to _be_ something. It asks: "Given this context, what would this process produce?"

### What actually shifts the distribution

Research identifies three effective mechanisms, ordered by depth of effect:

**1. Few-shot examples (deepest effect)**

Kirsanov et al. (2025) showed that demonstrations restructure intermediate-layer representations — the layers where actual "reasoning" patterns are computed. Agarwal et al. (NeurIPS 2024 Spotlight) demonstrated that with sufficient examples, ICL can override pretraining biases entirely.

**2. Explicit criteria specification (moderate effect)**

IFScale (Jaroslawicz et al., 2025) confirmed that instructions constrain the output distribution effectively, though adherence degrades linearly with instruction count for Claude-family models. The key finding: under load, the model omits later instructions rather than applying them incorrectly. Primacy bias is universal.

**3. Knowledge context injection (moderate effect)**

Ericsson (2025) found that injecting repository structure and design documents into code review prompts was far more effective than persona assignment. The injected knowledge directly changes the conditional distribution: `P(output | criteria + domain_knowledge)` is a fundamentally different distribution from `P(output | persona_name)`.

### Simulator framing naturally leverages all three

```
Entity:    "You are a domain expert. Review this code."
             → Activates a generic personality vector. Shallow, noisy.

Executor:  "Evaluate whether names match domain vocabulary."
             → Constrains output. Works, but assumes LLM is an executor.

Simulator: "Given this domain glossary: [glossary]
            and this code change: [diff],
            what naming inconsistencies would a domain-focused
            review identify?"
             → Injects knowledge as simulation context.
             → Specifies criteria as the simulation's focus.
             → Output naturally takes the form of simulation results.
```

The simulator framing:

- **Does not declare identity** — no "you are"
- **Does not command execution** — no "evaluate this"
- **Sets up a simulation context** — knowledge + criteria + scope
- **Asks what the simulation would produce** — findings, not compliance

## Three Framings Compared

| Aspect                       | Entity (Persona)                      | Executor (Job)               | Simulator                     |
| ---------------------------- | ------------------------------------- | ---------------------------- | ----------------------------- |
| Core prompt                  | "You are X"                           | "Do X"                       | "What would X find?"          |
| Distribution shift mechanism | Personality vector (shallow)          | Output constraint (moderate) | Context conditioning (deep)   |
| Knowledge injection          | Implicit ("your expertise")           | Explicit (input parameter)   | Natural (simulation context)  |
| Output framing               | "My assessment is..."                 | "Result: ..."                | "The review would find..."    |
| Empirical support            | Negative (Zheng, Mollick, Pornprasit) | Positive (IFScale, Ericsson) | Strongest (Kirsanov, Agarwal) |
| Honest about LLM nature      | No — pretends identity exists         | Partial — treats as function | Yes — treats as simulator     |

## Implications for Multi-Agent Design

If a single LLM is a simulator, then a multi-agent system is **a set of non-interfering simulations**.

### When to use multiple simulations

Two simulations should run in separate agents when running them simultaneously in a single simulator would cause interference. Four tests determine this:

**Test 0 — Generation-verification independence**

> Can the same simulation that generated an output reliably verify it?

No. Huang et al. (ICLR 2024) proved that intrinsic self-correction degrades reasoning performance. Tyen et al. (ACL 2024) showed LLMs cannot _find_ reasoning errors but can _correct_ them when given the error location. Li et al. (2025) quantified the gap: Claude's error detection rate is 10.1% but correction rate is 29.1%.

The same conditional distribution that produced an error cannot detect it. Verification requires a different simulation context — a different agent.

**Test 1 — Context interference**

> Does the knowledge required for simulation A dilute simulation B's effectiveness when co-located?

Knowledge dilution (NeurIPS 2025 Workshop) demonstrated that domain-specific performance degrades up to 47% when exposed to contextually related but domain-irrelevant information. If two simulations require different knowledge bases (e.g., domain glossary vs. API contracts), mixing them in one context risks diluting both.

**Test 2 — Distribution compatibility**

> Do the simulations' evaluation criteria shift the output distribution in compatible directions?

Kirsanov et al. (2025) showed that tasks sharing the same input distribution can be synergistic, while tasks requiring conflicting distribution shifts interfere. Example: "Is this name domain-appropriate?" and "Is this temporal ordering architecturally sound?" require different vocabularies, different abstraction levels, and different evaluation frameworks — they are distribution-incompatible.

**Test 3 — Attention budget**

> Does the combined criteria count exceed the adherence threshold?

IFScale (2025) established that Claude-family models exhibit linear adherence decay with instruction count. Attention sink research (ICLR 2024, 2025) showed this is a structural constraint of softmax normalization, not a prompt engineering problem. Practical limit: ≤ 7 simultaneous evaluation criteria per agent.

### Agent definition template (simulator framing)

```
Simulation:  What evaluation process to simulate
Context:     What knowledge conditions the simulation
Focus:       Specific criteria (≤ 7) — the simulation's lens
Input:       What is being evaluated
Output:      Structured simulation results
Depends:     Which other simulations' results are needed as input
```

Example:

```
Simulation:  Domain naming consistency review
Context:     Domain glossary, concept boundary definitions
Focus:
  1. Does each name match a glossary term?
  2. Is each name's abstraction level appropriate for its module?
  3. Are concept boundaries respected (no entanglement)?
Input:       git diff of changed files
Output:      Finding[] { location, evidence, judgment }
Depends:     None (independent simulation)
```

### The leader as meta-simulator

Karpathy's suggestion — "What would be a good group of people to explore xyz?" — maps to the team leader's role:

1. **Analyze the change** — what kind of modification is this?
2. **Determine useful simulations** — "What evaluation perspectives would be valuable for this change?"
3. **Spawn simulation agents** — activate only the simulations whose scope is relevant (adaptive activation)
4. **Run integration simulation** — "Given these simulation results, what contradictions or false positives exist? What is the synthesized assessment?"

The leader performs a meta-simulation: it simulates the process of determining which simulations to run, then validates and integrates their outputs.

## Connection to Probability Theory

All of the above reduces to a single principle: **an LLM agent is a configured conditional probability distribution**.

```
P(output | simulation_context, criteria, knowledge, input)
```

- **Persona framing** sets `simulation_context` to a vague personality vector — low information, high noise
- **Job framing** constrains `criteria` explicitly — moderate information, moderate noise
- **Simulator framing** maximizes information in all conditioning variables — knowledge is injected directly, criteria are specific, and the output is framed as simulation results rather than personal judgment

Multi-agent design is the problem of partitioning the space of conditioning variables into non-interfering subsets. Each subset becomes one agent's simulation context.

## Empirical References

### Persona ineffectiveness

- Zheng, M. et al. (2024). "When 'A Helpful Assistant' Is Not Really Helpful: Personas in System Prompts Do Not Improve Performances of Large Language Models." EMNLP 2024 Findings. arXiv:2311.10054v3.
- Basil, S., Mollick, E.R. et al. (2025). "Playing Pretend: Expert Personas Don't Improve Factual Accuracy." Wharton GAIL / SSRN:5879722.
- Kim et al. (2024). "Persona is a Double-Edged Sword." arXiv:2408.08631.
- Pornprasit, C. & Tantithamthavorn, C. (2024). "Fine-Tuning and Prompt Engineering for Large Language Models-based Code Review Automation." Information and Software Technology. arXiv:2402.00905.
- CoReEval (2025). "Human-Aligned Code Readability Assessment with Large Language Models." arXiv:2510.16579.
- Hu et al. (2024). "Two Tales of Persona in LLMs." EMNLP 2024 Findings.

### Distribution shift mechanics

- Kirsanov et al. (2025). "The Geometry of Prompting." NAACL 2025 Findings. arXiv:2502.08009.
- Agarwal et al. (2024). "Many-Shot In-Context Learning." NeurIPS 2024 Spotlight. arXiv:2404.11018.
- Jaroslawicz, D. et al. (2025). "How Many Instructions Can LLMs Follow at Once?" (IFScale). arXiv:2507.11538.

### Attention mechanisms

- Xiao et al. (2024). "Efficient Streaming Language Models with Attention Sinks." ICLR 2024.
- Gu et al. (2025). "When Attention Sink Emerges in Language Models." ICLR 2025. arXiv:2410.10781.
- Liu, N. et al. (2024). "Lost in the Middle: How Language Models Use Long Contexts." TACL.
- Hsieh et al. (2024). "Found in the Middle: Calibrating Positional Attention Bias Improves Long Context Utilization." arXiv:2406.16008.

### Self-correction failure

- Huang, J. et al. (2024). "Large Language Models Cannot Self-Correct Reasoning Yet." ICLR 2024.
- Tyen et al. (2024). "LLMs cannot find reasoning errors, but can correct them given the error location." ACL 2024 Findings.
- Li et al. (2025). "Decomposing LLM Self-Correction: The Accuracy-Correction Paradox and Error Depth Hypothesis." arXiv:2601.00828.

### Multi-agent systems

- Kim, D. et al. (2025). "Towards a Science of Scaling Agent Systems." Google Research & MIT. arXiv:2512.08296.
- Cemri et al. (2025). "Why Do Multi-Agent LLM Systems Fail?" NeurIPS 2025 Spotlight. arXiv:2503.13657.
- Sinha et al. (2025). "The Illusion of Diminishing Returns." NeurIPS 2025 Workshop. arXiv:2509.09677.

### Knowledge and context

- Knowledge Dilution (2025). NeurIPS 2025 Workshop. arXiv:2505.12501.
- Ericsson (2025). "Automated Code Review Using Large Language Models at Ericsson." arXiv:2507.19115.
- Role Vectors (2025). arXiv:2502.12055.
- SRPS (2025). "Improving LLM Reasoning through Role-Playing Steering." EMNLP 2025 Findings. arXiv:2506.07335.
