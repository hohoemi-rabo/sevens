"use client";

// 参加者一覧。room:players をライブ購読して表示する。
// 名前＋役割（あなた/ホスト/CPU）＋接続インジケータ。空席は「対局開始でCPUが入る」ことを示す。

import { useGameStore } from "@/lib/store/gameStore";
import { type Seat } from "@/lib/adapter/types";
import { cn } from "@/lib/cn";

const SEATS: readonly Seat[] = [0, 1, 2, 3];

export function PlayerList() {
  const players = useGameStore((s) => s.players);
  const mySeat = useGameStore((s) => s.mySeat);

  return (
    <ul className="flex flex-col gap-2">
      {SEATS.map((seat) => {
        const p = players.find((x) => x.seat === seat);
        return (
          <li
            key={seat}
            className={cn(
              "flex min-h-tap items-center gap-2 rounded-xl border-2 px-4 py-2 text-base",
              p ? "border-gray-400" : "border-dashed border-gray-300 text-foreground/60",
            )}
          >
            <span className="font-bold tabular-nums">{seat + 1}.</span>
            {p ? (
              <>
                <span className="font-bold">{p.name}</span>
                {seat === mySeat && (
                  <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-white">
                    あなた
                  </span>
                )}
                {p.isHost && (
                  <span className="rounded bg-gray-300 px-2 py-0.5 text-xs text-gray-800">
                    ホスト
                  </span>
                )}
                {p.isCpu && (
                  <span className="rounded bg-gray-300 px-2 py-0.5 text-xs text-gray-800">CPU</span>
                )}
                <span
                  className={cn(
                    "ml-auto h-3 w-3 rounded-full",
                    p.connected ? "bg-primary" : "bg-gray-400",
                  )}
                  aria-label={p.connected ? "接続中" : "切断中"}
                />
              </>
            ) : (
              <span>空席（対局開始でCPUが入ります）</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
