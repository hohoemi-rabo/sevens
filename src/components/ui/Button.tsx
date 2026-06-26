// 大型ボタン（シニア向け）。提示用なので 'use client' を付けず Server/Client 両方で使える。
// onClick 等のハンドラは呼び出し側（Client Component）から渡す。
// buttonVariants() を export し、next/link 等のボタン化にも使う（<Link className={buttonVariants(...)}>）。

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "default" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // 高コントラスト・白文字。focus-visible リングで色覚や視力に配慮。
  primary: "bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary",
  danger: "bg-danger text-white hover:bg-danger-dark focus-visible:ring-danger",
  // 副次：地と文字を固定ペアで指定し、ライト/ダーク両方で高コントラストにする。
  secondary:
    "bg-gray-100 text-gray-900 border-2 border-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-50 dark:border-gray-500 dark:hover:bg-gray-600 focus-visible:ring-gray-500",
  // 控えめ：地は透明・文字色のみ。
  ghost:
    "bg-transparent text-foreground hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-gray-400",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // 最小タップ領域 60×60px（§3.7）。min-h-tap / min-w-tap は tailwind.config の tap=60px。
  default: "min-h-tap min-w-tap px-6 text-base",
  lg: "min-h-tap min-w-tap px-8 py-4 text-lg",
};

export interface ButtonVariantOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** ボタンのクラス文字列を生成（<button> 以外＝Link 等のボタン化にも使える）。 */
export const buttonVariants = ({
  variant = "primary",
  size = "default",
}: ButtonVariantOptions = {}): string =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold",
    "transition-colors active:scale-[0.98] select-none",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
  );

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantOptions {}

export function Button({
  variant,
  size,
  className,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}
