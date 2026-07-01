"use client";

// 神経衰弱の場（伏せ札グリッド・フェーズ4A）。ViewSlot を並べ、face の有無で表裏を描く。
// クリック可否は親（ConcentrationBoard）が canPick で判定する（通常フリップ/入れ替え/覗き見）。

import { cardId } from "@/lib/sevens/cards";
import type { ConcentrationView, ViewSlot } from "@/lib/concentration/module";
import { cn } from "@/lib/cn";

const SPECIAL_LABEL = { shuffle: "シャッフル", swap: "いれかえ", peek: "のぞき見" } as const;

/** マスの画像パス（中身が見えないときは裏面）。 */
function faceSrc(slot: ViewSlot): string {
  if (!slot.face) return "/cards/back.svg";
  return slot.face.type === "trump"
    ? `/cards/${cardId(slot.face.card)}.svg`
    : `/cards/special/${slot.face.special.kind}.svg`;
}

function faceLabel(slot: ViewSlot): string {
  if (!slot.face) return "伏せ札";
  return slot.face.type === "trump" ? "カード" : SPECIAL_LABEL[slot.face.special.kind];
}

export interface CardGridProps {
  view: ConcentrationView;
  swapPicks: readonly number[];
  canPick: (slot: ViewSlot) => boolean;
  onPick: (pos: number) => void;
}

export function CardGrid({ view, swapPicks, canPick, onPick }: CardGridProps) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-green-900/40 p-2 tall:p-3">
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2 tall:gap-3">
        {view.slots.map((slot) => {
          const clickable = canPick(slot);
          const picked = swapPicks.includes(slot.pos);
          const revealed = view.revealed.includes(slot.pos);
          return (
            <button
              key={slot.pos}
              type="button"
              disabled={!clickable}
              onClick={() => onPick(slot.pos)}
              aria-label={faceLabel(slot)}
              className={cn(
                "relative h-[84px] w-[60px] rounded-lg bg-white shadow-md transition-transform tall:h-[96px] tall:w-[68px]",
                clickable && "cursor-pointer hover:-translate-y-1 hover:ring-4 hover:ring-yellow-300",
                revealed && "ring-4 ring-yellow-400",
                picked && "-translate-y-2 ring-4 ring-sky-400",
                slot.status === "collected" && "opacity-40",
                slot.status === "used" && "opacity-30",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- SVGは最適化不要、plain img で十分 */}
              <img src={faceSrc(slot)} alt="" draggable={false} className="h-full w-full select-none rounded-lg" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
