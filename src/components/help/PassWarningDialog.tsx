"use client";

// 無駄パス警告ダイアログ（docs/15・REQUIREMENTS 3.3）。
// お助けON時、出せる札があるのにパスしようとしたら確認する。
// 汎用 ConfirmDialog（#16）に委譲し、文言だけ与える。

import { ConfirmDialog } from "@/components/ui";

export interface PassWarningDialogProps {
  open: boolean;
  /** 「パスする」確定。 */
  onConfirm: () => void;
  /** 「やめる」／Esc／背景クリックでキャンセル。 */
  onCancel: () => void;
}

export function PassWarningDialog({ open, onConfirm, onCancel }: PassWarningDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="出せる札がありますが、パスしますか？"
      message="いま出せるカードが手札にあります。パスすると残りのパス回数が減ります。"
      confirmLabel="パスする"
      cancelLabel="やめる"
      confirmVariant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
