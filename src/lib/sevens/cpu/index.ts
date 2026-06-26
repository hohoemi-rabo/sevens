/** CPU思考のエントリポイント。差し替え可能な戦略をまとめて再エクスポートする。 */
import { type CpuStrategy, type CpuStrength } from './types'
import { decideWeak } from './weak'
import { decideMedium } from './medium'
import { decideStrong } from './strong'

export type { Action, CpuStrategy, CpuStrength } from './types'
export { decideWeak } from './weak'
export { decideMedium } from './medium'
export { decideStrong } from './strong'

/** 強さから思考関数を解決する（弱/中/強）。 */
export function strategyFor(strength: CpuStrength): CpuStrategy {
  switch (strength) {
    case 'medium':
      return decideMedium
    case 'strong':
      return decideStrong
    case 'weak':
    default:
      return decideWeak
  }
}
