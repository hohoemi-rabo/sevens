import { describe, it, expect } from 'vitest'
import {
  createDeck,
  cardId,
  parseCardId,
  cardsEqual,
  isRedSuit,
  SUITS,
  RANKS,
  type Card,
} from './cards'

describe('createDeck', () => {
  it('52枚を生成する（ジョーカーなし）', () => {
    expect(createDeck()).toHaveLength(52)
  })

  it('重複がない', () => {
    const ids = createDeck().map(cardId)
    expect(new Set(ids).size).toBe(52)
  })

  it('各スート13枚ずつ含む', () => {
    const deck = createDeck()
    for (const suit of SUITS) {
      expect(deck.filter((c) => c.suit === suit)).toHaveLength(13)
    }
  })
})

describe('cardId / parseCardId', () => {
  it('例: ダイヤの7は "d7"', () => {
    expect(cardId({ suit: 'd', rank: 7 })).toBe('d7')
  })

  it('全カードで往復が一致する', () => {
    for (const card of createDeck()) {
      expect(parseCardId(cardId(card))).toEqual(card)
    }
  })

  it('2桁ランク（10）も往復できる', () => {
    expect(parseCardId('s10')).toEqual({ suit: 's', rank: 10 })
  })

  it('不正なIDは例外を投げる', () => {
    expect(() => parseCardId('x7')).toThrow()
    expect(() => parseCardId('d0')).toThrow()
    expect(() => parseCardId('d14')).toThrow()
    expect(() => parseCardId('d')).toThrow()
  })
})

describe('cardsEqual', () => {
  it('スートとランクが一致したときのみ true', () => {
    const a: Card = { suit: 'h', rank: 5 }
    expect(cardsEqual(a, { suit: 'h', rank: 5 })).toBe(true)
    expect(cardsEqual(a, { suit: 's', rank: 5 })).toBe(false)
    expect(cardsEqual(a, { suit: 'h', rank: 6 })).toBe(false)
  })
})

describe('isRedSuit', () => {
  it('ハート・ダイヤが赤', () => {
    expect(isRedSuit('h')).toBe(true)
    expect(isRedSuit('d')).toBe(true)
    expect(isRedSuit('s')).toBe(false)
    expect(isRedSuit('c')).toBe(false)
  })
})

describe('RANKS', () => {
  it('A(1)〜K(13)の13種', () => {
    expect(RANKS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })
})
