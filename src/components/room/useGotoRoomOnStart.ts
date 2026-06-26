"use client";

// 対局開始（gameState 到着）を検知してロビーから対局画面 /room/[id] へ遷移する。
// ホスト（開始ボタン押下）・ゲスト（ホストが開始）・ひとり遊び の各導線で使う。

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/store/gameStore";

export const useGotoRoomOnStart = (): void => {
  const router = useRouter();
  const gameState = useGameStore((s) => s.gameState);
  const roomId = useGameStore((s) => s.roomId);

  useEffect(() => {
    if (gameState && roomId) router.push(`/room/${roomId}`);
  }, [gameState, roomId, router]);
};
