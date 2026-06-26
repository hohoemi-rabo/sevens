"use client";

// 無駄パス警告ダイアログ（docs/15・REQUIREMENTS 3.3）。
// お助けON時、出せる札があるのにパスしようとしたら確認する。
// シニア配慮: 大きな文字・大きな2ボタン。既定フォーカスは安全側の「やめる」。
// アクセシビリティ: role="dialog" aria-modal、Esc / 背景クリックでキャンセル。

import { useEffect } from "react";
import { Button } from "@/components/ui";

export interface PassWarningDialogProps {
  open: boolean;
  /** 「パスする」確定。 */
  onConfirm: () => void;
  /** 「やめる」／Esc／背景クリックでキャンセル。 */
  onCancel: () => void;
}

export function PassWarningDialog({ open, onConfirm, onCancel }: PassWarningDialogProps) {
  // Esc でキャンセル（開いている間のみ）。安全側ボタンへのフォーカスは autoFocus で行う。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pass-warning-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 text-center text-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pass-warning-title" className="text-2xl font-bold">
          出せる札がありますが、パスしますか？
        </h2>
        <p className="mt-3 text-base text-gray-600">
          いま出せるカードが手札にあります。パスすると残りのパス回数が減ります。
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Button autoFocus variant="secondary" size="lg" onClick={onCancel}>
            やめる
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm}>
            パスする
          </Button>
        </div>
      </div>
    </div>
  );
}
