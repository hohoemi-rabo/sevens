"use client";

// 汎用の確認モーダル（シニア向け・docs/16）。
// 「出す前確認」「無駄パス警告」など、はい/いいえの二択確認を共通化する。
// シニア配慮: 大きな文字・大きな2ボタン。既定フォーカスは安全側（キャンセル）。
// アクセシビリティ: role="dialog" aria-modal、Esc / 背景クリックでキャンセル。

import { useEffect, useId, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  /** 見出し（質問文）。 */
  title: string;
  /** 補足説明（任意）。 */
  message?: ReactNode;
  /** 見出しと操作の間に差し込む内容（例: 出すカードのプレビュー）。 */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** 確定ボタンの色（既定 primary。取消的な確定は danger）。 */
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  /** キャンセル／Esc／背景クリック。 */
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  children,
  confirmLabel,
  cancelLabel,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

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
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl bg-white p-6 text-center text-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-2xl font-bold">
          {title}
        </h2>
        {message && <p className="mt-3 text-base text-gray-600">{message}</p>}
        {children && <div className="mt-4 flex justify-center">{children}</div>}
        <div className="mt-6 flex justify-center gap-4">
          <Button autoFocus variant="secondary" size="lg" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} size="lg" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
