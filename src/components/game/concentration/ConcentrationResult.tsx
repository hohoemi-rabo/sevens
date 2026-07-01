"use client";

// 神経衰弱の結果画面（フェーズ4A）。view.players を得点順（同点はペア数）に並べ、金銀銅で表示する。
// 操作: ホストは「もう一回」「部屋を解散」、非ホストは待機＋「退出する」（ResultScreen を踏襲）。

import { useState } from "react";
import { useGameStore } from "@/lib/store/gameStore";
import { Button, ConfirmDialog } from "@/components/ui";
import Avatar from "@/components/game/Avatar";
import type { ConcentrationView, ViewPlayer } from "@/lib/concentration/module";

/** 得点降順→ペア数降順→席順。 */
function ranked(players: readonly ViewPlayer[]): ViewPlayer[] {
  return [...players].sort((a, b) => b.score - a.score || b.pairs - a.pairs || a.seat - b.seat);
}

function accent(rank: number): { row: string; badge: string; medal?: string } {
  switch (rank) {
    case 1:
      return { row: "bg-yellow-400/20 border-yellow-300", badge: "bg-yellow-400 text-black", medal: "🏆" };
    case 2:
      return { row: "bg-gray-200/20 border-gray-200", badge: "bg-gray-200 text-black", medal: "🥈" };
    case 3:
      return { row: "bg-amber-700/30 border-amber-500", badge: "bg-amber-600 text-white", medal: "🥉" };
    default:
      return { row: "bg-green-900/40 border-green-400", badge: "bg-emerald-600 text-white" };
  }
}

export interface ConcentrationResultProps {
  view: ConcentrationView;
  mySeat: number;
  isHost: boolean;
  /** 退出（自分だけトップへ）。 */
  onLeave: () => void;
}

export function ConcentrationResult({ view, mySeat, isHost, onLeave }: ConcentrationResultProps) {
  const [dissolveConfirm, setDissolveConfirm] = useState(false);
  const order = ranked(view.players);

  return (
    <div className="mt-2 flex flex-col items-center gap-5 rounded-2xl bg-green-900/60 p-6">
      <h2 className="text-3xl font-extrabold">対局終了！</h2>

      <ol className="flex w-full max-w-md flex-col gap-2">
        {order.map((p, i) => {
          const a = accent(i + 1);
          const isMe = p.seat === mySeat;
          return (
            <li
              key={p.seat}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 ${a.row} ${isMe ? "ring-4 ring-sky-300" : ""}`}
            >
              <span className={`min-w-[64px] rounded-lg px-2 py-1 text-center text-xl font-extrabold ${a.badge}`}>
                {a.medal ? `${a.medal} ` : ""}
                {i + 1}位
              </span>
              <Avatar seat={p.seat} name={p.name} size="sm" />
              <span className="flex-1 text-2xl font-bold">
                {p.name}
                {isMe && <span className="ml-1 text-base font-normal text-sky-200">（あなた）</span>}
              </span>
              <span className="text-xl font-bold">
                {p.score}点<span className="ml-1 text-sm font-normal text-white/70">{p.pairs}組</span>
              </span>
            </li>
          );
        })}
      </ol>

      {isHost ? (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button variant="primary" size="lg" onClick={() => useGameStore.getState().rematch()}>
            🔄 もう一回
          </Button>
          <Button variant="danger" size="lg" onClick={() => setDissolveConfirm(true)}>
            部屋を解散
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg text-white/90">ホストが「もう一回」を選ぶのを待っています…</p>
          <Button variant="secondary" size="lg" onClick={onLeave}>
            退出する
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={dissolveConfirm}
        title="部屋を解散しますか？"
        message="全員が部屋から出てトップ画面に戻ります。この対局はおしまいになります。"
        confirmLabel="解散する"
        cancelLabel="やめる"
        confirmVariant="danger"
        onConfirm={() => useGameStore.getState().dissolve()}
        onCancel={() => setDissolveConfirm(false)}
      />
    </div>
  );
}
