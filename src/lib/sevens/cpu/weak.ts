/**
 * 「弱」CPU思考（純粋TS）。
 *
 * 戦略性なし: 出せる札があれば出す（先頭の1枚）、なければパス。
 * 生徒さんが勝ちやすい難易度（REQUIREMENTS 3.4）。中・強は12で実装する。
 */
import { playableCards } from '../playable'
import type { CpuStrategy } from './types'

export const decideWeak: CpuStrategy = (state, playerId) => {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error(`No player with id ${playerId}`)
  }
  const options = playableCards(player.hand, state.board, state.wrapAround)
  return options.length > 0
    ? { type: 'play', card: options[0] }
    : { type: 'pass' }
}
