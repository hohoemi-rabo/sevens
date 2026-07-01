// めくり・盤面クエリの小さな純関数群（状態を持たない）。state.ts が組み合わせて手番を進める。

import type { Slot } from "@/lib/concentration/board";
import { isTrump } from "@/lib/concentration/cards";

/** 位置 pos のマスを返す（範囲外は例外）。 */
export function slotAt(slots: readonly Slot[], pos: number): Slot {
  const slot = slots[pos];
  if (!slot || slot.pos !== pos) throw new Error(`invalid position: ${pos}`);
  return slot;
}

/** まだ伏せられているか（めくって取得/発動していない）。 */
export function isFacedown(slot: Slot): boolean {
  return slot.status === "facedown";
}

/** 伏せられているトランプ札の位置（残っているペアの手がかり）。 */
export function facedownTrumpPositions(slots: readonly Slot[]): number[] {
  return slots.filter((s) => isFacedown(s) && isTrump(s.face)).map((s) => s.pos);
}

/** まだ揃えられるトランプ札が場に残っているか（終局判定に使う）。 */
export function hasFacedownTrump(slots: readonly Slot[]): boolean {
  return slots.some((s) => isFacedown(s) && isTrump(s.face));
}
