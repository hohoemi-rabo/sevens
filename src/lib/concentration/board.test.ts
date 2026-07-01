import { describe, it, expect } from "vitest";
import { seededRng } from "@/lib/sevens/deal";
import {
  type ConcentrationConfig,
  MAX_PAIRS,
  MODE_FULL,
  generateBoard,
  isValidPairCount,
} from "@/lib/concentration/board";
import { isTrump } from "@/lib/concentration/cards";

const cfg = (over: Partial<ConcentrationConfig> = {}): ConcentrationConfig => ({ ...MODE_FULL, ...over });

const trumpSlots = (slots: { face: { type: string } }[]) => slots.filter((s) => isTrump(s.face as never));

describe("generateBoard", () => {
  it("同じ seed なら決定論的に同一の場", () => {
    expect(generateBoard(cfg(), seededRng(42))).toEqual(generateBoard(cfg(), seededRng(42)));
  });

  it("pairCount 組ぶんのトランプ（各2枚）が並ぶ", () => {
    const { slots, pointByRank } = generateBoard(cfg({ pairCount: 10 }), seededRng(1));
    expect(trumpSlots(slots)).toHaveLength(20); // 10ペア×2枚
    expect(Object.keys(pointByRank)).toHaveLength(10);
  });

  it("全マスは 0..N-1 の一意な pos で、初期は伏せ", () => {
    const { slots } = generateBoard(cfg(), seededRng(7));
    expect(new Set(slots.map((s) => s.pos)).size).toBe(slots.length);
    expect(slots.map((s) => s.pos)).toEqual(slots.map((_, i) => i));
    expect(slots.every((s) => s.status === "facedown")).toBe(true);
  });

  it("特殊カード枚数 ≈ トランプ枚数 × specialRatio", () => {
    const { slots } = generateBoard(cfg({ pairCount: 13, specialRatio: 0.15 }), seededRng(3));
    const trumps = trumpSlots(slots).length; // 26
    const specials = slots.length - trumps;
    expect(specials).toBe(Math.round(trumps * 0.15)); // round(3.9)=4
    expect(slots.length).toBe(trumps + specials); // 全札保存
  });

  it("点数はほとんど1点、一部が2〜3点", () => {
    const { pointByRank } = generateBoard(cfg({ pairCount: 13, highValueRatio: 0.15 }), seededRng(5));
    const values = Object.values(pointByRank) as number[];
    expect(values.every((v) => v >= 1 && v <= 3)).toBe(true);
    expect(values.filter((v) => v >= 2).length).toBe(Math.round(13 * 0.15)); // 高得点=round(1.95)=2組
    expect(values.filter((v) => v === 1).length).toBeGreaterThan(0);
  });

  it("不正な pairCount は例外", () => {
    expect(isValidPairCount(0)).toBe(false);
    expect(isValidPairCount(MAX_PAIRS + 1)).toBe(false);
    expect(() => generateBoard(cfg({ pairCount: 0 }), seededRng(1))).toThrow();
    expect(() => generateBoard(cfg({ pairCount: 14 }), seededRng(1))).toThrow();
  });
});
