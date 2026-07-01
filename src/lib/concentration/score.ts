// 得点集計と順位（純粋TS / REQUIREMENTS_platform.md §5.5, §6）。
// 枚数ではなく点数で競う。合計点が最大のプレイヤーが勝ち、同点は獲得ペア数が多い方（なお同点は席順）。

import type { ConcentrationState } from "@/lib/concentration/state";

export interface Standing {
  readonly seat: number;
  readonly name: string;
  readonly score: number; // 合計点（pointByRank の合算）
  readonly pairs: number; // 獲得ペア数（同点タイブレーク用）
}

/** 各プレイヤーの合計点・獲得ペア数を計算し、上位順（点数→ペア数→席順）に並べて返す。状態は変更しない。 */
export function computeScores(state: ConcentrationState): Standing[] {
  const standings: Standing[] = state.players.map((p) => ({
    seat: p.seat,
    name: p.name,
    score: p.collected.reduce((sum, rank) => sum + (state.pointByRank[rank] ?? 0), 0),
    pairs: p.collected.length,
  }));
  return standings.sort((a, b) => b.score - a.score || b.pairs - a.pairs || a.seat - b.seat);
}

/** 勝者（最高点。同点は獲得ペア数、なお同点は席順）。プレイヤー不在なら null。 */
export function winner(state: ConcentrationState): Standing | null {
  return computeScores(state)[0] ?? null;
}
