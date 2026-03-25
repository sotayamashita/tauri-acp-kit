# UI Review Workflow with /interface-craft

`/interface-craft` skill の Design Critique 機能を使った UI レビューの実践ガイド。

## Overview

コンポーネント単位で critique → implement → review → commit のサイクルを回し、最後に全体の横断監査を行う。

## Prerequisites

- `/interface-craft` skill がインストール済みであること
- 対象アプリのスクリーンショットがあること（全状態: 通常、ホバー、エラー、ローディング等）

## Step 1: レビュー単位の分割

UI 全体を一度にレビューすると細部を取りこぼす。コンポーネント単位に分割する。

```
例: チャット UI の場合
1. Header
2. ChatMessageList
3. ToolCallCard
4. ChatInput
5. DropdownSelect
6. ThinkingBlock / PlanView
7. Global consistency (最後に実施)
```

**分割の基準:**

- 独立した機能を持つ UI ブロック
- 独自の CSS セクションを持つ単位
- 1回の critique で 5 件前後の改善点が出る粒度

## Step 2: コードの事前読み込み（重要）

critique の精度はインプットの質に依存する。**skill を実行する前に、対象コンポーネントの関連コードを全て読む。**

### 読むべきファイル

| カテゴリ           | 例                                  |
| ------------------ | ----------------------------------- |
| コンポーネント本体 | `Header.tsx`                        |
| スタイル           | `AcpChat.css` の該当セクション      |
| 使用している hooks | `useTheme.ts`, `useClickOutside.ts` |
| 使用している utils | `connectionStatus.ts`               |
| 型定義             | `types.ts`, `providers.ts`          |
| テスト             | `Header.test.tsx`                   |

### 初回の失敗から得た教訓

最初の Header critique では hooks/utils/types を読まずに実行した結果、以下を見落とした：

- アイコンサイズ不統一（14px vs 16px）— コード上でしか分からない
- `aria-live="polite"` 領域が ready 時に空になる問題 — StatusBar.tsx を読んで初めて分かる
- テーマ切替（即時）vs プロバイダー切替（非同期）のフィードバック速度ギャップ — hooks の実装を読んで初めて分かる
- PROVIDERS が固定 2 件なのにドロップダウンが冗長 — providers.ts を読んで初めて分かる

**結論: スクリーンショットだけでは不十分。コードを読むことで「見えない問題」が見つかる。**

## Step 3: critique の実行

`/interface-craft critique` を実行する際、以下の情報を渡す。

### 渡すべきコンテキスト

```
1. Target — 何のコンポーネントか、アプリの種類、ターゲットユーザー
2. Screenshots — 会話内のスクリーンショットへの参照
3. Full Code Context — Step 2 で読んだコードの構造要約
   - コンポーネントの JSX 構造
   - Props と state
   - CSS の主要なスタイル値（padding, font-size, color tokens）
   - 既存のアニメーション/トランジション
   - アクセシビリティ属性の現状
4. Key observations — 事前に気づいた懸念点
```

### コンテキストの書き方の例

```
## Full Code Context

### ComponentName.tsx
- Props: a, b, c
- 内部 state: isOpen (boolean)
- Uses useClickOutside hook for closing
- ARIA: role="listbox" with role="option" buttons

### AcpChat.css (該当セクション)
- .component: padding 8px 10px, border 1px, radius 6px
- .component-item: 12px font, text-secondary color
- No transition on open/close
```

## Step 4: 実装

critique の Top Opportunities を優先度順に実装する。

### 実装時の注意点

- **テストの更新を忘れない** — ARIA パターン変更（例: `listbox` → `menu`）はテストに波及する
- **prefers-reduced-motion** — アニメーション追加時は必ず reduced-motion フォールバックを入れる
- **条件レンダリング → 常時レンダリング** — CSS トランジションのためにメニューや FAB を常時 DOM に置く場合、既存テストの `not.toBeInTheDocument()` が壊れる。`aria-expanded` やクラス名で状態を検証するテストに書き換える
- **全テスト実行** — 変更したコンポーネント以外のテストも壊れることがある（特に統合テスト）

### 実装しないもの

critique の全指摘を実装する必要はない。以下は意識的にスキップしてよい：

- スコープ外の変更（例: ChatInput critique で DropdownSelect の ARIA 修正が出ても、DropdownSelect の回に委ねる）
- Over-engineering のリスクがあるもの（例: リセットボタンの undo トースト）
- 別コンポーネントとの横断的な問題（Global consistency の回に委ねる）

## Step 5: レビューと commit

実装後、以下を確認してからレビューに出す：

```bash
pnpm test:run    # 全テスト通過
pnpm typecheck   # 型エラーなし
pnpm lint        # warning なし
```

## Step 6: Global consistency (最後に実施)

コンポーネント単位の critique では見つからない横断的な問題を監査する。

### 監査項目

| 項目                   | チェック内容                                                              |
| ---------------------- | ------------------------------------------------------------------------- |
| **Spacing rhythm**     | padding/margin の値がコンポーネント間で整合しているか                     |
| **Typography scale**   | font-size の段階が明示的か、単位が統一されているか（px/rem/em 混在は NG） |
| **Color tokens**       | 冗長な token がないか、未定義/未使用 token がないか                       |
| **Border radius**      | 体系的か（大/中/小の 3 段階が理想）                                       |
| **Animation patterns** | トランジションの duration/easing が統一されているか                       |

### 実際に見つかった問題の例

- font-size が px / rem / em の 3 系統で混在 → px に統一
- `--chat-thinking-text` が `--chat-text-secondary` と完全同値 → 統合
- `--chat-shadow` が定義されているが未使用 → 削除
- `--chat-hover` が参照されているが未定義 → 修正
- App.css にテンプレートの残骸が残っていた → 削除

## Workflow Summary

```
1. UI をコンポーネント単位に分割
2. 各コンポーネントで:
   a. 関連コード全読み
   b. /interface-craft critique 実行
   c. Top Opportunities を実装
   d. テスト/typecheck/lint 通過確認
   e. ユーザーレビュー
   f. commit
3. 最後に Global consistency critique → 実装 → commit
```

## Tips

- **1 コンポーネント = 1 commit** にすると、git bisect で問題を特定しやすい
- critique の結果をそのまま PR の description に使える
- 同じパターンの修正（例: ARIA パターン統一）は最初のコンポーネントで方針を決めて、残りは同じパターンを適用するだけ
- セキュリティに関わる UI（Approve/Reject ボタンなど）は critique で特に注意深くレビューされる。ボタンサイズ、誤操作防止、クリック後の disabled 化など
