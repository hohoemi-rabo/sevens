import { describe, it, expect } from 'vitest'
import { isValidMaxPass, willEliminateOnPass, isWastefulPass } from './pass'
import { initBoard } from './board'
import type { GameState, Player } from './state'
import type { Card } from './cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

const player = (over: Partial<Player> = {}): Player => ({
  id: 'p',
  name: 'P',
  seat: 0,
  hand: [],
  passesLeft: 3,
  status: 'playing',
  ...over,
})

describe('isValidMaxPass', () => {
  it('1〜5は有効', () => {
    expect([1, 2, 3, 4, 5].every(isValidMaxPass)).toBe(true)
  })
  it('範囲外・非整数は無効', () => {
    expect(isValidMaxPass(0)).toBe(false)
    expect(isValidMaxPass(6)).toBe(false)
    expect(isValidMaxPass(2.5)).toBe(false)
  })
})

describe('willEliminateOnPass', () => {
  it('残パスが0以下なら次のパスで脱落', () => {
    expect(willEliminateOnPass(player({ passesLeft: 0 }))).toBe(true)
    expect(willEliminateOnPass(player({ passesLeft: 1 }))).toBe(false)
  })
})

describe('isWastefulPass', () => {
  const state = (hand: Card[]): GameState => ({
    players: [player({ id: 'p0', hand })],
    board: initBoard('diamond7'),
    currentSeat: 0,
    phase: 'playing',
    startMode: 'diamond7',
    maxPass: 3,
  })

  it('出せる札があるのにパスは無駄パス', () => {
    expect(isWastefulPass(state([c('d', 8)]), 'p0')).toBe(true)
  })
  it('出せる札がなければ無駄パスではない', () => {
    expect(isWastefulPass(state([c('s', 2)]), 'p0')).toBe(false)
  })
})
