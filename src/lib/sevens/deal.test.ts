import { describe, it, expect } from 'vitest'
import { createDeck, cardId } from './cards'
import { shuffle, deal, seededRng } from './deal'

describe('seededRng', () => {
  it('同一シードなら同じ系列を返す', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('0以上1未満を返す', () => {
    const rng = seededRng(1)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('shuffle', () => {
  it('非破壊で同じ52枚を保つ（並びのみ変わる）', () => {
    const deck = createDeck()
    const shuffled = shuffle(deck, seededRng(7))
    expect(shuffled).toHaveLength(52)
    expect(deck).toHaveLength(52) // 元配列は不変
    expect(new Set(shuffled.map(cardId))).toEqual(new Set(deck.map(cardId)))
  })

  it('同一シードで再現する', () => {
    const deck = createDeck()
    const a = shuffle(deck, seededRng(123))
    const b = shuffle(deck, seededRng(123))
    expect(a.map(cardId)).toEqual(b.map(cardId))
  })
})

describe('deal', () => {
  it('4人へ各13枚を配る', () => {
    const hands = deal(shuffle(createDeck(), seededRng(99)))
    expect(hands).toHaveLength(4)
    for (const hand of hands) {
      expect(hand).toHaveLength(13)
    }
  })

  it('配札後も合計52枚・重複なし', () => {
    const hands = deal(shuffle(createDeck(), seededRng(5)))
    const allIds = hands.flat().map(cardId)
    expect(allIds).toHaveLength(52)
    expect(new Set(allIds).size).toBe(52)
  })

  it('均等に割り切れない場合は例外', () => {
    expect(() => deal(createDeck(), 3)).toThrow()
  })

  it('人数が0以下は例外', () => {
    expect(() => deal(createDeck(), 0)).toThrow()
    expect(() => deal(createDeck(), -1)).toThrow()
  })
})
