import { describe, it, expect } from "vitest";
import { type FaceCard, isPair, isTrump, pairCards, PAIR_SUITS } from "@/lib/concentration/cards";

const trump = (suit: "h" | "s", rank: number): FaceCard => ({ type: "trump", card: { suit, rank: rank as never } });
const special: FaceCard = { type: "special", special: { kind: "shuffle", id: "sp-shuffle-0" } };

describe("isPair", () => {
  it("同じ数字のトランプ2枚は揃う（スート違いでも数字が同じなら相方）", () => {
    expect(isPair(trump("h", 7), trump("s", 7))).toBe(true);
  });
  it("数字が違えば揃わない", () => {
    expect(isPair(trump("h", 7), trump("s", 8))).toBe(false);
  });
  it("特殊カードは決して揃わない", () => {
    expect(isPair(trump("h", 7), special)).toBe(false);
    expect(isPair(special, special)).toBe(false);
  });
});

describe("pairCards / isTrump", () => {
  it("ペアの2枚は PAIR_SUITS の同ランク", () => {
    const [a, b] = pairCards(7);
    expect(a).toEqual({ suit: PAIR_SUITS[0], rank: 7 });
    expect(b).toEqual({ suit: PAIR_SUITS[1], rank: 7 });
  });
  it("isTrump がトランプ/特殊を判別", () => {
    expect(isTrump(trump("h", 3))).toBe(true);
    expect(isTrump(special)).toBe(false);
  });
});
