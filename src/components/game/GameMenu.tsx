"use client";

// 左上メニュー（docs/16・REQUIREMENTS 4.1）。
// 「トップへ戻る」をまとめる。出す前の確認は手札タップ時の中央ポップアップに
// 一本化したため（生徒さんプレイのFB対応）、ここに確認トグルは持たない。
// シニア配慮: 大きなボタン・高コントラスト。背景クリック/Escで閉じる軽量オーバーレイ。

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

export interface GameMenuProps {
  /** 「トップへ戻る」。退室＝接続切断＋遷移（呼び出し側で実施）。 */
  onBackToTitle: () => void;
}

export function GameMenu({ onBackToTitle }: GameMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-tap min-w-tap items-center justify-center gap-2 rounded-xl bg-white/90 px-4 text-base font-bold text-gray-900 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-white"
      >
        <span aria-hidden className="text-xl">
          ☰
        </span>
        メニュー
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="メニュー"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-gray-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold">メニュー</h2>

            <div className="mt-6 flex flex-col gap-3">
              <Button variant="secondary" size="lg" onClick={() => setOpen(false)}>
                とじる
              </Button>
              <Button variant="danger" size="lg" onClick={onBackToTitle}>
                トップへ戻る
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
