"use client";

// シニア向けテキスト入力（§3.7）。大きめ・高コントラスト枠・ラベル必須・focus リング。
// 名前入力・合言葉入力で使う。制御コンポーネント。

import { type InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  label: string;
  /** ラベルのカッコ補足（例「4桁の数字」）。 */
  hint?: string;
}

export function Input({ value, onChange, label, hint, id, className, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-base font-bold">
        {label}
        {hint && <span className="ml-1 font-normal text-foreground/60">（{hint}）</span>}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-h-tap rounded-xl border-2 border-gray-400 bg-background px-4 text-lg text-foreground",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary",
          "dark:border-gray-500",
          className,
        )}
        {...props}
      />
    </div>
  );
}
