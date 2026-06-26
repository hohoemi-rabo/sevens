import { describe, it, expect } from 'vitest'
import { decideStrong } from './strong'
import { decideWeak } from './weak'
import { decideMedium } from './medium'
import { initBoard, type BoardState } from '../board'
import { initGame, playCard, pass, currentPlayer, type GameState, type Player } from '../state'
import { seededRng } from '../deal'
import type { Card } from '../cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

function makeState(
  hands: Card[][],
  board: BoardState = initBoard('diamond7'),
  opts?: { passesLeft?: number },
): GameState {
  const players: Player[] = hands.map((hand, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    hand,
    passesLeft: opts?.passesLeft ?? 3,
    status: 'playing',
  }))
  return { players, board, currentSeat: 0, phase: 'playing', startMode: 'diamond7', maxPass: 5 }
}

describe('decideStrong', () => {
  it('出せる札がなければパス', () => {
    const state = makeState([[c('d', 9), c('s', 2)], [c('h', 1)]])
    expect(decideStrong(state, 'p0')).toEqual({ type: 'pass' })
  })

  it('相手が得しない手を選ぶ（弱とは選択が異なる）', () => {
    // d=[7]。p0 は d8（出すと相手の d9 が解放）か s7（相手は s札なし＝解放0）を出せる。
    const board: BoardState = { s: [], h: [], d: [7], c: [] }
    const state = makeState([[c('d', 8), c('s', 7)], [c('d', 9), c('c', 2), c('c', 3), c('c', 4), c('c', 5)]], board)
    expect(decideWeak(state, 'p0')).toEqual({ type: 'play', card: c('d', 8) }) // 先頭
    expect(decideStrong(state, 'p0')).toEqual({ type: 'play', card: c('s', 7) }) // 相手を助けない
  })

  it('上がり間近の相手のキーカードを止める（パスで温存）', () => {
    // p0 の唯一の出せる札 d6 を出すと、残り1枚の p1 の d5 が解放される → 止める。
    const board: BoardState = { s: [], h: [], d: [7], c: [] }
    const state = makeState([[c('d', 6), c('h', 3)], [c('d', 5)]], board)
    expect(decideWeak(state, 'p0')).toEqual({ type: 'play', card: c('d', 6) })
    expect(decideStrong(state, 'p0')).toEqual({ type: 'pass' })
  })

  it('パス残数が少ないときは脱落回避のため止めない（必ず出す）', () => {
    const board: BoardState = { s: [], h: [], d: [7], c: [] }
    const state = makeState([[c('d', 6), c('h', 3)], [c('d', 5)]], board, { passesLeft: 1 })
    expect(decideStrong(state, 'p0')).toEqual({ type: 'play', card: c('d', 6) })
  })

  it('出せば上がりの手は止めずに出す', () => {
    // 手札1枚 d6。出すと p1(1枚) が解放されるが、自分が上がる方を優先。
    const board: BoardState = { s: [], h: [], d: [7], c: [] }
    const state = makeState([[c('d', 6)], [c('d', 5)]], board)
    expect(decideStrong(state, 'p0')).toEqual({ type: 'play', card: c('d', 6) })
  })
})

describe('全員CPU（強）・混在で対局が最後まで進む', () => {
  it.each([1, 2, 7, 2024])('seed=%i で全員強でも終局する', (seed) => {
    let state = initGame({
      players: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() })),
      maxPass: 3,
      startMode: 'diamond7',
      rng: seededRng(seed),
    })
    let guard = 0
    while (state.phase === 'playing' && guard++ < 10000) {
      const player = currentPlayer(state)
      const action = decideStrong(state, player.id)
      state =
        action.type === 'play'
          ? playCard(state, player.id, action.card)
          : pass(state, player.id)
    }
    expect(state.phase).toBe('ended')
    expect(state.players.every((p) => p.status === 'finished' || p.status === 'eliminated')).toBe(
      true,
    )
  })

  it.each([3, 11, 42])('seed=%i で弱/中/強 混在でも終局する', (seed) => {
    const deciders = [decideWeak, decideMedium, decideStrong, decideWeak]
    let state = initGame({
      players: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase() })),
      maxPass: 3,
      startMode: 'diamond7',
      rng: seededRng(seed),
    })
    let guard = 0
    while (state.phase === 'playing' && guard++ < 10000) {
      const player = currentPlayer(state)
      const action = deciders[player.seat](state, player.id)
      state =
        action.type === 'play'
          ? playCard(state, player.id, action.card)
          : pass(state, player.id)
    }
    expect(state.phase).toBe('ended')
  })
})
