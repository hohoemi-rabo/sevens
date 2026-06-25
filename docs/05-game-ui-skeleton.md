# 05. 対局UIの叩き台

**フェーズ**: 1　**依存**: 02, 03, 04　**対象**: `src/components/game/`, `src/app/`

## 概要
ゲームロジックを画面に繋ぐ最小限のUI（場・手札・操作ボタン）を作る。まずはローカル単独（通信なし）で「出す／パス」が動く状態にする。本格的なレイアウト作り込みは 16 で行う。

## 関連要件
- `REQUIREMENTS.md` 4（画面レイアウト）、開発ロードマップ フェーズ1（簡単なUI）

## 仕様メモ
- 対象コンポーネント（`REQUIREMENTS.md` 7.2）：`Board.tsx`（中央の場）/ `HandCards.tsx`（自分の手札）/ `OpponentArea.tsx`（相手情報）/ `ActionButtons.tsx`（パス・出す）
- カード描画は 04 のSVGを使用
- **Next.js方針**（`CLAUDE.md`）：盤面表示は Server Component 寄り、クリック等のインタラクティブ部分のみ `"use client"` を葉に近い位置で付与
- この段階では状態は 03 のロジックをそのまま使い、後で Zustand store（`src/lib/store/`）に載せ替える

## Todo
- [x] カード1枚を描画する `Card` 表示コンポーネント（SVG読み込み）
- [x] `Board.tsx`：4スートの場を横並びで表示
- [x] `HandCards.tsx`：自分の手札を横並び表示・カード選択
- [x] `ActionButtons.tsx`：「出す」「パス」ボタン
- [x] `OpponentArea.tsx`：相手の残り枚数表示（仮）
- [x] 03 のロジックと接続して「出す／パス」で画面が更新される
- [x] 出せる札のハイライト／出せない札のグレーアウト（簡易版）

## 実装メモ
- 状態保持＝`GameTable.tsx` のみが `"use client"`（インタラクティブ境界を葉に）。Board/Card/HandCards/ActionButtons/OpponentArea はプレゼンテーショナル。
- CPU未実装のため**ホットシート操作**（常に現在の手番の手札を表示し1人で全員分を操作）。06で席1〜3をCPUに置換予定。
- 状態は 03 ロジックを `useState` で保持。Zustand 化は後段。
- 終了時は簡易順位リスト＋「もう一回」（本番の結果画面は17）。

## 完了条件
- 通信なしで、自分の手番で出す/パスができ、場と手札が更新される
- インタラクティブ部分のみがClient Componentになっている
