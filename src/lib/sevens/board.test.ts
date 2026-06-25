import { describe, it, expect } from 'vitest'
import { initBoard, canPlace, place, type BoardState } from './board'
import type { Card } from './cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

describe('initBoard', () => {
  it('diamond7: ♦のみ {7,7}、他は未着手', () => {
    const b = initBoard('diamond7')
    expect(b.d).toEqual({ low: 7, high: 7 })
    expect(b.s).toBeNull()
    expect(b.h).toBeNull()
    expect(b.c).toBeNull()
  })

  it('all7: 全スート {7,7}', () => {
    const b = initBoard('all7')
    for (const suit of ['s', 'h', 'd', 'c'] as const) {
      expect(b[suit]).toEqual({ low: 7, high: 7 })
    }
  })
})

describe('canPlace', () => {
  const board = initBoard('diamond7')

  it('未着手スートは7のみ置ける', () => {
    expect(canPlace(board, c('s', 7))).toBe(true)
    expect(canPlace(board, c('s', 6))).toBe(false)
    expect(canPlace(board, c('s', 8))).toBe(false)
  })

  it('♦は上端+1(8)と下端-1(6)が置ける', () => {
    expect(canPlace(board, c('d', 8))).toBe(true)
    expect(canPlace(board, c('d', 6))).toBe(true)
    expect(canPlace(board, c('d', 9))).toBe(false)
    expect(canPlace(board, c('d', 5))).toBe(false)
    expect(canPlace(board, c('d', 7))).toBe(false) // 既出
  })
})

describe('place', () => {
  it('上方向に伸ばすと high が増える', () => {
    let b: BoardState = initBoard('diamond7')
    b = place(b, c('d', 8))
    expect(b.d).toEqual({ low: 7, high: 8 })
    b = place(b, c('d', 9))
    expect(b.d).toEqual({ low: 7, high: 9 })
  })

  it('下方向に伸ばすと low が減る', () => {
    let b: BoardState = initBoard('diamond7')
    b = place(b, c('d', 6))
    expect(b.d).toEqual({ low: 6, high: 7 })
    b = place(b, c('d', 5))
    expect(b.d).toEqual({ low: 5, high: 7 })
  })

  it('未着手スートに7を置くと着手される', () => {
    const b = place(initBoard('diamond7'), c('s', 7))
    expect(b.s).toEqual({ low: 7, high: 7 })
  })

  it('非破壊（元の状態を変更しない）', () => {
    const b = initBoard('diamond7')
    place(b, c('d', 8))
    expect(b.d).toEqual({ low: 7, high: 7 })
  })

  it('連続しない札は例外', () => {
    const b = initBoard('diamond7')
    expect(() => place(b, c('d', 9))).toThrow()
    expect(() => place(b, c('s', 8))).toThrow()
  })

  it('既出札は例外', () => {
    const b = initBoard('diamond7')
    expect(() => place(b, c('d', 7))).toThrow()
  })

  it('端（K/A）まで伸ばせ、それ以上は不可', () => {
    let b: BoardState = initBoard('diamond7')
    for (const rank of [8, 9, 10, 11, 12, 13] as const) {
      b = place(b, c('d', rank))
    }
    expect(b.d).toEqual({ low: 7, high: 13 }) // Kで止まる
    for (const rank of [6, 5, 4, 3, 2, 1] as const) {
      b = place(b, c('d', rank))
    }
    expect(b.d).toEqual({ low: 1, high: 13 }) // Aまで
  })
})
