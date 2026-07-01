"use client";

// 神経衰弱の対局画面オーケストレータ（フェーズ4A）。
// ※本ファイルは 4A-1 の暫定プレースホルダ。盤面グリッド/得点/結果は 4A-3・4A-4 で実装する。

import { useGameConnection } from "@/lib/store/useGameConnection";
import { useBgm } from "@/lib/audio/useBgm";
import { useGameStore } from "@/lib/store/gameStore";
import { isConcentrationView } from "@/lib/concentration/view";
import { ScreenContainer } from "@/components/ui";

export function ConcentrationBoard({ roomId }: { roomId: string }) {
  useGameConnection(); // 遷移で socket を落とさない
  useBgm();
  const gameState = useGameStore((s) => s.gameState);
  const view = gameState && isConcentrationView(gameState) ? gameState : null;

  return (
    <ScreenContainer showRotateHint wide className="grid min-h-dvh place-items-center bg-green-800 text-white">
      <div className="text-center">
        <p className="text-2xl font-bold">神経衰弱（準備中）</p>
        <p className="mt-2 text-white/70" data-room={roomId}>
          {view ? `場: ${view.slots.length}枚 / 手番: 席${view.currentSeat}` : "接続中…"}
        </p>
      </div>
    </ScreenContainer>
  );
}
