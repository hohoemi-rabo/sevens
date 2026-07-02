"use client";

// ホスト画面。roomId が無ければ名前入力フォーム、作成後はロビー。
// 名前→connect→createRoom で roomId が入りロビーへ。開始時の遷移は useGotoRoomOnStart。

import { useState } from "react";
import Link from "next/link";
import { ensureConnected } from "@/lib/adapter/connect";
import { useGameStore } from "@/lib/store/gameStore";
import { Button, Heading, Input, ScreenContainer, buttonVariants } from "@/components/ui";
import { HostLobby } from "@/components/room/HostLobby";
import { useGotoRoomOnStart } from "@/components/room/useGotoRoomOnStart";
import { cn } from "@/lib/cn";

const GAMES = [
  { id: "sevens", label: "7並べ", hint: "カードを7から順につなげる" },
  { id: "concentration", label: "神経衰弱", hint: "同じ数字の2枚を当てる" },
] as const;

export function HostScreen() {
  useGotoRoomOnStart();
  const roomId = useGameStore((s) => s.roomId);
  const lastError = useGameStore((s) => s.lastError);
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState<"sevens" | "concentration">("sevens");
  const [seatCount, setSeatCount] = useState(4); // 神経衰弱の人数（2〜4）。7並べは4固定。
  const [creating, setCreating] = useState(false);

  const isConcentration = gameId === "concentration";

  const createRoom = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await ensureConnected();
      useGameStore.getState().clearError();
      // 7並べは4人固定＝seatCount 省略（サーバー側で4にクランプ）。神経衰弱のみ人数を渡す。
      await useGameStore.getState().createRoom(name.trim(), gameId, isConcentration ? seatCount : undefined);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenContainer>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6">
        {roomId ? (
          <HostLobby />
        ) : (
          <>
            <Heading level={1} className="text-2xl">
              部屋を作る
            </Heading>

            <div className="w-full">
              <p className="mb-2 text-base font-bold text-foreground">遊ぶゲーム</p>
              <div className="flex gap-3">
                {GAMES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGameId(g.id)}
                    aria-pressed={gameId === g.id}
                    className={cn(
                      "flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-3 py-3 text-center transition-colors",
                      gameId === g.id
                        ? "border-primary bg-primary text-white"
                        : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
                    )}
                  >
                    <span className="text-lg font-bold">{g.label}</span>
                    <span className="text-xs font-normal opacity-80">{g.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {isConcentration && (
              <div className="w-full">
                <p className="mb-2 text-base font-bold text-foreground">人数</p>
                <div className="flex gap-2">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSeatCount(n)}
                      aria-pressed={seatCount === n}
                      className={cn(
                        "min-h-tap flex-1 rounded-xl border-2 py-3 text-lg font-bold transition-colors",
                        seatCount === n
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
                      )}
                    >
                      {n}人
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-sm text-gray-500">足りない人数はCPUが入ります。</p>
              </div>
            )}

            <Input
              label="あなたの名前"
              hint="ひらがなでもOK"
              value={name}
              onChange={setName}
              maxLength={12}
              placeholder="せんせい"
              className="w-full"
            />
            <Button
              variant="primary"
              size="lg"
              onClick={createRoom}
              disabled={creating || !name.trim()}
            >
              {creating ? "作成中…" : "部屋を作る"}
            </Button>
            {lastError && (
              <p role="alert" className="text-base text-danger">
                {lastError.message}
              </p>
            )}
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "default" })}>
              もどる
            </Link>
          </>
        )}
      </div>
    </ScreenContainer>
  );
}
