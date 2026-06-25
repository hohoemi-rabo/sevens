/**
 * CPU思考の共通インターフェース（純粋TS）。
 *
 * 12で「弱・中・強」を別ファイルで実装し、この `CpuStrategy` 型で差し替えられるようにする。
 * 思考は状態とプレイヤーIDを受け取り、行動（出す/パス）を返すだけ。状態は変更しない。
 */
import type { Card } from '../cards'
import type { GameState } from '../state'

/** CPU（および人間操作の抽象）の1手。 */
export type Action =
  | { type: 'play'; card: Card }
  | { type: 'pass' }

/** ゲーム状態と対象プレイヤーから1手を決める純関数。 */
export type CpuStrategy = (state: GameState, playerId: string) => Action
