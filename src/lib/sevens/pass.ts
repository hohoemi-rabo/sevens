/**
 * パスのルール（純粋TS）。
 *
 * パス上限の検証・脱落判定・お助け警告用の判定を提供する。
 * 状態遷移（脱落への遷移そのもの）は state.ts の `pass()` が本ヘルパを使って行う。
 *
 * 型は state.ts から type-only import する（型のみの参照は実行時の循環依存を生まない）。
 */
import { hasPlayable } from './playable'
import type { GameState, Player } from './state'

/** パス可能回数の設定範囲（ホストが部屋作成時に1〜5で指定）。 */
export const MIN_PASS = 1
export const MAX_PASS = 5

/** パス上限値が設定範囲（1〜5）内か。 */
export function isValidMaxPass(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_PASS && n <= MAX_PASS
}

/**
 * このプレイヤーが今パスすると上限を超過して脱落するか。
 * passesLeft は許容回数で初期化され、許容分を使い切って0になった後の
 * 次のパスが「超過」＝脱落となる。
 */
export function willEliminateOnPass(player: Player): boolean {
  return player.passesLeft <= 0
}

/**
 * 出せる札があるのにパスしようとしているか（お助けON時の警告に使う・15で利用）。
 */
export function isWastefulPass(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId)
  return !!player && hasPlayable(player.hand, state.board)
}
