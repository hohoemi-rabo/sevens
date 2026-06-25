/**
 * カード定義（純粋TS）。
 *
 * 7並べの土台となるトランプ52枚（ジョーカーなし）の型・定数・ID変換を提供する。
 * 通信層・UIに一切依存しないこと（CLAUDE.md の3層分離方針）。
 */

/** スート識別子。SVG素材の命名（s1〜s13 等）と揃える: スペード/ハート/ダイヤ/クラブ */
export type Suit = 's' | 'h' | 'd' | 'c'

/** ランク。A(1)〜K(13)。 */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

/** 1枚のカード。`id`（例 `d7`）で一意化できる（cardId/parseCardId 参照）。 */
export interface Card {
  suit: Suit
  rank: Rank
}

/** 全スート（配札・場の初期化などで反復に使う） */
export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c']

/** 全ランク A(1)〜K(13) */
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

/** 読み上げ・UI表示用のスート日本語名（例:「ダイヤの8！」） */
export const SUIT_LABEL: Record<Suit, string> = {
  s: 'スペード',
  h: 'ハート',
  d: 'ダイヤ',
  c: 'クラブ',
}

/** 赤スート（♥♦）か。UIのコントラスト表現で再利用する想定。 */
export function isRedSuit(suit: Suit): boolean {
  return suit === 'h' || suit === 'd'
}

/** カード → ID文字列（例 `{suit:'d', rank:7}` → `"d7"`）。 */
export function cardId(card: Card): string {
  return `${card.suit}${card.rank}`
}

const SUIT_SET = new Set<string>(SUITS)

/** ID文字列 → カード（例 `"d7"` → `{suit:'d', rank:7}`）。不正な文字列は例外。 */
export function parseCardId(id: string): Card {
  const suit = id[0]
  const rank = Number(id.slice(1))
  if (!SUIT_SET.has(suit) || !Number.isInteger(rank) || rank < 1 || rank > 13) {
    throw new Error(`Invalid card id: ${id}`)
  }
  return { suit: suit as Suit, rank: rank as Rank }
}

/** 2枚のカードが同一か。 */
export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

/** 52枚のフルデッキを生成する（ジョーカーなし）。スート×ランクの全組み合わせ。 */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  return deck
}
