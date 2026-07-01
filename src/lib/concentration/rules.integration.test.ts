import { describe, it, expect } from "vitest";
import type { Rank } from "@/lib/sevens/cards";
import { type ConcentrationConfig, MODE_CLASSROOM, MODE_FULL } from "@/lib/concentration/board";
import { isTrump } from "@/lib/concentration/cards";
import { type ConcentrationState, handleAction, initGame, isFinished } from "@/lib/concentration/state";
import { computeScores } from "@/lib/concentration/score";

// シード固定で全局を最後まで自動プレイし、破綻なく終局し・札と得点が保存されることを機械保証する
// （7並べの rules.integration.test.ts と同方針）。方策は「特殊を先に消化→既知ペアを確実に揃える」で
// 必ず前進（特殊枚数→ペア数が単調に減る）＝ライブロックしない。

const players = [
  { id: "p0", name: "A" },
  { id: "p1", name: "B" },
  { id: "p2", name: "C" },
];

const facedown = (s: ConcentrationState) => s.slots.filter((sl) => sl.status === "facedown");
const facedownTrump = (s: ConcentrationState) => facedown(s).filter((sl) => isTrump(sl.face)).map((sl) => sl.pos);
const facedownSpecial = (s: ConcentrationState) =>
  facedown(s).filter((sl) => !isTrump(sl.face)).map((sl) => sl.pos);
const rankAt = (s: ConcentrationState, pos: number): Rank => (s.slots[pos].face as { card: { rank: Rank } }).card.rank;
const pid = (s: ConcentrationState) => s.players[s.currentSeat].id;

/** 決定論的な1手。特殊カードを先に消化し、無ければ既知ペアを確実に揃える。 */
function drive(s: ConcentrationState): ConcentrationState {
  const p = pid(s);
  if (s.pending?.type === "resolve") return handleAction(s, p, { type: "resolve" });
  if (s.pending?.type === "choose-swap") {
    const [a, b] = facedown(s).map((sl) => sl.pos);
    return handleAction(s, p, { type: "swap", a, b });
  }
  if (s.pending?.type === "choose-peek") return handleAction(s, p, { type: "peek", pos: facedown(s)[0].pos });

  if (s.revealed.length === 1) {
    // 1枚目トランプの相方（同ランクの伏せ札）を出して揃える
    const r = rankAt(s, s.revealed[0]);
    const partner = facedownTrump(s).find((pos) => pos !== s.revealed[0] && rankAt(s, pos) === r)!;
    return handleAction(s, p, { type: "flip", pos: partner });
  }
  // revealed 0（手番開始）: 特殊が残っていれば消化、無ければ既知ペアの1枚目
  const sp = facedownSpecial(s);
  if (sp.length > 0) return handleAction(s, p, { type: "flip", pos: sp[0] });
  return handleAction(s, p, { type: "flip", pos: facedownTrump(s)[0] });
}

const CASES: { name: string; cfg: ConcentrationConfig; seeds: number[] }[] = [
  { name: "フル", cfg: MODE_FULL, seeds: [1, 2, 3, 42, 99] },
  { name: "教室", cfg: MODE_CLASSROOM, seeds: [1, 7, 100] },
  { name: "特殊多め", cfg: { pairCount: 12, specialRatio: 0.3, shuffleSwapPairs: 3, highValueRatio: 0.2 }, seeds: [4, 5] },
];

describe("神経衰弱 全局ドライブ（決定論）", () => {
  for (const c of CASES) {
    it.each(c.seeds)(`${c.name}: seed=%i で必ず終局し札・得点が保存される`, (seed) => {
      let s = initGame({ players, config: c.cfg, seed });
      const totalSlots = s.slots.length;
      const totalTrump = s.slots.filter((sl) => isTrump(sl.face)).length; // 2*pairCount
      const totalPoints = Object.values(s.pointByRank).reduce((a, v) => a + v, 0);

      let guard = 0;
      while (!isFinished(s) && guard++ < 5000) {
        // 保存不変量（毎ステップ）
        expect(s.slots).toHaveLength(totalSlots);
        expect(s.slots.every((sl) => ["facedown", "collected", "used"].includes(sl.status))).toBe(true);
        expect(s.slots.filter((sl) => isTrump(sl.face))).toHaveLength(totalTrump);
        s = drive(s);
      }

      expect(isFinished(s)).toBe(true); // 破綻なく終局
      expect(facedownTrump(s)).toHaveLength(0); // 全ペア取得
      expect(s.slots.filter((sl) => sl.status === "collected")).toHaveLength(totalTrump);
      // 得点合計 = 全ペアの点数合計（誰かが必ず取り切っている）
      expect(computeScores(s).reduce((a, st) => a + st.score, 0)).toBe(totalPoints);
    });
  }
});
