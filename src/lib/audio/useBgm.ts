"use client";

// BGM をゲーム画面のマウント中だけ鳴らすフック（docs/14・対局中のみ）。
// audioStore の bgmEnabled / bgmVolume / muted を購読し、bgm.ts を駆動する。
// 既定は OFF（端末ごと）。ON はメニューのトグル＝ユーザー操作なので自動再生も解禁される。
// GameBoard で一度だけマウントする想定。アンマウント（退室）で停止する。

import { useEffect } from "react";
import { useAudioStore } from "@/lib/store/audioStore";
import { playBgm, stopBgm } from "@/lib/audio/bgm";

export function useBgm(): void {
  const bgmEnabled = useAudioStore((s) => s.bgmEnabled);
  const bgmVolume = useAudioStore((s) => s.bgmVolume);
  const muted = useAudioStore((s) => s.muted);

  useEffect(() => {
    if (bgmEnabled && !muted) playBgm(bgmVolume);
    else stopBgm();
  }, [bgmEnabled, bgmVolume, muted]);

  // 退室（アンマウント）で必ず止める。
  useEffect(() => () => stopBgm(), []);
}
