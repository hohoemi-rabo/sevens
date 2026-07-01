"use client";

// 部屋画面のディスパッチャ（フェーズ4A）。届いた view の「形」で 7並べ / 神経衰弱の盤面を出し分ける。
// 重要: 型が確定するまで（gameState 未着 かつ ホストの gameId も不明）は中立ローディングを出す。
// 神経衰弱の view を誤って 7並べ用 GameBoard（sevens 専用 useAudioEffects/diff）に流すとクラッシュするため、
// 「どちらか分からないうちは Board を一切マウントしない」= 安全側。

import { useGameStore } from "@/lib/store/gameStore";
import { isConcentrationView } from "@/lib/concentration/view";
import { ScreenContainer } from "@/components/ui";
import { GameBoard } from "@/components/game/GameBoard";
import { ConcentrationBoard } from "@/components/game/concentration/ConcentrationBoard";

export function GameRouter({ roomId }: { roomId: string }) {
  const gameState = useGameStore((s) => s.gameState);
  const gameId = useGameStore((s) => s.gameId);
  const mySeat = useGameStore((s) => s.mySeat);

  // view が来ていれば形で確定。未着ならホストの選択（gameId）で先出し（joiner は state 到着待ち）。
  const concentration = gameState ? isConcentrationView(gameState) : gameId === "concentration";
  const sevens = gameState ? !isConcentrationView(gameState) : gameId === "sevens";

  if (concentration) return <ConcentrationBoard />;
  if (sevens) return <GameBoard roomId={roomId} />;

  // どちらとも分からない（再接続で state 到着待ち / 直アクセス）。
  return (
    <ScreenContainer className="grid min-h-dvh place-items-center bg-green-800 text-white">
      <p className="text-2xl font-bold">{mySeat === null ? "部屋が見つかりません" : "準備中…"}</p>
    </ScreenContainer>
  );
}
