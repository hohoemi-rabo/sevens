// 見出し。シニア向けに大きめ・太字・高コントラスト。level で h1/h2/h3 を出し分ける。

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface HeadingProps {
  level?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}

const LEVEL_CLASSES: Record<NonNullable<HeadingProps["level"]>, string> = {
  1: "text-2xl",
  2: "text-xl",
  3: "text-lg",
};

export function Heading({ level = 2, className, children }: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag className={cn("font-bold text-foreground", LEVEL_CLASSES[level], className)}>
      {children}
    </Tag>
  );
}
