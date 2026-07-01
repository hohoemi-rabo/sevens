"use client";

/**
 * 神経衰弱の対局画面オーケストレータ（ネットワーク版・フェーズ4A）。
 *
 * サーバー権威: UI は view をミューテートせず、操作は store.send で送り次の game:state を待つ。
 * resolve（2枚めくった後の判定）はサーバーが autoResolvable で自動確定するので送らない
 * （2枚が数秒見えてから揃う/伏せ戻る＝「見せてから伏せる」）。CPU/自動進行はサーバーが担う。
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameConnection } from "@/lib/store/useGameConnection";
import { useBgm } from "@/lib/audio/useBgm";
import { useGameStore } from "@/lib/store/gameStore";
import { ScreenContainer } from "@/components/ui";
import { GameMenu } from "@/components/game/GameMenu";
import type { ConcentrationView, ViewSlot } from "@/lib/concentration/module";
import { CardGrid } from "@/components/game/concentration/CardGrid";
import { Scoreboard } from "@/components/game/concentration/Scoreboard";
import { TurnPrompt } from "@/components/game/concentration/TurnPrompt";
import { ConcentrationResult } from "@/components/game/concentration/ConcentrationResult";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <ScreenContainer className="grid min-h-dvh place-items-center bg-green-800 text-white">
      <div className="text-center text-2xl font-bold">{children}</div>
    </ScreenContainer>
  );
}

export function ConcentrationBoard() {
  useGameConnection(); // 遷移で socket を落とさない
  useBgm();

  const router = useRouter();
  // GameRouter が view 形状で神経衰弱を保証済みなので ConcentrationView に narrow。
  const view = useGameStore((s) => s.gameState as ConcentrationView | null);
  const mySeat = useGameStore((s) => s.mySeat);
  const connection = useGameStore((s) => s.connection);
  const players = useGameStore((s) => s.players);
  const dissolved = useGameStore((s) => s.dissolved);
  const send = useGameStore((s) => s.send);

  const [swapPicks, setSwapPicks] = useState<number[]>([]);

  // ホストが解散したら全員トップへ（#17）。
  useEffect(() => {
    if (dissolved) router.push("/");
  }, [dissolved, router]);

  // pending が入れ替え選択でなくなったら選択をリセット。
  const pendingType = view?.pending?.type ?? null;
  useEffect(() => {
    if (pendingType !== "choose-swap") setSwapPicks([]);
  }, [pendingType]);

  if (!view && mySeat === null) return <Centered>部屋が見つかりません</Centered>;
  if (!view || mySeat === null) return <Centered>準備中…</Centered>;

  const isMyTurn = view.phase === "playing" && view.currentSeat === mySeat;
  const isHost = players.find((p) => p.seat === mySeat)?.isHost ?? false;

  const canPick = (slot: ViewSlot): boolean => {
    if (!isMyTurn) return false;
    switch (view.pending?.type) {
      case "choose-swap":
      case "choose-peek":
        return slot.status === "facedown";
      case "resolve":
        return false;
      default:
        // 通常フリップ: まだ表になっていない伏せ札を、この手番で2枚まで。
        return slot.status === "facedown" && !view.revealed.includes(slot.pos) && view.revealed.length < 2;
    }
  };

  const onPick = (pos: number): void => {
    switch (view.pending?.type) {
      case "choose-peek":
        send({ type: "peek", pos });
        return;
      case "choose-swap": {
        const next = swapPicks.includes(pos) ? swapPicks.filter((p) => p !== pos) : [...swapPicks, pos];
        if (next.length === 2) {
          send({ type: "swap", a: next[0], b: next[1] });
          setSwapPicks([]);
        } else {
          setSwapPicks(next);
        }
        return;
      }
      case "resolve":
        return;
      default:
        send({ type: "flip", pos });
    }
  };

  const backToTitle = (): void => {
    useGameStore.getState().disconnect();
    router.push("/");
  };

  return (
    <ScreenContainer showRotateHint wide className="bg-green-800 text-white">
      <div className="fixed left-3 top-3 z-20">
        <GameMenu onBackToTitle={backToTitle} />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-3 tall:gap-4">
        {connection !== "connected" && (
          <p className="rounded-xl bg-amber-500 px-4 py-2 text-center font-bold text-gray-900" role="status">
            接続が切れています。再接続しています…
          </p>
        )}

        <Scoreboard players={view.players} currentSeat={view.currentSeat} mySeat={mySeat} />

        {view.phase === "ended" ? (
          <ConcentrationResult view={view} mySeat={mySeat} isHost={isHost} onLeave={backToTitle} />
        ) : (
          <>
            <TurnPrompt view={view} mySeat={mySeat} />
            <CardGrid view={view} swapPicks={swapPicks} canPick={canPick} onPick={onPick} />
          </>
        )}
      </div>
    </ScreenContainer>
  );
}
