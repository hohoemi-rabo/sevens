/**
 * 「中」CPU思考（純粋TS・自分中心）。
 *
 * 自分の手札と盤面だけで判断し、相手の手札は覗かない（REQUIREMENTS 3.4）。
 * 出せる札のうち最も外側（A/K寄り＝centrality 最小）を出し、7寄りのゲート札を少し温存する。
 * パスはしない（出せるなら必ず出す）＝マイルドで、終局を妨げない。
 */
import { playableCards } from '../playable'
import { centrality, byCardId } from './heuristics'
import type { CpuStrategy } from './types'

export const decideMedium: CpuStrategy = (state, playerId) => {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error(`No player with id ${playerId}`)
  }
  const options = playableCards(player.hand, state.board, state.wrapAround)
  if (options.length === 0) return { type: 'pass' }

  // 最も外側の札を出す（centrality 最小）。同点は cardId で決定論的に。
  const best = [...options].sort(
    (a, b) => centrality(a.rank) - centrality(b.rank) || (byCardId(a) < byCardId(b) ? -1 : 1),
  )[0]
  return { type: 'play', card: best }
}
