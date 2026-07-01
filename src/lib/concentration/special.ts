// 特殊カード3種の純粋効果（REQUIREMENTS_platform.md §5.2 / concentration §5）。
// いずれも Slot[] を受け取り新しい Slot[] を返す（不変）。手番進行・pending は state.ts が管理する。
//
// 中身の秘匿は getView（フェーズ3）の役目。ここでは「位置の入れ替え」など共有状態の変化のみ扱い、
// 覗き見の私的表示は状態を変えない（発動者だけが見る＝view層）。

import type { FaceCard } from "@/lib/concentration/cards";
import type { Slot } from "@/lib/concentration/board";
import { type Rng, shuffle } from "@/lib/sevens/deal";
import { slotAt } from "@/lib/concentration/flip";

/**
 * シャッフル: 残っている伏せカードのうち最大 swapPairs*2 枚の位置を入れ替える（部分シャッフル）。
 * 選んだ位置の中身を巡回シフト＝全員が別の位置へ動く。札は保存（位置の置換のみ）。
 * 伏せカードが2枚未満なら何もしない。
 */
export function applyShuffle(slots: readonly Slot[], rng: Rng, swapPairs: number): Slot[] {
  const facedown = slots.filter((s) => s.status === "facedown").map((s) => s.pos);
  const count = Math.min(Math.max(swapPairs, 0) * 2, facedown.length);
  if (count < 2) return slots.slice();
  const chosen = shuffle(facedown, rng).slice(0, count);
  const faces = chosen.map((pos) => slots[pos].face);
  const rotated = [...faces.slice(1), faces[0]]; // 巡回シフト（count>=2 で必ず全員動く）
  const faceByPos = new Map<number, FaceCard>();
  chosen.forEach((pos, i) => faceByPos.set(pos, rotated[i]));
  return slots.map((s) => (faceByPos.has(s.pos) ? { ...s, face: faceByPos.get(s.pos)! } : s));
}

/** 入れ替え: 発動者が選んだ伏せカード2枚の位置を入れ替える（頭脳系＝発動者は元位置を記憶）。 */
export function applySwap(slots: readonly Slot[], a: number, b: number): Slot[] {
  if (a === b) throw new Error("swap needs two distinct positions");
  const sa = slotAt(slots, a);
  const sb = slotAt(slots, b);
  if (sa.status !== "facedown" || sb.status !== "facedown") {
    throw new Error("can only swap face-down cards");
  }
  return slots.map((s) => (s.pos === a ? { ...s, face: sb.face } : s.pos === b ? { ...s, face: sa.face } : s));
}

/**
 * 覗き見: 発動者が選んだ伏せカード1枚を確認する。共有状態は変えない
 * （中身の私的表示はフェーズ3のview層。ここでは対象が伏せ札かの検証のみ）。
 */
export function applyPeek(slots: readonly Slot[], pos: number): Slot[] {
  const s = slotAt(slots, pos);
  if (s.status !== "facedown") throw new Error("can only peek a face-down card");
  return slots.slice();
}
