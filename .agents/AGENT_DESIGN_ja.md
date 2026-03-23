# エージェント設計：シミュレーション仕様から実装まで

## 目的と他ドキュメントとの関係

本ドキュメントは、LLMエージェントチームを設計するための実践的なプロセスを提供する。理論と実装の橋渡しとなるものである。

```
.agents/LLM_AS_SIMULATOR.md     ← WHY: LLMはエンティティではなくシミュレータである。
                                    確率分布のメカニクス。
                                    普遍的な分離テスト。

.agents/AGENT_DESIGN.md          ← HOW: 設計プロセス。本ドキュメント。
                                    要件から .claude/agents/*.md ファイルまでの
                                    ステップバイステップ。

.agents/CODE_QUALITY.md          ← APPLIED: コード品質ドメインへの適用。
  (Simulator-based Role              3つのシミュレーション + リーダー。
   Definitions section)              アクティベーションマトリクス。V1-V8検証。

.agents/AI_CODE_REVIEW.md        ← OPERATIONAL: CODE_QUALITY.md を
                                    AIエージェントで日常的に運用する方法。
```

コアとなるテーゼをまだ内面化していなければ、まず `LLM_AS_SIMULATOR.md` を読んでほしい。LLMにはアイデンティティがない——コンテキストに条件づけられた出力を生成するシミュレータである。

## 設計プロセス

### ステップ1：評価次元の特定

エージェントチームが対処すべき評価上の関心事を列挙する。各関心事がシミュレーションの候補となる。

問うべき質問：

- このタスクにはどのような種類の判断が必要か？
- それぞれの判断にはどのような外部知識が必要か？
- それぞれの判断の出力は何か？

例（コード品質レビュー）：

```
関心事A: ドメインの命名と概念の一貫性  → ドメイン用語集が必要
関心事B: 依存関係の構造的健全性        → ADR、APIコントラクトが必要
関心事C: 将来の方向性との整合性        → プロダクトロードマップが必要
```

### ステップ2：4つの分離テストの適用

シミュレーション候補のすべてのペアに対してテストを適用する。いずれかのテストが不合格であれば、そのペアは別々のエージェントにしなければならない。

**テスト0 — 生成-検証の独立性**

一方のシミュレーションがもう一方の出力を検証する必要があるか？ もしそうなら、同一エージェントで共存させることはできない。出力を生成した同じ条件付き分布では、その出力のエラーを確実に検出できない。

_このテストはリーダーの役割も決定する：リーダーはすべての生成エージェントから分離されなければならない。_

**テスト1 — コンテキスト干渉**

2つのシミュレーションが、同じ場所に配置すると互いに希釈し合う知識コンテキストを必要とするか？ 異なる抽象レベル、異なる語彙、異なるソースドキュメントは、希釈リスクを示唆する。

診断用の問い：_両方の知識セットを1つのコンテキストに注入した場合、知識セットBの存在によって知識セットAに対するモデルのアテンションが劣化するか？_

**テスト2 — 分布の互換性**

評価基準が出力分布を互換性のある方向にシフトさせるか？ 基準が異なる評価フレームワーク、異なる抽象レベルを必要とする場合、あるいは同じアーティファクトに対して矛盾する結論を生み出す可能性がある場合、互換性がない。

診断用の問い：_同じコードに対して、基準Xでは「これは良い」、基準Yでは「これは悪い」と同時に結論づけることがあり得るか？ そして両方の結論が正しいが異なる推論フレームを必要とするか？_

**テスト3 — アテンション・バジェット**

基準の合計数が7を超えるか？ これはトランスフォーマーのアテンション・メカニクスの構造的制約であり、ガイドラインではない。Claudeファミリーのモデルは、命令数に対して線形的に遵守率が低下する。7つの同時基準を超えると、見落としエラーが増加する。

### ステップ3：依存関係チェーンの決定

シミュレーションBがシミュレーションAの出力を入力として必要とする場合、BはAに依存する。すべての依存関係をマッピングする。

