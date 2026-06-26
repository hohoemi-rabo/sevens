"use client";

// お助けモードのON/OFFトグル（docs/15・REQUIREMENTS 4.1 右上 [お助けON/OFF]）。
// デフォルトON。状態は helpStore（sessionStorage 永続・端末ごと）に保存。
// シニア配慮: 最小60×60pxタップ、状態が一目で分かる色＋文字、aria-pressed。

import { useEffect } from "react";
import { useHelpStore } from "@/lib/store/helpStore";
import { cn } from "@/lib/cn";

export function HelpToggle({ className }: { className?: string }) {
  const helpMode = useHelpStore((s) => s.helpMode);
  const toggle = useHelpStore((s) => s.toggle);
  const hydrate = useHelpStore((s) => s.hydrate);

  // マウント後に保存値へ復元（SSR は既定ON で描画 → ここで端末設定に合わせる）。
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={helpMode}
      aria-label={helpMode ? "お助けモードをオフにする" : "お助けモードをオンにする"}
      className={cn(
        "inline-flex min-h-tap min-w-tap items-center justify-center gap-2 rounded-xl px-4 text-base font-bold",
        "transition-colors active:scale-[0.98] select-none",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-emerald-300",
        helpMode ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-gray-200 text-gray-900 hover:bg-gray-300",
        className,
      )}
    >
      <span aria-hidden className="text-xl">
        {helpMode ? "💡" : "🔧"}
      </span>
      <span>お助け {helpMode ? "ON" : "OFF"}</span>
    </button>
  );
}
