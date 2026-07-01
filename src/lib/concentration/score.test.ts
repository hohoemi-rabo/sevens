import { describe, it, expect } from "vitest";
import type { Rank } from "@/lib/sevens/cards";
import type { ConcentrationState } from "@/lib/concentration/state";
import { computeScores, winner } from "@/lib/concentration/score";

// computeScores は players と pointByRank だけを読むので、必要分だけを持つ状態で検証する。
const state = (
  collectedBySeat: Rank[][],
  pointByRank: Partial<Record<Rank, number>>,
): ConcentrationState =>
  ({
    players: collectedBySeat.map((collected, seat) => ({ id: `p${seat}`, name: `P${seat}`, seat, collected })),
    pointByRank,
  }) as unknown as ConcentrationState;

describe("computeScores", () => {
  it("点数は pointByRank の合算（枚数ではない）", () => {
    const s = state([[1, 2], [3]], { 1: 1, 2: 3, 3: 1 });
    const sc = computeScores(s);
    expect(sc.find((x) => x.seat === 0)!.score).toBe(4); // 1点+3点
    expect(sc.find((x) => x.seat === 0)!.pairs).toBe(2);
    expect(sc.find((x) => x.seat === 1)!.score).toBe(1);
  });

  it("上位順（点数→ペア数→席順）で並ぶ", () => {
    const s = state([[1], [2, 3]], { 1: 3, 2: 1, 3: 1 });
    expect(computeScores(s).map((x) => x.seat)).toEqual([0, 1]); // 3点 > 2点
  });
});

describe("winner", () => {
  it("合計点が最大のプレイヤー", () => {
    const s = state([[1], [2, 3]], { 1: 1, 2: 2, 3: 1 });
    expect(winner(s)!.seat).toBe(1); // 3点
  });
  it("同点は獲得ペア数が多い方", () => {
    const s = state([[1, 2], [3]], { 1: 1, 2: 1, 3: 2 });
    expect(winner(s)!.seat).toBe(0); // 2点2ペア vs 2点1ペア
  });
  it("点もペア数も同じなら席順で上位", () => {
    const s = state([[1], [2]], { 1: 1, 2: 1 });
    expect(winner(s)!.seat).toBe(0);
  });
});
