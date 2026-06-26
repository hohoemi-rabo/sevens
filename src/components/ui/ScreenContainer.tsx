// 画面レイアウトの土台（提示用・directiveなし）。
// 横画面（ランドスケープ）基本＋縦でも崩れない最低限のレスポンシブ。
// 縦持ち時の「横にしてください」ヒントは CSS のみ（portrait:/landscape:）で出し分け＝JS不要。

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ScreenContainerProps {
  className?: string;
  children: ReactNode;
  /** 縦持ち時に「横にしてください」ヒントを表示する（既定 false）。対局画面で使う想定。 */
  showRotateHint?: boolean;
}

export function ScreenContainer({
  className,
  children,
  showRotateHint = false,
}: ScreenContainerProps) {
  return (
    <div className={cn("min-h-dvh w-full bg-background text-foreground", className)}>
      {showRotateHint && (
        <p
          className="portrait:block landscape:hidden bg-primary px-4 py-2 text-center text-base text-white"
          role="status"
        >
          画面を横にすると見やすくなります
        </p>
      )}
      <div className="mx-auto w-full max-w-5xl px-4 py-6 landscape:px-8">{children}</div>
    </div>
  );
}
