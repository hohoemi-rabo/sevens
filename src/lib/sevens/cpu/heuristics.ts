/**
 * CPU思考（中・強）が共有する評価ヘルパ（純粋TS）。
 *
 * 既存の判定（playableCards / place / cardId）の上に薄く載せるだけ。
 * 盤面モデルは「配置済みランクの配列（隙間あり）」で、隣接判定は board.ts に集約済み。
 */
import { cardId, type Card, type Rank } from '../cards'
import { place, type BoardState } from '../board'
import { playableCards } from '../playable'
import type { GameState } from '../state'

/**
 * 札の「中央寄り度」。7が最大(6)、A/K が最小(0)。
 * 中央（7寄り）の札ほどゲート性が高く、温存価値が高い。
 */
export function centrality(rank: Rank): number {
  return Math.min(rank - 1, 13 - rank)
}

/**
 * card を出した後、自分以外の playing な相手の「出せる札」が合計で何枚増えるか。
 * 相手の実手札を参照する（強が使う）。1手で解放されるランクは各スート1枚なので実質 0〜数枚。
 */
export function opponentGain(state: GameState, meId: string, card: Card): number {
  const before = state.board
  const after: BoardState = place(before, card, state.wrapAround)
  let gain = 0
  for (const p of state.players) {
    if (p.id === meId || p.status !== 'playing') continue
    gain +=
      playableCards(p.hand, after, state.wrapAround).length -
      playableCards(p.hand, before, state.wrapAround).length
  }
  return gain
}

/** playing な相手の最小手札枚数（＝最も上がりに近い相手）。相手がいなければ Infinity。 */
export function threatHandSize(state: GameState, meId: string): number {
  let min = Infinity
  for (const p of state.players) {
    if (p.id === meId || p.status !== 'playing') continue
    if (p.hand.length < min) min = p.hand.length
  }
  return min
}

/** 決定論的タイブレーク用のキー（cardId 流用）。 */
export function byCardId(card: Card): string {
  return cardId(card)
}
