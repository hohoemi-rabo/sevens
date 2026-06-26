"use client";

/**
 * 結果画面（docs/17・REQUIREMENTS 3.2/3.6/4.1）。
 *
 * 全員が上がる/脱落して終局したら、順位（1〜4位）と脱落を大きく一覧表示する。
 * 拍手・終了音は #14（finish→applause / end→end.mp3）が遷移で鳴らすのでここでは扱わない。
 * 操作: ホストは「もう一回」「部屋を解散」、非ホストは待機＋「退出する」。
 */
import { useState } from "react";
import { computeStandings, standingLabel, type Standing } from "@/lib/sevens/ranking";
import type { GameState } from "@/lib/sevens/state";
import { Button, ConfirmDialog } from "@/components/ui";
import Avatar from "./Avatar";

/** 順位の見た目（1位=金・2位=銀・3位=銅・脱落=赤・その他=緑）。 */
function rankAccent(standing: Standing): { row: string; badge: string; medal?: string } {
  if (standing.outcome === "eliminated") {
    return { row: "bg-rose-900/40 border-rose-400", badge: "bg-rose-600 text-white" };
  }
  switch (standing.rank) {
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

export interface ResultScreenProps {
  state: GameState;
  mySeat: number;
  isHost: boolean;
  onRematch: () => void;
  onDissolve: () => void;
  /** 非ホストの「退出する」（自分だけトップへ）。 */
  onLeave: () => void;
}

export default function ResultScreen({
  state,
  mySeat,
  isHost,
  onRematch,
  onDissolve,
  onLeave,
}: ResultScreenProps) {
  const standings = computeStandings(state);
  const [dissolveConfirm, setDissolveConfirm] = useState(false);

  return (
    <div className="mt-auto flex flex-col items-center gap-5 rounded-2xl bg-green-900/60 p-6">
      <h2 className="text-3xl font-extrabold">対局終了！</h2>

      <ol className="flex w-full max-w-md flex-col gap-2">
        {standings.map((s) => {
          const a = rankAccent(s);
          const isMe = s.player.seat === mySeat;
          return (
            <li
              key={s.player.id}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 ${a.row} ${
                isMe ? "ring-4 ring-sky-300" : ""
              }`}
            >
              <span className={`min-w-[64px] rounded-lg px-2 py-1 text-center text-xl font-extrabold ${a.badge}`}>
                {a.medal ? `${a.medal} ` : ""}
                {standingLabel(s)}
              </span>
              <Avatar seat={s.player.seat} name={s.player.name} size="sm" />
              <span className="text-2xl font-bold">
                {s.player.name}
                {isMe && <span className="ml-1 text-base font-normal text-sky-200">（あなた）</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {isHost ? (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button variant="primary" size="lg" onClick={onRematch}>
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
        onConfirm={onDissolve}
        onCancel={() => setDissolveConfirm(false)}
      />
    </div>
  );
}
