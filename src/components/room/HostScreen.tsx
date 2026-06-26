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

export function HostScreen() {
  useGotoRoomOnStart();
  const roomId = useGameStore((s) => s.roomId);
  const lastError = useGameStore((s) => s.lastError);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const createRoom = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await ensureConnected();
      useGameStore.getState().clearError();
      await useGameStore.getState().createRoom(name.trim());
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
