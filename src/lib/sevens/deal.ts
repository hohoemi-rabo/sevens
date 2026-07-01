/**
 * 配札ロジック（純粋TS）。
 *
 * シャッフルは差し替え可能なRNGを受け取り、テストではシード付きで決定論的にできる。
 */
import type { Card } from './cards'

/** 0以上1未満の乱数を返す関数。デフォルトは Math.random、テストでは seededRng を渡す。 */
export type Rng = () => number

/**
 * シード付き擬似乱数生成器（mulberry32）。
 * 同一シードなら常に同じ系列を返すので、シャッフル結果を再現できる。
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 配列をシャッフルする（Fisher–Yates）。非破壊で新しい配列を返す。
 * 要素型は任意（Card だけでなく Rank・位置番号・神経衰弱の伏せ札などにも使える）。
 */
export function shuffle<T>(deck: readonly T[], rng: Rng = Math.random): T[] {
  const result = deck.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * デッキを playerCount 人へ均等配分する。
 * 均等に割り切れない場合は例外（7並べは52枚×4人＝各13枚が前提）。
 * 配り方はディール順（1枚ずつ順番に配る）。
 */
export function deal(deck: readonly Card[], playerCount = 4): Card[][] {
  if (playerCount <= 0) {
    throw new Error(`playerCount must be positive: ${playerCount}`)
  }
  if (deck.length % playerCount !== 0) {
    throw new Error(
      `Cannot deal ${deck.length} cards evenly to ${playerCount} players`,
    )
  }
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  deck.forEach((card, i) => {
    hands[i % playerCount].push(card)
  })
  return hands
}
