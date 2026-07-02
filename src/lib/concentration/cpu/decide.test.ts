import { describe, it, expect } from "vitest";
import type { CpuStrength } from "@/lib/platform/gameModule";
import { isTrump, type FaceCard } from "@/lib/concentration/cards";
import { type ConcentrationConfig, MODE_CLASSROOM, MODE_FULL, type Slot } from "@/lib/concentration/board";
import { type ConcentrationState, handleAction, initGame, isFinished } from "@/lib/concentration/state";
import { decideConcentration } from "@/lib/concentration/cpu/decide";
import { hash01, retentionRate } from "@/lib/concentration/cpu/retention";

const trump = (rank: number, suit: "h" | "s" = "h"): FaceCard => ({ type: "trump", card: { suit, rank: rank as never } });
const slot = (pos: number, face: FaceCard, status: Slot["status"] = "facedown"): Slot => ({ pos, face, status });

function mkState(faces: FaceCard[], overrides: Partial<ConcentrationState> = {}): ConcentrationState {
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

/** rngSeed を探して、席0で与えた位置すべてが age0 で strong に思い出される状態を作る（決定論・数反復で見つかる）。 */
function seedRecalling(positions: number[]): number {
  const rate = retentionRate("strong", 0);
  for (let seed = 1; seed < 10000; seed++) {
    if (positions.every((pos) => hash01(seed, 0, pos) < rate)) return seed;
  }
  throw new Error("no seed found");
}

describe("decideConcentration（局面別の手）", () => {
  it("pending resolve なら resolve を返す", () => {
    const s = mkState([trump(2), trump(3)], { revealed: [0, 1], pending: { type: "resolve" } });
    expect(decideConcentration(s, "p0", "strong")).toEqual({ type: "resolve" });
  });

  it("pending choose-swap なら相異なる伏せ2枚を選ぶ", () => {
    const s = mkState([trump(2), trump(2, "s"), trump(3), trump(3, "s")], { pending: { type: "choose-swap" } });
    const a = decideConcentration(s, "p0", "strong");
    expect(a.type).toBe("swap");
    if (a.type === "swap") {
      expect(a.a).not.toBe(a.b);
      expect([a.a, a.b].every((p) => s.slots[p].status === "facedown")).toBe(true);
    }
  });

  it("pending choose-peek は未確認（未 seen）の札を選ぶ", () => {
    const s = mkState([trump(2), trump(2, "s"), trump(3), trump(3, "s")], {
      pending: { type: "choose-peek" },
      seen: { 0: 0, 1: 0 }, // 0,1 は確認済 → 2 か 3（未確認）を覗くべき
      revealClock: 2,
    });
    const a = decideConcentration(s, "p0", "strong");
    expect(a.type).toBe("peek");
    if (a.type === "peek") expect(s.seen[a.pos]).toBeUndefined();
  });

  it("pending choose-peek で全札確認済みなら最小の伏せ札にフォールバック（throw/stall しない）", () => {
    const s = mkState([trump(2), trump(2, "s")], {
      pending: { type: "choose-peek" },
      seen: { 0: 0, 1: 0 },
      revealClock: 2,
    });
    expect(decideConcentration(s, "p0", "strong")).toEqual({ type: "peek", pos: 0 });
  });

  it("2枚目: 相方を思い出していれば揃えに行く", () => {
    // pos0(rank2) と pos2(rank2) がペア。1枚目に相方 pos2 をめくった状態で、pos0 を思い出していれば pos0 を返す。
    const seed = seedRecalling([0]);
    const s = mkState([trump(2), trump(3), trump(2, "s"), trump(3, "s")], {
      rngSeed: seed,
      seen: { 0: 0 },
      revealClock: 1,
      revealed: [2], // 1枚目 = pos2（rank2）
    });
    expect(decideConcentration(s, "p0", "strong")).toEqual({ type: "flip", pos: 0 });
  });

  it("1枚目: 既知ペアがあれば片方（低い pos）をめくる", () => {
    // pos0,pos1 が rank2 のペア。両方を思い出していれば 0 をめくる。
    const seed = seedRecalling([0, 1]);
    const s = mkState([trump(2), trump(2, "s"), trump(3), trump(3, "s")], {
      rngSeed: seed,
      seen: { 0: 0, 1: 0 },
      revealClock: 1,
    });
    expect(decideConcentration(s, "p0", "strong")).toEqual({ type: "flip", pos: 0 });
  });

  it("記憶が無ければ（seen 空）最小の伏せ札をめくる＝弱の運まかせ挙動", () => {
    const s = mkState([trump(2), trump(2, "s"), trump(3), trump(3, "s")]);
    expect(decideConcentration(s, "p0", "weak")).toEqual({ type: "flip", pos: 0 });
  });

  it("存在しない playerId は throw する（server が握り潰し安全停止）", () => {
    const s = mkState([trump(2), trump(2, "s")]);
    expect(() => decideConcentration(s, "nope", "weak")).toThrow();
  });
});

// --- 終局保証（デッドロック回帰）: CPU 自身で全局を回して必ず ended まで到達する ---

const drive = (s0: ConcentrationState, strengthOf: (seat: number) => CpuStrength, guardMax = 20000): ConcentrationState => {
  let s = s0;
  let guard = 0;
  while (!isFinished(s) && guard++ < guardMax) {
    const pid = s.players[s.currentSeat].id;
    s = handleAction(s, pid, decideConcentration(s, pid, strengthOf(s.currentSeat)));
  }
  return s;
};

const facedownTrump = (s: ConcentrationState) => s.slots.filter((sl) => sl.status === "facedown" && isTrump(sl.face));

describe("記憶保持率CPU 全局ドライブ（終局保証・決定論）", () => {
  const players4 = [
    { id: "p0", name: "A" },
    { id: "p1", name: "B" },
    { id: "p2", name: "C" },
    { id: "p3", name: "D" },
  ];
  const CASES: { name: string; cfg: ConcentrationConfig }[] = [
    { name: "フル", cfg: MODE_FULL },
    { name: "教室", cfg: MODE_CLASSROOM },
    { name: "特殊多め", cfg: { pairCount: 12, specialRatio: 0.3, shuffleSwapPairs: 3, highValueRatio: 0.2 } },
  ];
  const uniform = (strength: CpuStrength) => () => strength;
  const mixed = (seat: number): CpuStrength => (["weak", "medium", "strong", "weak"] as const)[seat];

  for (const c of CASES) {
    for (const strength of ["weak", "medium", "strong"] as const) {
      it.each([1, 2, 7, 42, 2024])(`${c.name} × ${strength} × seed=%i で必ず終局し全ペア取得`, (seed) => {
        const end = drive(initGame({ players: players4, config: c.cfg, seed }), uniform(strength));
        expect(isFinished(end)).toBe(true);
        expect(facedownTrump(end)).toHaveLength(0);
      });
    }
    it.each([3, 11, 99])(`${c.name} × 混成(弱中強弱) × seed=%i で必ず終局`, (seed) => {
      const end = drive(initGame({ players: players4, config: c.cfg, seed }), mixed);
      expect(isFinished(end)).toBe(true);
      expect(facedownTrump(end)).toHaveLength(0);
    });
  }

  it("敵対配置 [2,3,2,3] でも巡回探索で終局する（固定めくりならデッドロックする配置）", () => {
    // 旧「最小を固定でめくる」ロジックだと 1枚目=pos0(2)/2枚目=pos1(3) の永久ミスマッチ。
    // 探索2枚目を revealClock で巡回させる修正により、相方 pos2 が共めくりされて揃い、必ず終局する。
    const faces = [trump(2, "h"), trump(3, "h"), trump(2, "s"), trump(3, "s")];
    const start = mkState(faces, { pointByRank: { 2: 1, 3: 1 } as never });
    const end = drive(start, () => "weak", 1000);
    expect(isFinished(end)).toBe(true);
    expect(facedownTrump(end)).toHaveLength(0);
  });
});
