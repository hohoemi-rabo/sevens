/**
 * 場（4スートの並び）の状態管理（純粋TS）。
 *
 * 各スートは7を起点に、8→9→…→K（上方向）と 6→5→…→A（下方向）の2方向へ伸びる。
 * 状態はスートごとの「配置済みランクの配列（昇順）」で表現する。
 *
 * 配列（集合）にしている理由:
 * - 脱落時に手札を強制的に場へ放出すると、連続しない札（隙間）が生じうるため、
 *   連続範囲 {low, high} では表現できない。配置済みランクの集合なら隙間を保持できる。
 * - JSON で往復できるよう Set ではなく配列を採用（state.ts の serializeState 用）。
 *
 * すべて非破壊更新（新しい状態を返す）。
 */
import { SUITS, type Card, type Suit, type Rank } from './cards'

/** あるスートに配置済みのランク（昇順）。空配列 = 未着手。 */
export type SuitPile = Rank[]

/** 場全体の状態。スートごとの配置済みランク集合を持つ。 */
export type BoardState = Record<Suit, SuitPile>

/**
 * 開始方式。
 * - `diamond7`: ♦7のみを場に置いて開始（標準ルール）
 * - `all7`: 各スートの7を場に置いて開始
 */
export type StartMode = 'diamond7' | 'all7'

/** 7はすべてのスートの起点ランク。 */
const PIVOT: Rank = 7

/** 巡回（リング）で1つ上のランク（K=13の次はA=1）。A-Kループルール用。 */
const cyclicUp = (rank: Rank): Rank => (rank === 13 ? 1 : ((rank + 1) as Rank))
/** 巡回（リング）で1つ下のランク（A=1の前はK=13）。A-Kループルール用。 */
const cyclicDown = (rank: Rank): Rank => (rank === 1 ? 13 : ((rank - 1) as Rank))

/** 指定方式で場を初期化する。 */
export function initBoard(mode: StartMode): BoardState {
  const board = { s: [], h: [], d: [], c: [] } as BoardState
  if (mode === 'diamond7') {
    board.d = [PIVOT]
  } else {
    for (const suit of SUITS) {
      board[suit] = [PIVOT]
    }
  }
  return board
}

/**
 * 7を含む連続ブロックの上下端を返す（7未配置なら null）。
 * 隙間の先にある孤立札（脱落で放出された札など）はこのブロックに含まれない＝
 * 隙間が埋まるまで出せない（本来の7並べルール）。
 */
export function runAround7(pile: readonly Rank[]): { low: Rank; high: Rank } | null {
  const set = new Set<number>(pile)
  if (!set.has(PIVOT)) return null
  let low = PIVOT
  let high = PIVOT
  while (low > 1 && set.has(low - 1)) low--
  while (high < 13 && set.has(high + 1)) high++
  return { low: low as Rank, high: high as Rank }
}

/**
 * カードが現在の場に出せるか判定する（理由は問わない真偽値）。
 * - 既に配置済みなら不可
 * - 7が未配置のスート: rank が7のときのみ可（起点）
 * - 7が配置済み: 連続ブロックの low-1（下方向）か high+1（上方向）のみ可
 *   （連続ブロックの最大性より、これらは必ず未配置）。範囲外（K超・A未満）は不可。
 *
 * `wrapAround`（A-Kループ・ローカルルール）が true のときは、各スートを **13枚の一方向リング** とみなす＝
 * 7から選んだ一方向にだけ一周する。最初の一手（6 or 8）で回る向きが決まり、以降はその向きの端だけ伸ばせる。
 * 例: 上回りなら 7→8→…→K→A→2→…→6（Kの次はA だけ・下方向の6は出せない）。下回りは 7→6→…→A→K→…→8。
 * 標準ルール（既定 false）では7を中心に上下両方向へ伸び、A/Kは反対側の行き止まりでつながらない。
 */
export function canPlace(board: BoardState, card: Card, wrapAround = false): boolean {
  const pile = board[card.suit]
  if (pile.includes(card.rank)) return false
  const set = new Set<number>(pile)
  if (!set.has(PIVOT)) return card.rank === PIVOT

  if (!wrapAround) {
    const run = runAround7(pile)! // 7 が場にあるので null にならない
    return card.rank === run.low - 1 || card.rank === run.high + 1
  }

  // A-Kループ（一方向リング）: 13枚そろえば出せる札は無い（includes で弾かれるが安全に）。
  if (set.size >= 13) return false
  // 7を含む連続弧の両端を巡回で求める。size<13＝必ず隙間があるので無限ループしない。
  let low: Rank = PIVOT
  while (set.has(cyclicDown(low))) low = cyclicDown(low)
  let high: Rank = PIVOT
  while (set.has(cyclicUp(high))) high = cyclicUp(high)
  const upStarted = set.has(cyclicUp(PIVOT)) // 8 が場にある＝上回りに踏み出した
  const downStarted = set.has(cyclicDown(PIVOT)) // 6 が場にある＝下回りに踏み出した
  // 脱落の強制放出などで両方向に札がある異常系は両端を許可し、完成不能（膠着）を避ける。
  if (upStarted && downStarted) return card.rank === cyclicUp(high) || card.rank === cyclicDown(low)
  // 向きが決まっていればその端だけ。未決（7のみ）は6/8どちらも可＝最初の一手で向きが決まる。
  if (!downStarted && card.rank === cyclicUp(high)) return true
  if (!upStarted && card.rank === cyclicDown(low)) return true
  return false
}

/** ランクを昇順を保って追加した新しい配列を返す（非破壊）。 */
function addRank(pile: readonly Rank[], rank: Rank): Rank[] {
  return [...pile, rank].sort((a, b) => a - b)
}

/**
 * カードを場に置いた新しい状態を返す（非破壊）。
 * 不正な配置（連続しない札・既出札・範囲外）は例外で弾く。
 */
export function place(board: BoardState, card: Card, wrapAround = false): BoardState {
  if (!canPlace(board, card, wrapAround)) {
    throw new Error(`Illegal placement: ${card.suit}${card.rank}`)
  }
  return { ...board, [card.suit]: addRank(board[card.suit], card.rank) }
}

/**
 * 連続性を無視して複数札を一括で場に放出する（脱落時の手札放出用）。
 * 既に配置済みのランクは無視する。非破壊。
 */
export function placeForced(board: BoardState, cards: readonly Card[]): BoardState {
  const next: BoardState = { s: [...board.s], h: [...board.h], d: [...board.d], c: [...board.c] }
  for (const card of cards) {
    if (!next[card.suit].includes(card.rank)) {
      next[card.suit] = addRank(next[card.suit], card.rank)
    }
  }
  return next
}
