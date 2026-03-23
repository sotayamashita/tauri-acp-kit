# Playbook

AI ツール（Claude Code、Codex 等）の運用ノウハウを調査し、実戦ルールとしてまとめたファイル。
対象読者は自分自身。ここの内容をもとに CLAUDE.md やツール設定に反映する。

## How to Update

1. **Open Questions** に疑問を追加する（自然に発生した形のまま記録）
2. **Investigation Log** で調査を行い、Sources / Findings / Decision を記録する
3. 結論が出たら **Rules** に行動指針として昇格させる
4. Open Questions のステータスを「解決済」に更新し、Investigation Log へリンクする

- Rules では質問の分離・統合・推敲を行い、実用的な行動指針に整える
- Open Questions では疑問を発生時のまま保持し、推敲しない

## Sections

| セクション            | 役割                                                         |
| --------------------- | ------------------------------------------------------------ |
| **Rules**             | 調査から確定した行動指針。ツールごと・トピックごとに整理する |
| **Investigation Log** | 日付降順の調査記録。質問 -> 調査 -> 決定で完結する           |
| **Open Questions**    | 未解決・調査中の疑問。解決後も削除せずステータスを更新する   |
| **References**        | 調査で使用したソースの一覧。調査方法も併記する               |

---

## Rules

調査から確定した行動指針。この内容をもとに CLAUDE.md やツール設定に反映する。

### Claude Code

#### Context Management

- **タスク間では `/clear` を使う**: 無関係なタスクに切り替えるとき、コミット後に別の機能・バグ修正に移るとき、同じ問題で2回以上修正に失敗したときは `/clear` でリセットする
  - 理由: 失敗コンテキストや無関連コンテキストが汚染源になり、エージェントの精度が低下する
  - 反映先: 手動運用
  - -> [[Investigation Log > 2026-02-11: Claude Code の会話コンパクト戦略]]

- **同一タスク継続時は `/compact` を使う**: 同じ機能の実装が長引いているとき、保持したい情報があるときに使用する。フォーカス指示を付けると効果的（例: `/compact Focus on API changes and test results`）
  - 理由: `/compact` は会話を要約して保持するため、関連コンテキストを維持しながらトークンを節約できる
  - 反映先: 手動運用
  - -> [[Investigation Log > 2026-02-11: Claude Code の会話コンパクト戦略]]

- **コンテキスト使用率 70% で手動 `/compact` する**: 自動コンパクト（95%）を待たず、70% 時点で手動実行する
  - 理由: 自動コンパクトに頼ると重要なコンテキストを失い制御不能になるリスクがある
  - 反映先: 手動運用 / CLAUDE.md（statusline でコンテキスト使用率を表示済み）
  - -> [[Investigation Log > 2026-02-11: Claude Code の会話コンパクト戦略]]

- **迷ったら `/clear` が安全**: `/compact` か `/clear` か判断がつかない場合は `/clear` を選ぶ
  - 理由: 不要なコンテキストの蓄積は品質低下のリスクが高い。永続的なルールは CLAUDE.md に記述すれば `/clear` しても失われない
  - 反映先: 手動運用
  - -> [[Investigation Log > 2026-02-11: Claude Code の会話コンパクト戦略]]

- **コンテキストコスト削減の優先順位**: (1) タスク間で `/clear` → (2) MCP サーバーのオーバーヘッド削減 → (3) CLAUDE.md を短く保つ（500行以下目安） → (4) 複雑なタスク用にサブエージェントを使用
  - 理由: 効果の大きい順に対策することで最大のコスト削減が得られる
  - 反映先: CLAUDE.md / 手動運用
  - -> [[Investigation Log > 2026-02-11: Claude Code の会話コンパクト戦略]]

## Investigation Log

日付降順（新しいものが上）。各エントリは質問 -> 調査 -> 決定で完結する。

### 2026-02-11: Claude Code の会話コンパクト戦略

#### Question

-> [[Q: どこで会話をコンパクトするべきか]]

#### Sources

