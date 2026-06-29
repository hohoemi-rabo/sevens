"use client";

// BGM の ON/OFF＋専用音量スライダー（対局中のみ・端末ごと）。
// 設定は audioStore（sessionStorage 永続）に保存し、useBgm が再生を駆動する。
// 既定 OFF。スピーカーのあるホストPCだけ ON にする想定（全端末重なり回避）。
// シニア配慮: ON/OFFボタンは最小60×60pxタップ、アイコン＋文字、高コントラスト。

import { useAudioStore } from "@/lib/store/audioStore";
import { cn } from "@/lib/cn";

export function BgmControls({ className }: { className?: string }) {
  const bgmEnabled = useAudioStore((s) => s.bgmEnabled);
  const bgmVolume = useAudioStore((s) => s.bgmVolume);
  const toggleBgm = useAudioStore((s) => s.toggleBgm);
  const setBgmVolume = useAudioStore((s) => s.setBgmVolume);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl bg-green-900/60 px-3 py-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleBgm}
        aria-pressed={bgmEnabled}
        aria-label={bgmEnabled ? "BGMをオフにする" : "BGMをオンにする"}
        className={cn(
          "inline-flex min-h-tap min-w-tap items-center justify-center gap-2 rounded-xl px-3 text-base font-bold",
          "transition-colors active:scale-[0.98] select-none",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-yellow-300",
          bgmEnabled ? "bg-yellow-400 text-black hover:bg-yellow-300" : "bg-gray-200 text-gray-900",
        )}
      >
        <span aria-hidden className="text-xl">
          🎵
        </span>
        <span>BGM {bgmEnabled ? "ON" : "OFF"}</span>
      </button>

      <label className="flex items-center gap-2 text-sm font-bold text-white">
        <span className="sr-only">BGMの音量</span>
        <span aria-hidden>音量</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(bgmVolume * 100)}
          onChange={(e) => setBgmVolume(Number(e.target.value) / 100)}
          disabled={!bgmEnabled}
          aria-label="BGMの音量"
          className="h-3 w-28 cursor-pointer accent-yellow-400 disabled:opacity-50"
        />
      </label>
    </div>
  );
}
