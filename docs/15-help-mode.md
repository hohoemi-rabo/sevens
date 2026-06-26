# 15. お助けモード

**フェーズ**: 4　**依存**: 02, 05, 07　**対象**: `src/components/help/`

## 概要
初心者でも遊べるよう、出せる札のハイライトやパス警告などの補助を行う「お助けモード」を実装する。トグルで切替、**デフォルトはON**。

## 関連要件
- `REQUIREMENTS.md` 3.3（お助けモード）、1.2（初心者ファースト）

## 仕様メモ（実装で確定）
- 画面右上のトグル（`HelpToggle`）で切替（`AudioControls` の隣・`REQUIREMENTS.md` 4.1）。**デフォルトON**。状態は端末ごとに `helpStore`＋`help-settings-storage.ts`（sessionStorage `sevens:help`）で保持。
- **ON時**：
  - 出せる札をハイライト＋出せない札をグレーアウト（`HandCards` が `playableCards` を利用）。出せる札のみクリック可。
  - 出せる札があるのにパスしようとしたら確認ダイアログ `PassWarningDialog`「出せる札がありますが、パスしますか？」（`hasPlayable` で判定）。
  - 残りパス回数を強調表示（`TurnBanner`・残り0は警告色）。
  - 自分の番を大きく強調（`TurnBanner`・点滅バナー）。
- **OFF時**：ハイライト/グレーアウト無し（手番中は全札選択可・不正手は「出す」ボタン非活性で弾く）。ターン通知は控えめ表示。パスは常に即実行（警告なし）。
- 不正手はサーバー権威＋「出す」ボタンの活性条件（`isMyTurn && selected && isPlayable`）で二重に防止。

## Todo
- [x] お助けモードのトグルUI（デフォルトON）と状態保持（`HelpToggle`/`helpStore`/`help-settings-storage.ts`）
- [x] 出せる札のハイライト表示（ON時・`HandCards` の `helpMode` prop）
- [x] 「出せる札があるのにパス」警告ダイアログ（ON時・`PassWarningDialog`）
- [x] 残りパス回数の強調表示（ON時・`TurnBanner`）
- [x] ターン通知（ON/OFFで強弱を切替・`TurnBanner`）
- [x] OFF時は最低限の通知のみになることを確認（強調なし・全札選択可・即パス）

## 完了条件
- [x] トグルでON/OFFが切り替わり、ON時に各補助が働く
- [x] 初心者がルール未習得でも操作に迷わない

## スコープ外（別チケット）
- 「待って」ボタン・「出す前確認」ダイアログ（REQUIREMENTS 3.7）→ #16
- パス脱落（残パス0）の脱落警告 → #16 の誤操作リカバリで検討
- ターン通知の音 → 視覚通知のみで対応（音源追加を避ける）
