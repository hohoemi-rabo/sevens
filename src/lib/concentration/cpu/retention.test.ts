import { describe, it, expect } from "vitest";
import type { CpuStrength } from "@/lib/platform/gameModule";
import type { FaceCard } from "@/lib/concentration/cards";
import type { Slot } from "@/lib/concentration/board";
import type { ConcentrationState } from "@/lib/concentration/state";
import { hash01, recall, retentionRate } from "@/lib/concentration/cpu/retention";

const trump = (rank: number, suit: "h" | "s" = "h"): FaceCard => ({ type: "trump", card: { suit, rank: rank as never } });
const slot = (pos: number, face: FaceCard, status: Slot["status"] = "facedown"): Slot => ({ pos, face, status });

/** 4ペア（8トランプ）を伏せ札で並べた最小 state。overrides で seen/revealClock/revealed を差し込む。 */
function mkState(overrides: Partial<ConcentrationState> = {}): ConcentrationState {
  const faces = [trump(2), trump(2, "s"), trump(3), trump(3, "s"), trump(4), trump(4, "s"), trump(5), trump(5, "s")];
  return {
    slots: faces.map((f, pos) => slot(pos, f)),
    players: [
      { id: "p0", name: "A", seat: 0, collected: [] },
      { id: "p1", name: "B", seat: 1, collected: [] },
    ],
    currentSeat: 0,
    phase: "playing",
    revealed: [],
    pending: null,
    pointByRank: {},
    shuffleSwapPairs: 2,
    rngSeed: 123456,
    peek: null,
    seen: {},
    revealClock: 0,
    ...overrides,
  };
}

const STRENGTHS: CpuStrength[] = ["weak", "medium", "strong"];

describe("hash01（決定論ハッシュ）", () => {
  it("同じ入力は常に同じ値・[0,1) に収まる", () => {
    for (const [seed, seat, pos] of [
      [0, 0, 0],
      [123, 3, 12],
      [0x7fffffff, 1, 7],
    ] as const) {
      const v = hash01(seed, seat, pos);
      expect(v).toBe(hash01(seed, seat, pos));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("席が違えば別の札を忘れる（seat で値が変わる）", () => {
    // 全席同一だと全CPUがテレパシー記憶を共有してしまう。seat を混ぜて散らばることを確認。
    const vals = new Set([0, 1, 2, 3].map((seat) => hash01(999, seat, 5)));
    expect(vals.size).toBeGreaterThan(1);
  });
});

describe("retentionRate（強さ×経過の保持率）", () => {
  it("全 age で 強≥中≥弱（recall が包含関係になる前提）", () => {
    for (const age of [0, 1, 2, 5, 10]) {
      expect(retentionRate("strong", age)).toBeGreaterThanOrEqual(retentionRate("medium", age));
      expect(retentionRate("medium", age)).toBeGreaterThanOrEqual(retentionRate("weak", age));
    }
  });

  it("age が増えると単調に減衰する", () => {
    for (const s of STRENGTHS) {
      expect(retentionRate(s, 0)).toBeGreaterThan(retentionRate(s, 1));
      expect(retentionRate(s, 1)).toBeGreaterThan(retentionRate(s, 2));
    }
  });

  it("強でも保持率は 1 未満（完璧な記憶＝無敵にしない）", () => {
    for (const age of [0, 1, 5]) expect(retentionRate("strong", age)).toBeLessThan(1);
  });

  it("負の age（未来/同時）は age=0 として扱う", () => {
    expect(retentionRate("medium", -3)).toBe(retentionRate("medium", 0));
  });
});

describe("recall（思い出せる伏せ札）", () => {
  it("weak ⊆ medium ⊆ strong（同じ席・種）", () => {
    // 全札を seen 済みにして age を散らす（seen[pos]=pos, clock=5）。
    const seen: Record<number, number> = {};
    for (let p = 0; p < 8; p++) seen[p] = p;
    const state = mkState({ seen, revealClock: 5 });
    const w = new Set(recall(state, 0, "weak").keys());
    const m = new Set(recall(state, 0, "medium").keys());
    const s = new Set(recall(state, 0, "strong").keys());
    for (const p of w) expect(m.has(p)).toBe(true);
    for (const p of m) expect(s.has(p)).toBe(true);
  });

  it("seen にない札・collected/used・revealed 中の札は recall に入らない", () => {
    const seen: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    const state = mkState({
      seen,
      revealClock: 0,
      revealed: [1], // 今めくり中＝記憶ではなく現に見えている札なので除外
      slots: mkState().slots.map((sl) => (sl.pos === 2 ? { ...sl, status: "collected" as const } : sl)),
    });
    const keys = new Set(recall(state, 0, "strong").keys());
    expect(keys.has(1)).toBe(false); // revealed 中
    expect(keys.has(2)).toBe(false); // collected
    expect(keys.has(3)).toBe(false); // seen にない
  });
});
