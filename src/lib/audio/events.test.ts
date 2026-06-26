import { describe, it, expect } from 'vitest'
import { diffGameState } from './events'
import { initBoard, place, placeForced, type BoardState } from '@/lib/sevens/board'
import { createDeck, type Card } from '@/lib/sevens/cards'
import type { GameState, Player } from '@/lib/sevens/state'

function player(over: Partial<Player>): Player {
  return {
    id: over.id ?? 'p',
    name: over.name ?? 'P',
    seat: over.seat ?? 0,
    hand: over.hand ?? [],
    passesLeft: over.passesLeft ?? 3,
    status: over.status ?? 'playing',
    ...over,
  }
}

function state(over: Partial<GameState>): GameState {
  return {
    players: over.players ?? [],
    board: over.board ?? initBoard('diamond7'),
    currentSeat: over.currentSeat ?? 0,
    phase: over.phase ?? 'playing',
    startMode: over.startMode ?? 'diamond7',
    maxPass: over.maxPass ?? 3,
    ...over,
  }
}

/** 13枚ずつ全プレイヤーに配ったダミー手札（中身は問わない、枚数だけ意味を持つ）。 */
function fullHands(): Card[][] {
  const deck = createDeck()
  return [deck.slice(0, 13), deck.slice(13, 26), deck.slice(26, 39), deck.slice(39, 52)]
}

describe('diffGameState — ベースライン（prev=null）', () => {
  it('配り終え直後（diamond7・♦7のみ場・全員13枚相当）は deal を1つ返す', () => {
    // ♦7を場に出した分、♦を持っていた手札から1枚抜く → 手札合計51 + 場1 = 52
    const hands = fullHands()
    hands[0] = hands[0].slice(1) // 12枚（♦7相当を抜いた想定）
    const s = state({
      board: initBoard('diamond7'),
      players: [0, 1, 2, 3].map((seat) => player({ id: `p${seat}`, seat, hand: hands[seat] })),
    })
    expect(diffGameState(null, s)).toEqual([{ kind: 'deal' }])
  })

  it('ゲーム途中で初観測（再接続）は何も鳴らさない', () => {
    const board = place(initBoard('diamond7'), { suit: 'd', rank: 8 })
    const hands = fullHands()
    hands[0] = hands[0].slice(2) // 既に出札済み = 手札が減っている
    const s = state({
      board,
      players: [0, 1, 2, 3].map((seat) => player({ id: `p${seat}`, seat, hand: hands[seat] })),
    })
    expect(diffGameState(null, s)).toEqual([])
  })
})

describe('diffGameState — 出札', () => {
  it('場に増えた1枚から play を導出（出した本人=手番だった席）', () => {
    const prev = state({
      board: initBoard('diamond7'),
      currentSeat: 1,
      players: [player({ id: 'p1', seat: 1, hand: [{ suit: 'd', rank: 8 }] })],
    })
    const next = state({
      board: place(prev.board, { suit: 'd', rank: 8 }),
      currentSeat: 2,
      players: [player({ id: 'p1', seat: 1, hand: [], status: 'finished', rank: 1 })],
    })
    // 手札0なので finish も伴う
    expect(diffGameState(prev, next)).toEqual([
      { kind: 'play', card: { suit: 'd', rank: 8 }, seat: 1 },
      { kind: 'finish', seat: 1 },
    ])
  })

  it('上がらない出札は play のみ', () => {
    const prev = state({
      currentSeat: 0,
      players: [player({ id: 'p0', seat: 0, hand: [{ suit: 'd', rank: 6 }, { suit: 'd', rank: 8 }] })],
    })
    const next = state({
      board: place(prev.board, { suit: 'd', rank: 8 }),
      currentSeat: 1,
      players: [player({ id: 'p0', seat: 0, hand: [{ suit: 'd', rank: 6 }] })],
    })
    expect(diffGameState(prev, next)).toEqual([{ kind: 'play', card: { suit: 'd', rank: 8 }, seat: 0 }])
  })
})

describe('diffGameState — パス', () => {
  it('場が不変で passesLeft が減った席に pass', () => {
    const prev = state({
      currentSeat: 2,
      players: [player({ id: 'p2', seat: 2, passesLeft: 3 })],
    })
    const next = state({
      currentSeat: 3,
      players: [player({ id: 'p2', seat: 2, passesLeft: 2 })],
    })
    expect(diffGameState(prev, next)).toEqual([{ kind: 'pass', seat: 2 }])
  })
})

describe('diffGameState — 脱落', () => {
  it('脱落は eliminated を返し、場の大量変化を play と誤検出しない', () => {
    const hand: Card[] = [
      { suit: 's', rank: 2 },
      { suit: 's', rank: 3 },
      { suit: 'c', rank: 13 },
    ]
    const prev = state({
      currentSeat: 0,
      players: [player({ id: 'p0', seat: 0, hand, passesLeft: 0 })],
    })
    const board: BoardState = placeForced(prev.board, hand)
    const next = state({
      board,
      currentSeat: 1,
      players: [player({ id: 'p0', seat: 0, hand: [], status: 'eliminated', eliminatedOrder: 1 })],
    })
    expect(diffGameState(prev, next)).toEqual([{ kind: 'eliminated', seat: 0 }])
  })
})

describe('diffGameState — 終局', () => {
  it('phase が playing→ended で end を含む', () => {
    const prev = state({
      currentSeat: 0,
      players: [player({ id: 'p0', seat: 0, hand: [{ suit: 'd', rank: 8 }] })],
    })
    const next = state({
      board: place(prev.board, { suit: 'd', rank: 8 }),
      phase: 'ended',
      players: [player({ id: 'p0', seat: 0, hand: [], status: 'finished', rank: 1 })],
    })
    const kinds = diffGameState(prev, next).map((e) => e.kind)
    expect(kinds).toContain('play')
    expect(kinds).toContain('finish')
    expect(kinds).toContain('end')
  })
})
