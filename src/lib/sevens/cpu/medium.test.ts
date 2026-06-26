import { describe, it, expect } from 'vitest'
import { decideMedium } from './medium'
import { decideWeak } from './weak'
import { initBoard, type BoardState } from '../board'
import { initGame, playCard, pass, currentPlayer, type GameState, type Player } from '../state'
import { seededRng } from '../deal'
import type { Card } from '../cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

function makeState(hands: Card[][], board: BoardState = initBoard('diamond7')): GameState {
  const players: Player[] = hands.map((hand, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    hand,
    passesLeft: 3,
    status: 'playing',
  }))
  return { players, board, currentSeat: 0, phase: 'playing', startMode: 'diamond7', maxPass: 3 }
}

describe('decideMedium', () => {
  it('出せる札がなければパス', () => {
    const state = makeState([[c('d', 9), c('s', 2)], [c('h', 1)]])
    expect(decideMedium(state, 'p0')).toEqual({ type: 'pass' })
  })

  it('最も外側（centrality 最小）の札を出し、弱とは選択が異なる', () => {
    // s=[5,6,7]（端 4/8）, d=[7]（端 6/8）。出せるのは s4 と d6。
    const board: BoardState = { s: [5, 6, 7], h: [], d: [7], c: [] }
    const state = makeState([[c('d', 6), c('s', 4)]], board)
    // 弱は手札の先頭 d6、中は外側の s4（centrality 3 < 5）。
    expect(decideWeak(state, 'p0')).toEqual({ type: 'play', card: c('d', 6) })
    expect(decideMedium(state, 'p0')).toEqual({ type: 'play', card: c('s', 4) })
  })

  it('手札1枚（出せば上がり）ならその札を出す', () => {
    const state = makeState([[c('d', 8)], [c('h', 1)]], { s: [], h: [], d: [7], c: [] })
    expect(decideMedium(state, 'p0')).toEqual({ type: 'play', card: c('d', 8) })
  })
})

describe('全員CPU（中）で対局が最後まで進む', () => {
  it.each([1, 2, 7, 2024])('seed=%i でデッドロックせず終局する', (seed) => {
    let state = initGame({
      players: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() })),
      maxPass: 3,
      startMode: 'diamond7',
      rng: seededRng(seed),
    })
    let guard = 0
    while (state.phase === 'playing' && guard++ < 10000) {
      const player = currentPlayer(state)
      const action = decideMedium(state, player.id)
      state =
        action.type === 'play'
          ? playCard(state, player.id, action.card)
          : pass(state, player.id)
    }
    expect(state.phase).toBe('ended')
    expect(state.players.every((p) => p.status === 'finished' || p.status === 'eliminated')).toBe(
      true,
    )
    const ranks = state.players
      .filter((p) => p.status === 'finished')
      .map((p) => p.rank)
      .sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(ranks).toEqual(ranks.map((_, i) => i + 1))
  })
})
