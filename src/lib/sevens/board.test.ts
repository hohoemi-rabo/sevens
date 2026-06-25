import { describe, it, expect } from 'vitest'
import {
  initBoard,
  canPlace,
  place,
  placeForced,
  runAround7,
  type BoardState,
} from './board'
import type { Card } from './cards'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

describe('initBoard', () => {
  it('diamond7: ♦のみ [7]、他は空（未着手）', () => {
    const b = initBoard('diamond7')
    expect(b.d).toEqual([7])
    expect(b.s).toEqual([])
    expect(b.h).toEqual([])
    expect(b.c).toEqual([])
  })

  it('all7: 全スート [7]', () => {
    const b = initBoard('all7')
    for (const suit of ['s', 'h', 'd', 'c'] as const) {
      expect(b[suit]).toEqual([7])
    }
  })
})

describe('runAround7', () => {
  it('7未配置なら null', () => {
    expect(runAround7([])).toBeNull()
    expect(runAround7([5])).toBeNull()
  })
  it('7を含む連続ブロックの上下端を返す（隙間の先は無視）', () => {
    expect(runAround7([7])).toEqual({ low: 7, high: 7 })
    expect(runAround7([5, 6, 7, 8])).toEqual({ low: 5, high: 8 })
    // 5は隙間(6)の先にあるので連続ブロックに含まれない
    expect(runAround7([5, 7, 8])).toEqual({ low: 7, high: 8 })
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

  it('隙間がある場: 連続ブロックの端のみ可、孤立札は無関係', () => {
    // ♦に 5,7,8 が配置済み（6が隙間、5は孤立）
    const b: BoardState = { ...board, d: [5, 7, 8] }
    expect(canPlace(b, c('d', 6))).toBe(true) // 隙間を埋める
    expect(canPlace(b, c('d', 9))).toBe(true) // 上端+1
    expect(canPlace(b, c('d', 4))).toBe(false) // 孤立5の隣だが連続ブロック外
    expect(canPlace(b, c('d', 5))).toBe(false) // 既出
  })
})

describe('place', () => {
  it('上方向に伸ばすと配列が伸びる', () => {
    let b: BoardState = initBoard('diamond7')
    b = place(b, c('d', 8))
    expect(b.d).toEqual([7, 8])
    b = place(b, c('d', 9))
    expect(b.d).toEqual([7, 8, 9])
  })

  it('下方向に伸ばすと昇順を保って追加される', () => {
    let b: BoardState = initBoard('diamond7')
    b = place(b, c('d', 6))
    expect(b.d).toEqual([6, 7])
    b = place(b, c('d', 5))
    expect(b.d).toEqual([5, 6, 7])
  })

  it('未着手スートに7を置くと着手される', () => {
    const b = place(initBoard('diamond7'), c('s', 7))
    expect(b.s).toEqual([7])
  })

  it('非破壊（元の状態を変更しない）', () => {
    const b = initBoard('diamond7')
    place(b, c('d', 8))
    expect(b.d).toEqual([7])
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
    expect(b.d).toEqual([7, 8, 9, 10, 11, 12, 13]) // Kで止まる
    for (const rank of [6, 5, 4, 3, 2, 1] as const) {
      b = place(b, c('d', rank))
    }
    expect(b.d).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) // Aまで
  })
})

describe('placeForced (脱落時の手札放出)', () => {
  it('連続性を無視して複数札を一括配置（隙間が生じうる）', () => {
    const b = placeForced(initBoard('diamond7'), [
      c('d', 10), // ♦に隙間(8,9)を空けて配置
      c('s', 3), // ♠は7も無いまま孤立配置
      c('s', 4),
    ])
    expect(b.d).toEqual([7, 10])
    expect(b.s).toEqual([3, 4])
  })

  it('既配置のランクは重複させない・非破壊', () => {
    const base = initBoard('diamond7')
    const b = placeForced(base, [c('d', 7), c('d', 8)])
    expect(b.d).toEqual([7, 8])
    expect(base.d).toEqual([7]) // 元は不変
  })

  it('放出後、隙間の札が埋まると連続ブロックが伸びる', () => {
    // ♦ 7,10 配置済み → 8,9 を順に埋めると 7..10 が連続に
    let b = placeForced(initBoard('diamond7'), [c('d', 10)])
    expect(canPlace(b, c('d', 8))).toBe(true)
    b = place(b, c('d', 8))
    b = place(b, c('d', 9))
    expect(runAround7(b.d)).toEqual({ low: 7, high: 10 })
  })
})