- [Claude Code - Best Practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code - How it Works](https://code.claude.com/docs/en/how-claude-code-works)
- [Claude Code - Managing Costs](https://code.claude.com/docs/en/costs)
- [Claude Code - CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Compaction - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/compaction)
- [Steve Kinney - Claude Code Compaction](https://stevekinney.com/courses/ai-development/claude-code-compaction)
- [MCPcat - Managing Claude Code Context](https://mcpcat.io/guides/managing-claude-code-context/)
- [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)
- [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)

#### Findings

`/compact` と `/clear` の違い:

| 項目         | `/compact`                               | `/clear`                               |
| ------------ | ---------------------------------------- | -------------------------------------- |
| 動作         | 会話を要約し、その要約で新セッション開始 | 会話履歴を完全削除して新セッション開始 |
| コンテキスト | 要約として保持される                     | 完全に失われる                         |
| 用途         | 同じタスク内での継続作業                 | 無関連タスクへの切り替え               |
| トークン節約 | 中程度（要約分が残る）                   | 最大（完全リセット）                   |

自動コンパクト:

- コンテキストウィンドウが約 95%（残り 25%）に達すると自動発動
- プロセス: (1) 古いツール出力をクリア -> (2) 会話を要約 -> (3) リクエストと重要コード片を保持
- 自動コンパクトに頼ると「エージェントが重要なコンテキストを失い、制御不能になる」リスクがある

コミュニティで実践されているパターン:

1. **コミット駆動リセット**: タスク完了 -> コミット -> `/clear` -> 次のタスク
2. **70% ルール**: コンテキスト使用率 70% で手動 `/compact` 実行
3. **サブタスク 50% 以内**: サブタスクはコンテキストの 50% 以内で完了できるサイズに分割
4. **`/rename` -> `/clear` -> `--resume`**: セッションに名前をつけてからクリアし、必要なら後で再開
5. **サブエージェントでコンテキストを守る**: 調査やファイル探索はサブエージェントに委譲

#### Decision

- タスクの関連性で `/compact` と `/clear` を使い分ける（関連あり -> `/compact`、関連なし -> `/clear`）
- 70% で手動コンパクト、自動コンパクトには頼らない
- 迷ったら `/clear` が安全
- 永続的なルールは CLAUDE.md に記述してコンパクト時の喪失を防ぐ
- -> Promoted to: [[Rules > Claude Code > Context Management]]

## Open Questions

### Q: Claude Code で会話コンテキストをいつリセットすべきか

- **Status**: 解決済
- **Created**: 2026-02-11
- **Answer**: -> [[Investigation Log > 2026-02-11: Claude Code の会話コンパクト戦略]]

### Q: Claude Code で会話コンテキストをどうリセットすべきか

- **Status**: 解決済
- **Created**: 2026-02-11
- **Answer**: -> [[Investigation Log > 2026-02-11: Claude Code の会話コンパクト戦略]]

### Q: なぜコミュニティでは 70% 時点で "/compact" を使用するのか

- **Status**: 未調査
- **Created**: 2026-02-11
- **Answer**:

### Q: なぜサブタスクはコンテキストの 50% 以内で完了できるサイズに分割なのか

- **Status**: 未調査
- **Created**: 2026-02-11
- **Answer**:

## References

- [Claude Code - Best Practices](https://code.claude.com/docs/en/best-practices) — 公式ドキュメント / 直接参照
- [Claude Code - How it Works](https://code.claude.com/docs/en/how-claude-code-works) — 公式ドキュメント / 直接参照
- [Claude Code - Managing Costs](https://code.claude.com/docs/en/costs) — 公式ドキュメント / 直接参照
- [Claude Code - CLI Reference](https://code.claude.com/docs/en/cli-reference) — 公式ドキュメント / 直接参照
- [Compaction - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/compaction) — 公式ドキュメント / 直接参照
- [Steve Kinney - Claude Code Compaction](https://stevekinney.com/courses/ai-development/claude-code-compaction) — コンパクト戦略の解説 / ウェブ検索
- [MCPcat - Managing Claude Code Context](https://mcpcat.io/guides/managing-claude-code-context/) — コンテキスト管理ガイド / ウェブ検索
- [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) — ベストプラクティス集 / DevinMCP 経由
- [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) — 包括的ガイド / DevinMCP 経由
