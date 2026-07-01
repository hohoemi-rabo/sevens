// クライアント側のゲーム判別（フェーズ4A）。
// サーバーから届く GameView は 7並べ(GameState) か 神経衰弱(ConcentrationView) の union。
// どちらの UI を出すかは view の「形」で判別する（gameId をワイヤに足さずに済む＝再接続でも確実）。

import type { GameView } from "@/lib/adapter/types";
import type { ConcentrationView } from "@/lib/concentration/module";

/** 神経衰弱の view か（`slots` を持つのは神経衰弱だけ。7並べは `board`）。 */
export function isConcentrationView(view: GameView): view is ConcentrationView {
  return "slots" in view;
}
