/**
 * 場（4スートの並び）の状態管理（純粋TS）。
 *
 * 各スートは7を起点に、8→9→…→K（上方向）と 6→5→…→A（下方向）の2方向へ伸びる。
 * 状態はスートごとの「上端ランク(high)／下端ランク(low)」で表現する。
 * すべて非破壊更新（新しい状態を返す）。
 */
import { SUITS, type Card, type Suit, type Rank } from './cards'

/** あるスートの並び。null = そのスートはまだ未着手（7も置かれていない）。 */
export type SuitRun = { low: Rank; high: Rank } | null

/** 場全体の状態。スートごとの並びを持つ。 */
export type BoardState = Record<Suit, SuitRun>

/**
 * 開始方式。
 * - `diamond7`: ♦7のみを場に置いて開始（標準ルール）
 * - `all7`: 各スートの7を場に置いて開始
 */
export type StartMode = 'diamond7' | 'all7'

/** 7はすべてのスートの起点ランク。 */
const PIVOT: Rank = 7

/** 指定方式で場を初期化する。 */
export function initBoard(mode: StartMode): BoardState {
  const board = { s: null, h: null, d: null, c: null } as BoardState
  if (mode === 'diamond7') {
    board.d = { low: PIVOT, high: PIVOT }
  } else {
    for (const suit of SUITS) {
      board[suit] = { low: PIVOT, high: PIVOT }
    }
  }
  return board
}

/**
 * カードが現在の場に出せるか判定する（理由は問わない真偽値）。
 * - 該当スート未着手(null): rank が7のときのみ可（起点）
 * - 着手済み: high+1（上方向）または low-1（下方向）のときのみ可
 * 範囲外（K超・A未満）は不可。
 */
export function canPlace(board: BoardState, card: Card): boolean {
  const run = board[card.suit]
  if (run === null) {
    return card.rank === PIVOT
  }
  return card.rank === run.high + 1 || card.rank === run.low - 1
}

/**
 * カードを場に置いた新しい状態を返す（非破壊）。
 * 不正な配置（連続しない札・既出札・範囲外）は例外で弾く。
 */
export function place(board: BoardState, card: Card): BoardState {
  if (!canPlace(board, card)) {
    throw new Error(`Illegal placement: ${card.suit}${card.rank}`)
  }
  const run = board[card.suit]
  const next: SuitRun =
    run === null
      ? { low: PIVOT, high: PIVOT }
      : card.rank === run.high + 1
        ? { low: run.low, high: card.rank }
        : { low: card.rank, high: run.high }
  return { ...board, [card.suit]: next }
}
