"use client";

// 音量・ミュートのコントロール（docs/14・REQUIREMENTS 4.1 右上 [音量]）。
// 端末ごとに音量を調整・ミュートできる。設定は audioStore（sessionStorage 永続）に保存。
// シニア配慮: ミュートボタンは最小60×60pxタップ、アイコン＋文字、高コントラスト。

import { useAudioStore } from "@/lib/store/audioStore";
import { cn } from "@/lib/cn";

export function AudioControls({ className }: { className?: string }) {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl bg-green-900/60 px-3 py-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? "ミュート解除" : "ミュート"}
        className={cn(
          "inline-flex min-h-tap min-w-tap items-center justify-center gap-2 rounded-xl px-3 text-base font-bold",
          "transition-colors active:scale-[0.98] select-none",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-yellow-300",
          muted ? "bg-gray-200 text-gray-900" : "bg-yellow-400 text-black hover:bg-yellow-300",
        )}
      >
        <span aria-hidden className="text-xl">
          {muted ? "🔇" : "🔊"}
        </span>
        <span>{muted ? "音オフ" : "音オン"}</span>
      </button>

      <label className="flex items-center gap-2 text-sm font-bold text-white">
        <span className="sr-only">音量</span>
        <span aria-hidden>音量</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          disabled={muted}
          aria-label="音量"
          className="h-3 w-28 cursor-pointer accent-yellow-400 disabled:opacity-50"
        />
      </label>
    </div>
  );
}
