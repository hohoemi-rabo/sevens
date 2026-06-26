"use client";

// adapter ⇄ gameStore の配線フック（docs/10）。
// store / adapterRef はモジュール singleton なので Provider は不要。クライアント境界の最上位で
// 呼び、「未接続なら LocalAdapter を生成して connect」する。
//
// 重要: アンマウントで disconnect しない。タイトル→対局のクライアント遷移で接続を維持するため
// （切ると start 直後の遷移で socket が落ちる）。disconnect は「タイトルへ戻る」明示操作のときだけ。

import { useEffect, useRef } from "react";
import { LocalAdapter } from "@/lib/adapter/local";
import { useGameStore } from "@/lib/store/gameStore";
import type { ConnectionStatus } from "@/lib/adapter/types";

/** 未接続なら一度だけ接続する。戻り値は接続状態（UIのスピナー判定用）。 */
export const useGameConnection = (): { connection: ConnectionStatus } => {
  const connection = useGameStore((s) => s.connection);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode の二重実行に備えた ref ガード（connect 自体も購読を張り直すので二重登録はしない）。
    if (started.current) return;
    if (connection === "disconnected") {
      started.current = true;
      // リロード/再読込なら sessionStorage から roomId/seat/token を復元しておく。
      // connect 後の onConnectionChange('connected') がそれを使って自動再接続する（#13）。
      useGameStore.getState().restoreSession();
      void useGameStore.getState().connect(new LocalAdapter());
    }
  }, [connection]);

  return { connection };
};
