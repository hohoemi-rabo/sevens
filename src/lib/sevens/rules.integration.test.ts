/**
 * ルール統合テスト。
 *
 * 03（状態遷移）・07（パス/脱落）・08（順位）を束ね、1ゲームを台本通りに進めて
 * 最終順位（上がり順＋脱落）まで end-to-end で検証する。
 * 決定論にするため、配札はランダムな initGame ではなく手札を固定した台本で構成する。
 */
import { describe, it, expect } from 'vitest'
import { playCard, pass, type GameState, type Player } from './state'
import { initBoard } from './board'
import { computeStandings, standingLabel } from './ranking'
import type { Card } from './cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

function scenario(hands: Card[][], maxPass: number): GameState {
  const players: Player[] = hands.map((hand, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    hand,
    passesLeft: maxPass,
    status: 'playing',
  }))
  return {
    players,
    board: initBoard('diamond7'),
    currentSeat: 0,
    phase: 'playing',
    startMode: 'diamond7',
    maxPass,
  }
}

describe('1ゲーム通し: 上がり2人＋脱落1人', () => {
  it('台本通りに進み、最終順位が 1位→2位→脱落 になる', () => {
    // p0: ♦8で上がり / p1: 出せる札なし→パス超過で脱落 / p2: ♦6で上がり
    let s = scenario([[c('d', 8)], [c('s', 2)], [c('d', 6)]], 1)

    // 1) p0 が ♦8 を出して上がり（1位）
    s = playCard(s, 'p0', c('d', 8))
    expect(s.players[0].status).toBe('finished')
    expect(s.players[0].rank).toBe(1)
    expect(s.board.d).toEqual([7, 8])
    expect(s.currentSeat).toBe(1)

    // 2) p1 はパス（残1→0、まだ脱落しない）
    s = pass(s, 'p1')
    expect(s.players[1].status).toBe('playing')
    expect(s.players[1].passesLeft).toBe(0)
    expect(s.currentSeat).toBe(2)

    // 3) p2 が ♦6 を出して上がり（2位）
    s = playCard(s, 'p2', c('d', 6))
    expect(s.players[2].status).toBe('finished')
    expect(s.players[2].rank).toBe(2)
    expect(s.currentSeat).toBe(1) // 残るは p1 のみ

    // 4) p1 が超過パス → 脱落（手札 ♠2 を場へ放出）。全員終了でゲーム終了
    s = pass(s, 'p1')
    expect(s.players[1].status).toBe('eliminated')
    expect(s.players[1].hand).toEqual([])
    expect(s.players[1].eliminatedOrder).toBe(1)
    expect(s.board.s).toEqual([2]) // 放出された札が場に出ている
    expect(s.phase).toBe('ended')

    // 最終順位: 上がり（rank昇順）→ 脱落
    const standings = computeStandings(s)
    expect(standings.map((x) => x.player.id)).toEqual(['p0', 'p2', 'p1'])
    expect(standings.map(standingLabel)).toEqual(['1位', '2位', '脱落'])
  })
})
