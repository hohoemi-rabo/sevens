/** CPU思考のエントリポイント。差し替え可能な戦略をまとめて再エクスポートする。 */
import { type CpuStrategy, type CpuStrength } from './types'
import { decideWeak } from './weak'

export type { Action, CpuStrategy, CpuStrength } from './types'
export { decideWeak } from './weak'

/**
 * 強さから思考関数を解決する。チケット11ではセレクタ/配線のみ実装するため、
 * 中/強も当面 decideWeak にフォールバックする（思考ロジックの差し替えはチケット12）。
 */
export function strategyFor(_strength: CpuStrength): CpuStrategy {
  return decideWeak
}
