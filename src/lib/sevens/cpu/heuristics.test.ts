import { describe, it, expect } from 'vitest'
import { centrality, opponentGain, threatHandSize } from './heuristics'
import { initBoard, type BoardState } from '../board'
import type { Card } from '../cards'
import type { GameState, Player } from '../state'

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

describe('centrality', () => {
  it('7が最大(6)、A/Kが最小(0)', () => {
    expect(centrality(7)).toBe(6)
    expect(centrality(1)).toBe(0)
    expect(centrality(13)).toBe(0)
    expect(centrality(6)).toBe(5)
    expect(centrality(8)).toBe(5)
    expect(centrality(4)).toBe(3)
  })
})

describe('opponentGain', () => {
  it('相手が次に出せる札を解放するなら正の値', () => {
    // d=[7]。p0 が d8 を出すと d の上端が 8 になり、p1 の d9 が出せるようになる。
    const state = makeState([[c('d', 8)], [c('d', 9)]], { s: [], h: [], d: [7], c: [] })
    expect(opponentGain(state, 'p0', c('d', 8))).toBe(1)
  })

  it('相手が持たないスートを開くなら0', () => {
    // p0 が s7 を出して s を開いても、p1 は s札を持たないので解放なし。
    const state = makeState([[c('s', 7)], [c('d', 9)]], { s: [], h: [], d: [7], c: [] })
    expect(opponentGain(state, 'p0', c('s', 7))).toBe(0)
  })

  it('脱落/上がり済みの相手は数えない', () => {
    const state = makeState([[c('d', 8)], [c('d', 9)]], { s: [], h: [], d: [7], c: [] })
    state.players[1].status = 'finished'
    expect(opponentGain(state, 'p0', c('d', 8))).toBe(0)
  })
})

describe('threatHandSize', () => {
  it('playing な相手の最小手札枚数を返す', () => {
    const state = makeState([[c('d', 8)], [c('d', 9), c('s', 2)], [c('h', 1)]])
    expect(threatHandSize(state, 'p0')).toBe(1) // p2 が1枚
  })

  it('相手がいなければ Infinity', () => {
    const state = makeState([[c('d', 8)]])
    expect(threatHandSize(state, 'p0')).toBe(Infinity)
  })
})