ルール：

- 依存関係は非循環でなければならない（シミュレーション間の循環依存は不可）
- リーダーはすべてのシミュレーションに依存する（それらの出力を検証するため）
- 依存関係はClaude Code Agent Teamsのタスク定義における `blockedBy` に直接対応する

### ステップ4：アクティベーション戦略の設計

すべての変更にすべてのシミュレーションが必要なわけではない。入力の特性に基づいて、各シミュレーションがいつ必要になるかを定義する。

2つのアプローチ：

**静的アクティベーション・マトリクス** — 入力タイプを必要なシミュレーションにマッピングする。決定論的。アクティベーション判断にリーダーの判断は不要。

```
入力タイプA → シミュレーション1のみ
入力タイプB → シミュレーション1 + 2
入力タイプC → 全シミュレーション
```

**適応的アクティベーション** — リーダーが入力を分析し、どのシミュレーションが必要かを判断する。静的マトリクスが上限制約として機能する。

```
リーダーが入力を分析 → 必要なシミュレーションを決定
                     → それらのエージェントのみを起動
                     → マトリクスの上限を決して超えない
```

適応的アクティベーションは単純な入力に対するコストを削減するが、リーダーの判断が潜在的なエラー源となる。入力の分類が明確な場合は静的アクティベーションを使用し、入力タイプが大きく変動する場合は適応的アクティベーションを使用する。

### ステップ5：シミュレーション仕様の記述

各シミュレーション仕様は以下のテンプレートに従う：

```
Simulation:  どのような評価プロセスをシミュレートするか（命令ではなく疑問として）
Context:     シミュレーションを条件づける知識
Focus:       具体的な基準（7以下）— シミュレーションのレンズ
L0 elements: このシミュレーションがカバーする還元不能な判断要素（該当する場合）
Scope:       シミュレーションが動作する粒度
Depends:     入力として必要な他のシミュレーションの結果
Output:      シミュレーション結果の構造化フォーマット
```

記述ガイドライン：

- **Simulation** は「[コンテキスト]が与えられた場合、[評価プロセス]は[入力]において何を発見するか？」という形式で記述する——「あなたはXです」や「Xを評価せよ」ではない
- **Focus** の基準は具体的でテスト可能な質問であるべきで、曖昧な指示ではない
- **Output** は型付き構造であるべきで、自由形式の散文ではない（MetaGPTの知見：構造化アーティファクトは実行可能性で3.9/4.0を達成、対話ベースは2.1/4.0）

### ステップ6：リーダー仕様の記述

リーダーには3つのフェーズがある：

```
フェーズ1 — アクティベーション判断：
  入力を分析する。どのシミュレーションが必要かを判断する。
  アクティベーション・マトリクスまたは適応的戦略を適用する。

フェーズ2 — 検証（生成-検証の分離）：
  シミュレーション出力を以下の観点でクロスチェックする：
  - シミュレーション間の矛盾
  - 偽陽性（精査すると成立しない発見）
  - カバレッジの欠落（どのシミュレーションも対処しなかった入力の側面）

フェーズ3 — 統合：
  検証済みの発見をアクション可能な出力に統合する。
```

### ステップ7：分離基準に対する検証

完成した設計を以下の基準に照らして確認する：

| #   | 基準                     | 確認内容                                                           |
| --- | ------------------------ | ------------------------------------------------------------------ |
| V1  | 矛盾する判断がないこと   | 各エージェントの基準が単一の一貫した評価フレームに属している       |
| V2  | 責任の重複がないこと     | 各評価関心事が正確に1つのエージェントに対応している                |
| V3  | 基準数が制限内であること | 各エージェントの基準が7以下である                                  |
| V4  | 生成-検証の分離          | どのエージェントも自身の出力を検証しない                           |
| V5  | 依存関係チェーンの遵守   | 上流の出力が下流の開始前に利用可能である                           |
| V6  | スコープの完全性         | すべての入力タイプに少なくとも1つの担当エージェントがある          |
| V7  | 適応的アクティベーション | 単純な入力は複雑な入力よりも少ないエージェントをアクティベートする |
| V8  | 構造化コミュニケーション | すべてのエージェント間通信が型付きフォーマットを使用している       |

