/**
 * 出せる札の判定（純粋TS）。
 *
 * board.ts の canPlace を土台に、手札から「今出せる札」を抽出する。
 * お助けモードのハイライト・パス警告（チケット15）からも再利用する想定。
 */
import { canPlace, type BoardState } from './board'
import type { Card } from './cards'

/** あるカードが今の場に出せるか。 */
export function isPlayable(card: Card, board: BoardState): boolean {
  return canPlace(board, card)
}

/** 手札のうち、今の場に出せる札の一覧を返す（順序は手札のまま）。 */
export function playableCards(hand: readonly Card[], board: BoardState): Card[] {
  return hand.filter((card) => canPlace(board, card))
}

/** 手札に出せる札が1枚でもあるか（パス警告の判定に使う）。 */
export function hasPlayable(hand: readonly Card[], board: BoardState): boolean {
  return hand.some((card) => canPlace(board, card))
}
