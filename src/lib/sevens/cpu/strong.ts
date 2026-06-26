/**
 * 「強」CPU思考（純粋TS・相手読み）。
 *
 * 相手の実手札（GameState）を読み、出すと相手が得する札を避け、上がり間近の相手の
 * キーカードを戦略的に止める（pass で温存）。教室内・アンチチートなし方針に沿う（REQUIREMENTS 3.4）。
 */
import { playableCards } from '../playable'
import { centrality, opponentGain, threatHandSize, byCardId } from './heuristics'
import type { CpuStrategy } from './types'

// 上がり間近とみなす相手の手札枚数（これ以下なら止める価値がある）。
const THREAT_HAND = 4

export const decideStrong: CpuStrategy = (state, playerId) => {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) {
    throw new Error(`No player with id ${playerId}`)
  }
  const options = playableCards(player.hand, state.board)
  if (options.length === 0) return { type: 'pass' }
  // 出せば上がりなら取りこぼさない。
  if (player.hand.length === 1) return { type: 'play', card: options[0] }

  // 相手を最も助けない手を選ぶ（opponentGain 昇順 → ゲート温存 centrality 昇順 → cardId）。
  const best = [...options].sort(
    (a, b) =>
      opponentGain(state, playerId, a) - opponentGain(state, playerId, b) ||
      centrality(a.rank) - centrality(b.rank) ||
      (byCardId(a) < byCardId(b) ? -1 : 1),
  )[0]

  // 戦略的温存（止める）: どの手も相手に札を渡し、上がり間近の相手がいて、自分に余裕が
  // あるならパスして温存する。パス回数は有限なので必ず尽きて終局する。
  const gain = opponentGain(state, playerId, best)
  if (gain >= 1 && threatHandSize(state, playerId) <= THREAT_HAND && player.passesLeft >= 2) {
    return { type: 'pass' }
  }

  return { type: 'play', card: best }
}