いずれかの基準が不合格であれば、実装前に設計を修正する。

## 実装：Claude Code Agent Teams

### エージェント定義ファイル

各シミュレーションは `.claude/agents/*.md` ファイルになる：

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

実装上の重要な詳細：

- **`tools: Read, Glob, Grep`** — シミュレーションエージェントは読み取り専用である。分析はするが、コードを変更しない。これにより、ツールレベルで生成-検証の分離が強制される。
- **`model: sonnet`** — シミュレーションエージェントにはコスト効率の良いモデルを使用する。リーダー（メインセッションで実行される）はセッションのデフォルトモデルを使用する。
- **明示的なスコープ境界** — 最後の段落（「Do not evaluate...」）はスコープの拡大を防ぐ。これがなければ、エージェントの分布は評価可能なすべてを評価する方向にドリフトする。

### タスク依存関係による協調

リーダーは `blockedBy` を使ってタスクを作成し、依存関係チェーンを強制する：

```
Task 1: "Domain review of PR #42"          → owner: domain-review
Task 2: "Structure review of PR #42"       → owner: structure-review, blockedBy: [1]
Task 3: "Evolution review of PR #42"       → owner: evolution-review, blockedBy: [1, 2]
Task 4: "Validate and synthesize findings" → owner: leader, blockedBy: [1, 2, 3]
```

独立したシミュレーション（依存関係チェーンなし）の場合は、`blockedBy` を省略して並列実行を可能にする。

### 品質ゲートのためのフック

2つのAgent Teamsフックが、設計上の制約を実行時に強制する：

**TaskCompleted フック** — 受け入れ前に出力構造を検証する：

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

**TeammateIdle フック** — シミュレーションがスコープを完遂したことを確認する：

```bash
#!/bin/bash
# .claude/hooks/check-simulation-complete.sh
INPUT=$(cat)
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name')

# Custom validation per simulation type
exit 0
```

### 知識注入戦略

各シミュレーションには固有の外部知識が必要である。3つの注入方法：

| 方法                               | 使用するタイミング                                    | トレードオフ                     |
| ---------------------------------- | ----------------------------------------------------- | -------------------------------- |
| **エージェントファイルに静的記述** | 知識が安定しており小さい場合（2Kトークン未満）        | 単純だが柔軟性に欠ける           |
| **リーダーがタスク作成時に注入**   | 知識がタスクごとに異なる、または大きい場合            | 柔軟だがリーダーの判断に依存する |
| **MCPサーバー / スキル**           | 知識が外部システム（Wiki、ADR、用語集）に存在する場合 | スケーラブルだがインフラが必要   |

配置ルール（アテンション研究に基づく）：知識はエージェントのコンテキストの**冒頭**、基準の前に注入する。中間に配置された情報は十分に活用されない（Lost in the Middle, Liu et al. TACL 2024）。

## 設計アンチパターン

### アンチパターン1：エンティティ・エージェント

```
❌ "You are a senior domain expert with 20 years of experience..."
```

ペルソナ名はパフォーマンスを向上させず、コードレビュータスクでは1〜54%低下させる可能性がある。代わりにシミュレーション・フレーミングを使用する。

### アンチパターン2：何でも入りエージェント

```
❌ ドメイン、構造、進化をカバーする15の基準を持つ1つのエージェント
```

アテンション・バジェットを超過する。位置7以降の基準は暗黙的に見落とされる（IFScale：不正確な適用ではなく見落としエラー）。

### アンチパターン3：対称エージェント

```
❌ 微妙に異なる角度から「コード品質」をレビューする3つのエージェント
```

