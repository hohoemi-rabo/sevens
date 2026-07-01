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

describe("特殊カード（即発動）", () => {
  // 特殊カードを含む盤（3種すべて出るよう specialRatio を上げる）。
  const SPCFG: ConcentrationConfig = { pairCount: 13, specialRatio: 0.3, shuffleSwapPairs: 2, highValueRatio: 0 };
  const startSp = (seed = 11) => initGame({ players, config: SPCFG, seed });
  const findSpecial = (s: ConcentrationState, kind: "shuffle" | "swap" | "peek") =>
    s.slots.find((sl) => sl.face.type === "special" && sl.face.special.kind === kind && sl.status === "facedown")!.pos;
  const facedownTrumps = (s: ConcentrationState) =>
    s.slots.filter((sl) => isTrump(sl.face) && sl.status === "facedown").map((sl) => sl.pos);

  it("シャッフルは自動発動して used になり手番終了・札は保存", () => {
    const s0 = startSp();
    const before = s0.slots.length;
    const s = handleAction(s0, "p0", { type: "flip", pos: findSpecial(s0, "shuffle") });
    expect(s.slots.find((sl) => sl.pos === findSpecial(s0, "shuffle"))!.status).toBe("used");
    expect(turnId(s)).toBe("p1"); // 手番終了
    expect(s.pending).toBeNull();
    expect(s.slots).toHaveLength(before); // マス数保存
  });

  it("入れ替えは選択待ち→2枚指定で入替して手番終了", () => {
    const s0 = startSp();
    const flipped = handleAction(s0, "p0", { type: "flip", pos: findSpecial(s0, "swap") });
    expect(flipped.pending).toEqual({ type: "choose-swap" });
    expect(turnId(flipped)).toBe("p0"); // まだ発動者の手番
    const [a, b] = facedownTrumps(flipped);
    const faceA = flipped.slots[a].face;
    const s = handleAction(flipped, "p0", { type: "swap", a, b });
    expect(s.slots[b].face).toEqual(faceA); // 入れ替わった
    expect(s.pending).toBeNull();
    expect(turnId(s)).toBe("p1"); // 手番終了
  });

  it("覗き見は選択待ち→1枚指定で共有状態は不変・手番終了", () => {
    const s0 = startSp();
    const flipped = handleAction(s0, "p0", { type: "flip", pos: findSpecial(s0, "peek") });
    expect(flipped.pending).toEqual({ type: "choose-peek" });
    const target = facedownTrumps(flipped)[0];
    const s = handleAction(flipped, "p0", { type: "peek", pos: target });
    expect(s.slots[target].face).toEqual(flipped.slots[target].face); // 中身は共有状態に出さない
    expect(s.pending).toBeNull();
    expect(turnId(s)).toBe("p1");
    expect(s.peek).toEqual({ seat: 0, pos: target }); // 発動者だけに見せる印（中身は getView が載せる）
  });

  it("覗き見の印は発動者の次アクションで消える（他席の手番では残る）", () => {
    const s0 = startSp();
    const flipped = handleAction(s0, "p0", { type: "flip", pos: findSpecial(s0, "peek") });
    const afterPeek = handleAction(flipped, "p0", { type: "peek", pos: facedownTrumps(flipped)[0] });
    // p1 の手番（1枚めくる）では peek は残る
    const p1flip = handleAction(afterPeek, "p1", { type: "flip", pos: facedownTrumps(afterPeek)[0] });
    expect(p1flip.peek).toEqual(afterPeek.peek);
  });

  it("1枚目トランプ→2枚目に特殊を引くと、トランプは伏せ戻り特殊が発動", () => {
    const s0 = startSp();
    const t = s0.slots.filter((sl) => isTrump(sl.face) && sl.status === "facedown")[0].pos;
    const afterTrump = handleAction(s0, "p0", { type: "flip", pos: t });
    expect(afterTrump.revealed).toEqual([t]);
    const s = handleAction(afterTrump, "p0", { type: "flip", pos: findSpecial(s0, "shuffle") });
    expect(s.revealed).toEqual([]); // 1枚目トランプは伏せ戻し
    expect(turnId(s)).toBe("p1");
  });
});

describe("serialize", () => {
  it("JSON 往復で同一", () => {
    const s = handleAction(start(), "p0", { type: "flip", pos: 0 });
    expect(deserializeState(serializeState(s))).toEqual(s);
  });
});
