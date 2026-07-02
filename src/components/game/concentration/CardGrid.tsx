"use client";

// 神経衰弱の場（伏せ札グリッド・フェーズ4A／演出4C）。ViewSlot を並べ、face の有無で表裏を描く。
// 4C: カードを2面3Dフリップ（めくり／伏せ戻し）にし、覗き見は数秒でローカル自動非表示、
// シャッフル中は伏せ札を軽くゆらす。クリック可否は親（ConcentrationBoard）が canPick で判定する。

import { useEffect, useRef, useState } from "react";
import { cardId } from "@/lib/sevens/cards";
import type { ConcentrationView, ViewSlot } from "@/lib/concentration/module";
import { cn } from "@/lib/cn";

const SPECIAL_LABEL = { shuffle: "シャッフル", swap: "いれかえ", peek: "のぞき見" } as const;
const BACK_SRC = "/cards/back.svg";
const PEEK_MS = 3000; // 覗き見をローカルで見せる秒数（§5.3「数秒」）

/** 表向き画像パス（face がある前提）。 */
function frontSrcOf(slot: ViewSlot): string {
  if (!slot.face) return BACK_SRC;
  return slot.face.type === "trump"
    ? `/cards/${cardId(slot.face.card)}.svg`
    : `/cards/special/${slot.face.special.kind}.svg`;
}

function faceLabel(slot: ViewSlot): string {
  if (!slot.face) return "伏せ札";
  return slot.face.type === "trump" ? "カード" : SPECIAL_LABEL[slot.face.special.kind];
}

/**
 * 1マスの3Dフリップ。showFront で表裏を回す。
 * 伏せ戻し（mismatch）ではサーバーが view から face を落とすため、直近に見えた表画像を保持して
 * 「表を見せてから裏へ回る」を描く（frontSrc が null になっても remembered を使い続ける）。
 */
function FlipCard({ frontSrc, showFront }: { frontSrc: string | null; showFront: boolean }) {
  const [remembered, setRemembered] = useState<string | null>(frontSrc);
  useEffect(() => {
    if (frontSrc) setRemembered(frontSrc);
  }, [frontSrc]);
  const front = frontSrc ?? remembered;
  return (
    <div className="flip3d h-full w-full" data-show={showFront ? "front" : "back"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVGは最適化不要、plain img で十分 */}
      <img src={BACK_SRC} alt="" draggable={false} className="flip3d-face select-none" />
      {front && (
        // eslint-disable-next-line @next/next/no-img-element -- 同上
        <img src={front} alt="" draggable={false} className="flip3d-face flip3d-front select-none" />
      )}
    </div>
  );
}

export interface CardGridProps {
  view: ConcentrationView;
  swapPicks: readonly number[];
  canPick: (slot: ViewSlot) => boolean;
  onPick: (pos: number) => void;
  /** シャッフル予告中＝伏せ札を軽くゆらす（親が ref 差分で検出）。 */
  shuffling?: boolean;
}

/** 覗き見中のマス（自分だけ：伏せ札なのに face が乗り、めくり中ではない）。 */
const isPeekSlot = (view: ConcentrationView, slot: ViewSlot): boolean =>
  slot.status === "facedown" && !!slot.face && !view.revealed.includes(slot.pos);

export function CardGrid({ view, swapPicks, canPick, onPick, shuffling = false }: CardGridProps) {
  // 覗き見のローカル自動非表示（発動者の端末で PEEK_MS 後に裏へ戻す。サーバー状態は不変）。
  const [peekHidden, setPeekHidden] = useState<ReadonlySet<number>>(() => new Set());
  const peekHiddenRef = useRef<ReadonlySet<number>>(peekHidden);
  peekHiddenRef.current = peekHidden;
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const peeks = new Set(view.slots.filter((s) => isPeekSlot(view, s)).map((s) => s.pos));
    // 新しい覗き見にタイマー開始。
    for (const pos of peeks) {
      if (!timers.current.has(pos) && !peekHiddenRef.current.has(pos)) {
        const t = setTimeout(() => {
          timers.current.delete(pos);
          setPeekHidden((prev) => new Set(prev).add(pos));
        }, PEEK_MS);
        timers.current.set(pos, t);
      }
    }
    // 覗き見でなくなった位置は掃除（タイマーと hidden の両方）。
    for (const pos of Array.from(timers.current.keys())) {
      if (!peeks.has(pos)) {
        clearTimeout(timers.current.get(pos)!);
        timers.current.delete(pos);
      }
    }
    setPeekHidden((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter((p) => peeks.has(p)));
      return next.size === prev.size ? prev : next;
    });
  }, [view]);

  // アンマウントで全タイマー解除。
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
    };
  }, []);

  return (
    <div className="overflow-x-auto rounded-2xl bg-green-900/40 p-2 tall:p-3">
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2 tall:gap-3">
        {view.slots.map((slot) => {
          const clickable = canPick(slot);
          const picked = swapPicks.includes(slot.pos);
          const revealed = view.revealed.includes(slot.pos);
          const hasFace = !!slot.face;
          const showFront = hasFace && !peekHidden.has(slot.pos);
          const frontSrc = hasFace ? frontSrcOf(slot) : null;
          return (
            <button
              key={slot.pos}
              type="button"
              disabled={!clickable}
              onClick={() => onPick(slot.pos)}
              aria-label={faceLabel(slot)}
              data-slot-pos={slot.pos}
              className={cn(
                "flip3d-perspective relative h-[84px] w-[60px] rounded-lg bg-white shadow-md transition-transform tall:h-[96px] tall:w-[68px]",
                clickable && "cursor-pointer hover:-translate-y-1 hover:ring-4 hover:ring-yellow-300",
                revealed && "ring-4 ring-yellow-400",
                picked && "-translate-y-2 ring-4 ring-sky-400",
                slot.status === "collected" && "opacity-40",
                slot.status === "used" && "opacity-30",
                shuffling && slot.status === "facedown" && "animate-wobble",
              )}
            >
              <FlipCard frontSrc={frontSrc} showFront={showFront} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
