"use client";

// 入室画面（REQUIREMENTS 3.6-3）。合言葉→名前→入室（席は自動割り当て）→待機。
// QR由来の ?code= を合言葉の初期値にする。開始時の遷移は useGotoRoomOnStart。

import { useState } from "react";
import Link from "next/link";
import { ensureConnected } from "@/lib/adapter/connect";
import { useGameStore } from "@/lib/store/gameStore";
import { Button, Heading, Input, ScreenContainer, buttonVariants } from "@/components/ui";
import { PlayerList } from "@/components/room/PlayerList";
import { useGotoRoomOnStart } from "@/components/room/useGotoRoomOnStart";

export function JoinScreen({ code }: { code?: string }) {
  useGotoRoomOnStart();
  const mySeat = useGameStore((s) => s.mySeat);
  const lastError = useGameStore((s) => s.lastError);
  const [passcode, setPasscode] = useState(code ?? "");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  const join = async () => {
    if (passcode.trim().length === 0 || name.trim().length === 0) return;
    setJoining(true);
    try {
      await ensureConnected();
      useGameStore.getState().clearError();
      await useGameStore.getState().joinRoom(passcode.trim(), name.trim());
    } finally {
      setJoining(false);
    }
  };

  // 入室済み → 待機ロビー
  if (mySeat !== null) {
    return (
      <ScreenContainer>
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6">
          <Heading level={1} className="text-2xl">
            入室しました
          </Heading>
          <p className="text-base">あなたは {mySeat + 1} 番です。</p>
          <div className="w-full">
            <Heading level={3} className="mb-2">
              参加者
            </Heading>
            <PlayerList />
          </div>
          <p className="text-lg font-bold">ホストが始めるのを待っています…</p>
        </div>
      </ScreenContainer>
    );
  }

  // 未入室 → フォーム
  return (
    <ScreenContainer>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6">
        <Heading level={1} className="text-2xl">
          部屋に入る
        </Heading>
        <Input
          label="合言葉"
          hint="4桁の数字"
          value={passcode}
          onChange={(v) => setPasscode(v.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="0000"
          className="w-full tracking-[0.3em]"
        />
        <Input
          label="あなたの名前"
          hint="ひらがなでもOK"
          value={name}
          onChange={setName}
          maxLength={12}
          placeholder="たろう"
          className="w-full"
        />
        <Button
          variant="primary"
          size="lg"
          onClick={join}
          disabled={joining || passcode.trim().length === 0 || name.trim().length === 0}
        >
          {joining ? "入室中…" : "入る"}
        </Button>
        {lastError && (
          <p role="alert" className="text-base text-danger">
            {lastError.message}
          </p>
        )}
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "default" })}>
          もどる
        </Link>
      </div>
    </ScreenContainer>
  );
}
