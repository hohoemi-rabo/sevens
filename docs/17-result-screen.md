# 17. 結果画面（順位・脱落・拍手）

**フェーズ**: 4　**依存**: 08, 14　**対象**: `src/components/game/ResultScreen.tsx`

## 概要
全員が上がる/脱落したら、順位と脱落を一覧表示する結果画面を出す。拍手音とともに盛り上げ、「もう一回」または「部屋を解散」を選べるようにする。

## 関連要件
- `REQUIREMENTS.md` 3.2（勝敗・順位）、3.6（フロー 9〜10）、4.1

## 仕様メモ
- 08 の結果データを使い、1〜4位＋脱落を一覧表示
- 上がり時の拍手音（14）を結果表示と連動
- シニア配慮：大きく分かりやすい順位表示
- 終了後の選択：「もう一回」（同じ部屋で再戦）／「部屋を解散」

## 実装メモ（確定）
- 結果画面は `src/components/game/ResultScreen.tsx`（GameBoard インラインの暫定 Results を置換）。`computeStandings`/`standingLabel`＋`Avatar` で 1〜4位（金銀銅メダル）＋脱落＋「あなた」を大きく表示。
- 「もう一回」「部屋を解散」は**ホスト限定**（非ホストは待機＋「退出する」）。プロトコルを #17 で追加: `game:rematch`/`room:dissolve`（server.ts）、`RoomStore.rematch`（`dealInto` 抽出・同席/同設定/新seed で再配札）、`SevensAdapter.rematch/dissolve/onDissolved`、`gameStore.rematch/dissolve/dissolved`。
- 解散は `room:dissolved` を全員配信→各クライアントが `dissolved` を見てトップへ。
- 拍手・終了音は #14 既存（finish→applause、end→end.mp3）。再戦の配り直しでもシャッフルが鳴るよう `diffGameState` に ended→fresh deal ルールを追加。

## Todo
- [x] 結果データ（08）を受け取り順位・脱落を一覧表示
- [x] 拍手音・演出（14と連動）
- [x] 「もう一回」：状態をリセットして再戦（ホスト・同設定）
- [x] 「部屋を解散」：部屋を閉じてトップへ（全員）
- [x] シニア向けに大きく明瞭な表示

## 完了条件
- [x] 対局終了で順位・脱落が正しく表示される
- [x] もう一回／解散が機能する（session/sync テストで機械保証）
