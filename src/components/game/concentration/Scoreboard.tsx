"use client";

// 各プレイヤーの得点・獲得ペア数と手番表示（フェーズ4A）。view.players をそのまま並べる。

import Avatar from "@/components/game/Avatar";
import type { ViewPlayer } from "@/lib/concentration/module";
import { cn } from "@/lib/cn";

export interface ScoreboardProps {
  players: readonly ViewPlayer[];
  currentSeat: number;
  mySeat: number | null;
}

export function Scoreboard({ players, currentSeat, mySeat }: ScoreboardProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 tall:gap-3">
      {players.map((p) => {
        const isTurn = p.seat === currentSeat;
        return (
          <div
            key={p.seat}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors tall:py-2",
              isTurn ? "bg-yellow-400 text-gray-900 ring-4 ring-yellow-200" : "bg-green-900/50 text-white",
            )}
          >
            <Avatar seat={p.seat} name={p.name} size="sm" />
            <div className="text-left leading-tight">
              <div className="text-base font-bold">
                {p.name}
                {p.seat === mySeat && "（あなた）"}
              </div>
              <div className="text-sm">
                {p.score}点・{p.pairs}組
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
