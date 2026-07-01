import { describe, it, expect } from "vitest";
import type { Rank } from "@/lib/sevens/cards";
import { seededRng } from "@/lib/sevens/deal";
import type { Slot } from "@/lib/concentration/board";
import { applyPeek, applyShuffle, applySwap } from "@/lib/concentration/special";

const trump = (pos: number, rank: number, status: Slot["status"] = "facedown"): Slot => ({
  pos,
  face: { type: "trump", card: { suit: "h", rank: rank as Rank } },
  status,
});
const ranks = (slots: readonly Slot[]) =>
  slots.map((s) => (s.face.type === "trump" ? s.face.card.rank : -1)).sort((a, b) => a - b);

describe("applyShuffle", () => {
  it("伏せ札の位置を入れ替えつつ札は保存する", () => {
    const slots = [trump(0, 1), trump(1, 2), trump(2, 3), trump(3, 4)];
    const out = applyShuffle(slots, seededRng(1), 2);
    expect(ranks(out)).toEqual(ranks(slots)); // 札の集合は保存
    expect(out.map((s) => (s.face as { card: { rank: number } }).card.rank)).not.toEqual([1, 2, 3, 4]); // 配置は変化
  });

  it("取得済み（collected）は動かさない", () => {
    const slots = [trump(0, 1), trump(1, 2), trump(2, 3, "collected")];
    const out = applyShuffle(slots, seededRng(2), 3);
    expect(out[2]).toEqual(slots[2]); // 伏せ以外は不動
  });

  it("伏せ札が2枚未満なら何もしない", () => {
    const slots = [trump(0, 1, "collected"), trump(1, 2)];
    expect(applyShuffle(slots, seededRng(1), 2)).toEqual(slots);
  });
});

describe("applySwap", () => {
  it("2枚の位置（中身）を入れ替える", () => {
    const slots = [trump(0, 1), trump(1, 2), trump(2, 3)];
    const out = applySwap(slots, 0, 2);
    expect((out[0].face as { card: { rank: number } }).card.rank).toBe(3);
    expect((out[2].face as { card: { rank: number } }).card.rank).toBe(1);
    expect(out[1]).toEqual(slots[1]);
  });
  it("同じ位置・伏せていない札は弾く", () => {
    const slots = [trump(0, 1), trump(1, 2, "collected")];
    expect(() => applySwap(slots, 0, 0)).toThrow();
    expect(() => applySwap(slots, 0, 1)).toThrow(); // collected とは入替不可
  });
});

describe("applyPeek", () => {
  it("共有状態は変えない（伏せ札の検証のみ）", () => {
    const slots = [trump(0, 1), trump(1, 2)];
    expect(applyPeek(slots, 0)).toEqual(slots);
  });
  it("伏せていない札は覗けない", () => {
    const slots = [trump(0, 1, "collected")];
    expect(() => applyPeek(slots, 0)).toThrow();
  });
});
