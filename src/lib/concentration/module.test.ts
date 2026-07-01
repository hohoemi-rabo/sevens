import { describe, it, expect } from "vitest";
import type { Rank } from "@/lib/sevens/cards";
import type { ConcentrationConfig } from "@/lib/concentration/board";
import { isTrump } from "@/lib/concentration/cards";
import type { ConcentrationState } from "@/lib/concentration/state";
import { concentrationModule as M } from "@/lib/concentration/module";

const players = [
  { id: "p0", name: "A" },
  { id: "p1", name: "B" },
];
const CFG: ConcentrationConfig = { pairCount: 4, specialRatio: 0, shuffleSwapPairs: 2, highValueRatio: 0.25 };
const SPCFG: ConcentrationConfig = { pairCount: 13, specialRatio: 0.3, shuffleSwapPairs: 2, highValueRatio: 0 };
const start = (cfg = CFG, seed = 1) => M.createInitialState(players, cfg, seed) as ConcentrationState;
const posOfRank = (s: ConcentrationState, r: Rank) =>
  s.slots.filter((sl) => isTrump(sl.face) && sl.face.card.rank === r && sl.status === "facedown").map((sl) => sl.pos);
const someRank = (s: ConcentrationState) => (s.slots.find((sl) => isTrump(sl.face))!.face as { card: { rank: Rank } }).card.rank;

describe("メタ", () => {
  it("2〜4人・CPU補完・非公開（席ごと配信）", () => {
    expect(M.id).toBe("concentration");
    expect(M.minPlayers).toBe(2);
    expect(M.maxPlayers).toBe(4);
    expect(M.viewIsPublic).toBe(false);
  });
  it("createInitialState は同 seed で決定論的", () => {
    expect(M.createInitialState(players, CFG, 7)).toEqual(M.createInitialState(players, CFG, 7));
  });
});

describe("getView 秘匿", () => {
  it("開始直後は全ての伏せ札の中身が届かない", () => {
    const v = M.getView(start(), 0);
    expect(v.slots.every((sl) => sl.face === undefined)).toBe(true);
    expect(v.slots).toHaveLength(8); // 4ペア×2枚
  });

  it("この手番でめくった札は全員に見える", () => {
    const s = M.handleAction(start(), "p0", { type: "flip", pos: 0 }) as ConcentrationState;
    expect(M.getView(s, 0).slots[0].face).toBeDefined();
    expect(M.getView(s, 1).slots[0].face).toBeDefined(); // 相手にも見える（めくり演出）
    // 未めくりの札は依然として隠れている
    expect(M.getView(s, 1).slots.filter((sl) => sl.face).length).toBe(1);
  });

  it("取得済みのペアは中身が見える（点数は score に反映）", () => {
    let s = start();
    const r = someRank(s);
    const [a, b] = posOfRank(s, r);
    s = M.handleAction(s, "p0", { type: "flip", pos: a }) as ConcentrationState;
    s = M.handleAction(s, "p0", { type: "flip", pos: b }) as ConcentrationState;
    s = M.handleAction(s, "p0", { type: "resolve" }) as ConcentrationState;
    const v = M.getView(s, 1);
    expect(v.slots[a].face).toBeDefined();
    expect(v.slots[b].face).toBeDefined();
    expect(v.players[0].pairs).toBe(1);
    expect(v.players[0].score).toBeGreaterThanOrEqual(1);
  });

  it("覗き見は発動者の view にだけ中身が載る", () => {
    const s0 = start(SPCFG, 11);
    const peekPos = s0.slots.find(
      (sl) => sl.face.type === "special" && sl.face.special.kind === "peek" && sl.status === "facedown",
    )!.pos;
    const flipped = M.handleAction(s0, "p0", { type: "flip", pos: peekPos }) as ConcentrationState;
    const target = flipped.slots.find((sl) => isTrump(sl.face) && sl.status === "facedown")!.pos;
    const s = M.handleAction(flipped, "p0", { type: "peek", pos: target }) as ConcentrationState;
    expect(M.getView(s, 0).slots[target].face).toBeDefined(); // 発動者は見える
    expect(M.getView(s, 1).slots[target].face).toBeUndefined(); // 他席には届かない
  });
});

describe("自動進行・CPU", () => {
  it("autoResolvable は resolve 待ちのときだけ true", () => {
    const s0 = start();
    expect(M.autoResolvable(s0)).toBe(false);
    const r = someRank(s0);
    const [a, b] = posOfRank(s0, r);
    const s = M.handleAction(M.handleAction(s0, "p0", { type: "flip", pos: a }), "p0", {
      type: "flip",
      pos: b,
    }) as ConcentrationState;
    expect(M.autoResolvable(s)).toBe(true);
  });

  it("decideAuto は状態に応じた正しい種類の手を返し、適用できる", () => {
    const s0 = start();
    const a1 = M.decideAuto(s0, "p0", "weak");
    expect(a1.type).toBe("flip");
    const s1 = M.handleAction(s0, "p0", a1) as ConcentrationState;
    const a2 = M.decideAuto(s1, "p0", "weak");
    expect(a2.type).toBe("flip"); // 2枚目
    const s2 = M.handleAction(s1, "p0", a2) as ConcentrationState;
    expect(M.decideAuto(s2, "p0", "weak").type).toBe("resolve"); // resolve 待ち
  });
});
