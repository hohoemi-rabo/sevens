import { describe, it, expect } from 'vitest'
import { initBoard } from './board'
import { isPlayable, playableCards, hasPlayable } from './playable'
import { cardId, type Card } from './cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

describe('playableCards (diamond7 開始)', () => {
  const board = initBoard('diamond7')

  it('初手に出せるのは ♦6 / ♦8 と各スートの7', () => {
    const hand: Card[] = [
      c('d', 8),
      c('d', 6),
      c('s', 7),
      c('h', 7),
      c('c', 7),
      c('d', 9), // 出せない
      c('s', 8), // 出せない（未着手）
      c('h', 1), // 出せない
    ]
    const ids = playableCards(hand, board).map(cardId).sort()
    expect(ids).toEqual(['c7', 'd6', 'd8', 'h7', 's7'])
  })

  it('hasPlayable は出せる札の有無を返す', () => {
    expect(hasPlayable([c('d', 8)], board)).toBe(true)
    expect(hasPlayable([c('d', 9), c('s', 8)], board)).toBe(false)
  })
})

describe('playableCards (all7 開始)', () => {
  const board = initBoard('all7')

  it('初手は各スートの6と8が出せる', () => {
    const hand: Card[] = [
      c('s', 8),
      c('s', 6),
      c('h', 8),
      c('c', 6),
      c('d', 7), // 既出
      c('s', 10), // 出せない
    ]
    const ids = playableCards(hand, board).map(cardId).sort()
    expect(ids).toEqual(['c6', 'h8', 's6', 's8'])
  })
})

describe('isPlayable', () => {
  it('canPlace と整合する', () => {
    const board = initBoard('diamond7')
    expect(isPlayable(c('d', 8), board)).toBe(true)
    expect(isPlayable(c('d', 9), board)).toBe(false)
  })
})
