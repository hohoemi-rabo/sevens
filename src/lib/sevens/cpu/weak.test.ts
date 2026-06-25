import { describe, it, expect } from 'vitest'
import { decideWeak } from './weak'
import { initBoard } from '../board'
import { initGame, playCard, pass, currentPlayer, type GameState } from '../state'
import { seededRng } from '../deal'
import type { Card } from '../cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

function makeState(hands: Card[][]): GameState {
  return {
    players: hands.map((hand, seat) => ({
      id: `p${seat}`,
      name: `P${seat}`,
      seat,
      hand,
      passesLeft: 3,
      status: 'playing',
    })),
    board: initBoard('diamond7'),
    currentSeat: 0,
    phase: 'playing',
    startMode: 'diamond7',
    maxPass: 3,
  }
}

describe('decideWeak', () => {
  it('出せる札があれば出す', () => {
    const state = makeState([[c('d', 9), c('d', 8)], [c('h', 1)]])
    const action = decideWeak(state, 'p0')
    expect(action).toEqual({ type: 'play', card: c('d', 8) }) // d8が出せる（d9は不可）
  })

  it('出せる札がなければパス', () => {
    const state = makeState([[c('d', 9), c('s', 2)], [c('h', 1)]])
    expect(decideWeak(state, 'p0')).toEqual({ type: 'pass' })
  })

  it('存在しないプレイヤーIDは例外', () => {
    expect(() => decideWeak(makeState([[c('d', 8)]]), 'ghost')).toThrow()
  })
})

describe('全員CPU（弱）で対局が最後まで進む', () => {
  it('デッドロックせず全員が上がって終了する', () => {
    let state = initGame({
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D' },
      ],
      maxPass: 3,
      startMode: 'diamond7',
      rng: seededRng(2024),
    })

    let guard = 0
    while (state.phase === 'playing' && guard++ < 10000) {
      const player = currentPlayer(state)
      const action = decideWeak(state, player.id)
      state =
        action.type === 'play'
          ? playCard(state, player.id, action.card)
          : pass(state, player.id)
    }

    // デッドロックせず、必ず終了する
    expect(state.phase).toBe('ended')
    // 全員が上がり or 脱落（playing が残らない）
    expect(
      state.players.every(
        (p) => p.status === 'finished' || p.status === 'eliminated',
      ),
    ).toBe(true)
    // 上がった人の順位は 1..k で一意（脱落者は rank を持たない）
    const ranks = state.players
      .filter((p) => p.status === 'finished')
      .map((p) => p.rank)
      .sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(ranks).toEqual(ranks.map((_, i) => i + 1))
  })
})
