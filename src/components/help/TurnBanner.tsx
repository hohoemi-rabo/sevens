// ターン通知（docs/15・REQUIREMENTS 3.3）。
// 自分の番が来たことを明示する。お助けON時は大きく強調（色＋点滅）、OFF時は控えめ表示。
// 相手の手番中は誰が考え中かを両モード共通で表示する。
// プレゼンテーショナル（状態は親=GameBoard が判定して渡す）。

import { cn } from "@/lib/cn";

export interface TurnBannerProps {
  isMyTurn: boolean;
  helpMode: boolean;
  /** 相手の手番のときの相手名（自分の手番なら無視）。 */
  currentName?: string;
  /** 自分の残りパス回数（強調表示用）。 */
  passesLeft: number;
}

export function TurnBanner({ isMyTurn, helpMode, currentName, passesLeft }: TurnBannerProps) {
  if (!isMyTurn) {
    return (
      <div className="text-xl">
        <span className="font-bold text-yellow-300">{currentName}</span>
        さんが考え中…
      </div>
    );
  }

  // 残りパス0は警告色（お助けON時に強調）。
  const passEmphasis = helpMode
    ? passesLeft <= 0
      ? "text-rose-300"
      : "text-yellow-300"
    : "text-yellow-300";

  if (helpMode) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="animate-pulse rounded-xl bg-emerald-500 px-6 py-2 text-2xl font-extrabold text-white shadow-md">
          あなたの番です！
        </div>
        <div className="text-lg">
          残りパス <span className={cn("text-2xl font-extrabold", passEmphasis)}>{passesLeft}</span> 回
        </div>
      </div>
    );
  }

  // お助けOFF: 最低限の通知のみ。
  return (
    <div className="text-xl">
      あなたの番です（残りパス <span className={cn("font-bold", passEmphasis)}>{passesLeft}</span> 回）
    </div>
  );
}
