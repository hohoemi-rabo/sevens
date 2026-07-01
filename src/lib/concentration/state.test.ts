import { describe, it, expect } from "vitest";
import type { Rank } from "@/lib/sevens/cards";
import type { ConcentrationConfig } from "@/lib/concentration/board";
import { isTrump } from "@/lib/concentration/cards";
import {
  type ConcentrationState,
  deserializeState,
  handleAction,
  initGame,
  isFinished,
  serializeState,
} from "@/lib/concentration/state";

// 特殊カードなし（specialRatio:0）の純トランプ盤で、めくり/resolve/手番/終局の骨格を検証する。
const CFG: ConcentrationConfig = { pairCount: 3, specialRatio: 0, shuffleSwapPairs: 2, highValueRatio: 0 };
const players = [
  { id: "p0", name: "A" },
  { id: "p1", name: "B" },
];
const start = (cfg: ConcentrationConfig = CFG, seed = 1) => initGame({ players, config: cfg, seed });

/** ランク r のペアが伏せられている2つの位置。 */
const posOfRank = (s: ConcentrationState, r: Rank): number[] =>
  s.slots.filter((sl) => isTrump(sl.face) && sl.face.card.rank === r && sl.status === "facedown").map((sl) => sl.pos);
const ranksOnBoard = (s: ConcentrationState): Rank[] =>
  [...new Set(s.slots.filter((sl) => isTrump(sl.face)).map((sl) => (sl.face as { card: { rank: Rank } }).card.rank))];
const turnId = (s: ConcentrationState) => s.players[s.currentSeat].id;

describe("flip", () => {
  it("1枚めくると revealed に入り、pending は無い", () => {
    const s0 = start();
    const s1 = handleAction(s0, "p0", { type: "flip", pos: 0 });
    expect(s1.revealed).toEqual([0]);
    expect(s1.pending).toBeNull();
    expect(s1).not.toBe(s0); // 非破壊
  });

  it("2枚めくると resolve 待ちになる", () => {
    const s0 = start();
    const [a] = posOfRank(s0, ranksOnBoard(s0)[0]);
    const b = s0.slots.find((sl) => isTrump(sl.face) && sl.pos !== a)!.pos;
    const s2 = handleAction(handleAction(s0, "p0", { type: "flip", pos: a }), "p0", { type: "flip", pos: b });
    expect(s2.revealed).toHaveLength(2);
    expect(s2.pending).toEqual({ type: "resolve" });
  });
});

describe("resolve", () => {
  it("揃えば獲得して同じ人が連続手番", () => {
    const s0 = start();
    const r = ranksOnBoard(s0)[0];
    const [a, b] = posOfRank(s0, r);
    const s = handleAction(
      handleAction(handleAction(s0, "p0", { type: "flip", pos: a }), "p0", { type: "flip", pos: b }),
      "p0",
      { type: "resolve" },
    );
    expect(s.slots.filter((sl) => sl.status === "collected")).toHaveLength(2);
    expect(s.slots.filter((sl) => sl.owner === 0)).toHaveLength(2);
    expect(s.players[0].collected).toContain(r);
    expect(turnId(s)).toBe("p0"); // 連続手番
    expect(s.revealed).toEqual([]);
    expect(s.pending).toBeNull();
  });

  it("外れたら伏せ戻して次の人へ", () => {
    const s0 = start();
    const [r1, r2] = ranksOnBoard(s0);
    const a = posOfRank(s0, r1)[0];
    const b = posOfRank(s0, r2)[0];
    const s = handleAction(
      handleAction(handleAction(s0, "p0", { type: "flip", pos: a }), "p0", { type: "flip", pos: b }),
      "p0",
      { type: "resolve" },
    );
    expect(s.slots.every((sl) => sl.status === "facedown")).toBe(true); // 伏せ戻し
    expect(s.players.every((p) => p.collected.length === 0)).toBe(true);
    expect(turnId(s)).toBe("p1"); // 交代
  });
});

describe("終局", () => {
  it("全ペアを取り切ると ended になり、以降の操作は throw", () => {
    let s = start({ ...CFG, pairCount: 2 }, 3);
    for (const r of ranksOnBoard(s)) {
      const [a, b] = posOfRank(s, r);
      s = handleAction(handleAction(s, "p0", { type: "flip", pos: a }), "p0", { type: "flip", pos: b });
      s = handleAction(s, "p0", { type: "resolve" });
    }
    expect(isFinished(s)).toBe(true);
    expect(s.phase).toBe("ended");
    expect(() => handleAction(s, "p0", { type: "flip", pos: 0 })).toThrow();
  });
});

describe("不正手は throw", () => {
  it("手番外・二度めくり・pending中flip・resolve無しは弾く", () => {
    const s0 = start();
    expect(() => handleAction(s0, "p1", { type: "flip", pos: 0 })).toThrow(); // 手番外
    expect(() => handleAction(s0, "p0", { type: "resolve" })).toThrow(); // pending無し
    const s1 = handleAction(s0, "p0", { type: "flip", pos: 0 });
    expect(() => handleAction(s1, "p0", { type: "flip", pos: 0 })).toThrow(); // 同じ位置
    const twoPos = s0.slots.filter((sl) => isTrump(sl.face)).slice(0, 2).map((sl) => sl.pos);
    const s2 = handleAction(handleAction(s0, "p0", { type: "flip", pos: twoPos[0] }), "p0", {
      type: "flip",
      pos: twoPos[1],
    });
    const third = s0.slots.filter((sl) => isTrump(sl.face))[2].pos;
    expect(() => handleAction(s2, "p0", { type: "flip", pos: third })).toThrow(); // pending中のflip
  });
});

describe("serialize", () => {
  it("JSON 往復で同一", () => {
    const s = handleAction(start(), "p0", { type: "flip", pos: 0 });
    expect(deserializeState(serializeState(s))).toEqual(s);
  });
});
