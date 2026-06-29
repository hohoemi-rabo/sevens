"use client";

// 「ひとりで遊ぶ」1タップ導線。部屋を自動作成→CPU補完→即開始して対局画面へ。
// 設定なしで遊べるよう、パス回数3・CPU弱の既定で start する。

import { useState } from "react";
import { ensureConnected } from "@/lib/adapter/connect";
import { useGameStore } from "@/lib/store/gameStore";
import { Button } from "@/components/ui";
import { useGotoRoomOnStart } from "@/components/room/useGotoRoomOnStart";

export function SoloStartButton() {
  useGotoRoomOnStart(); // start 成功（gameState 到着）で /room/[id] へ
  const [starting, setStarting] = useState(false);

  const startSolo = async () => {
    setStarting(true);
    try {
      await ensureConnected();
      const store = useGameStore.getState();
      store.clearError();
      // 既に部屋に居なければ作る（冪等：連打しても二重作成しない）。
      if (!store.roomId) await store.createRoom("あなた");
      await useGameStore.getState().start({
        fillWithCpu: true,
        maxPass: 3,
        startMode: "all7", // シニア向けに分かりやすい「7を全部並べてスタート」を既定に
        cpuStrength: "weak",
      });
      if (useGameStore.getState().lastError) setStarting(false);
    } catch {
      setStarting(false);
    }
  };

  return (
    <Button variant="secondary" size="lg" onClick={startSolo} disabled={starting}>
      {starting ? "準備中…" : "ひとりで遊ぶ（CPU3人）"}
    </Button>
  );
}
