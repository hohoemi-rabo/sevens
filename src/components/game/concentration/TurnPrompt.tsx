"use client";

// 手番・特殊カード選択の案内（フェーズ4A）。シニアが「今なにをすればいいか」に迷わないよう明示する。

import type { ConcentrationView } from "@/lib/concentration/module";
import { cn } from "@/lib/cn";

export function TurnPrompt({ view, mySeat }: { view: ConcentrationView; mySeat: number | null }) {
  const isMine = view.currentSeat === mySeat;
  const name = view.players.find((p) => p.seat === view.currentSeat)?.name ?? "";

  let text: string;
  switch (view.pending?.type) {
    case "choose-swap":
      text = isMine ? "入れ替える札を2枚えらんでください" : `${name}さんが入れ替え中…`;
      break;
    case "choose-peek":
      text = isMine ? "のぞく札を1枚えらんでください" : `${name}さんがのぞき見中…`;
      break;
    case "resolve":
      text = "そろっているか確認中…";
      break;
    default:
      text = isMine ? "あなたの番です。2枚めくってください" : `${name}さんの番です`;
  }

  return (
    <p
      className={cn(
        "rounded-xl px-4 py-2 text-center text-lg font-bold tall:text-xl",
        isMine ? "bg-yellow-400 text-gray-900" : "bg-green-900/60 text-white",
      )}
      role="status"
    >
      {text}
    </p>
  );
}