V2（責任の重複なし）に違反する。2つのエージェントが同じ問題について発見を生成できる場合、実際に生成してしまい、矛盾と無駄な作業が生じる。

### アンチパターン4：自己検証エージェント

```
❌ エージェントが発見を生成した後、自己レビューする："Let me check if these are correct..."
```

同じ分布では自身のエラーを検出できない。エラー検出率：10.1%。検証は別のエージェント（リーダー）に移す。

### アンチパターン5：常時アクティベーション

```
❌ 変更のタイプに関係なく、すべてのコミットですべてのシミュレーションエージェントが起動する
```

V7（適応的アクティベーション）に違反する。単純な変更をすべてのエージェントが処理すると、「問題なし」レポート（コストの浪費）や偽陽性（ノイズ）が生じる。アクティベーション・マトリクスを使用する。

## 実例：コード品質レビューチーム

コード品質レビューチーム（`CODE_QUALITY.md` の Simulator-based Role Definitions セクションで定義）は、このプロセスを使用して設計された：

| ステップ                  | 結果                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------- |
| 1. 次元の特定             | 3つの関心事：ドメインの命名、構造的健全性、進化の整合性                               |
| 2. 分離テスト             | すべてのペアが少なくとも1つのテストで不合格 → 3つの別々のエージェント + リーダー      |
| 3. 依存関係チェーン       | ドメイン → 構造 → 進化（L0依存関係チェーン：DK → AI → FD）                            |
| 4. アクティベーション戦略 | 静的マトリクスの上限を持つ適応的方式（Rename=1, Extract=2, Move=3, Interface/Arch=4） |
| 5. シミュレーション仕様   | 基準数がそれぞれ6/4/4の3つの仕様                                                      |
| 6. リーダー仕様           | メタシミュレーション（アクティベーション）→ 検証 → 統合                               |
| 7. 検証                   | V1-V8すべて合格                                                                       |

実装ファイル：

```
.claude/agents/
├── domain-review.md       → シミュレーション1（L0要素 1, 2, 4）
├── structure-review.md    → シミュレーション2（L0要素 3）
└── evolution-review.md    → シミュレーション3（L0要素 5）
```

リーダーはメインのClaude Codeセッションで実行される——エージェントファイルは不要。

## 制限事項

AGENT_DESIGN.md は評価・レビュータスクに最適化されている。これは「複数の判断次元に分解 → 干渉しないシミュレーションとして実行 → リーダーが統合」というパターンを前提としているためである。

以下のタスクタイプには直接適用できない：

- **生成タスク**（コードの記述、システムの設計）— 目的が評価ではなく創造であるため
- **単一判断タスク** — すべての分離テストが合格し、単一エージェントで十分な場合
- **対話型タスク** — 一方向の評価ではなく、反復的な対話が必要な場合

## 参考文献

- `.agents/LLM_AS_SIMULATOR.md` — 理論的基盤（シミュレータ・フレーミング、分離テスト、確率メカニクス）
- `.agents/CODE_QUALITY.md` — ドメイン適用（コード品質シミュレーション、アクティベーション・マトリクス、V1-V8）
- `.agents/AI_CODE_REVIEW.md` — 運用ガイダンス（CODE_QUALITY.md をAIエージェントで使用する方法）
- Claude Code Agent Teams: https://code.claude.com/docs/en/agent-teams
- Claude Code Subagents: https://code.claude.com/docs/en/sub-agents

---

## 未解決の問題

- ペルソナを決めるためにもこれは使えるのか？

---

Revision Note:

- 2026-02-22: Initial version. Created as the practical design process document bridging LLM_AS_SIMULATOR.md (theory) and CODE_QUALITY.md (domain application). Covers 7-step design process, Claude Code Agent Teams implementation details (.claude/agents/ format, task dependencies, hooks), knowledge injection strategies, 5 design anti-patterns, and worked example of code quality review team.
- 2026-02-24: Japanese translation created as AGENT_DESIGN_ja.md.
