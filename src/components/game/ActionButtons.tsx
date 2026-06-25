/**
 * 操作ボタン「出す」「パス」（プレゼンテーショナル）。
 *
 * シニア向けに大きく・高コントラスト（最小タップ領域 60px 以上）。
 * 「出す」は出せるカードを選択しているときのみ活性。
 */
export interface ActionButtonsProps {
  /** 選択中カードが出せる状態か（出すボタンの活性条件）。 */
  canPlay: boolean
  onPlay: () => void
  onPass: () => void
}

export default function ActionButtons({
  canPlay,
  onPlay,
  onPass,
}: ActionButtonsProps) {
  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        className="min-h-[60px] min-w-[120px] rounded-xl bg-sky-600 px-6 text-xl font-bold text-white shadow-md transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        出す
      </button>
      <button
        type="button"
        onClick={onPass}
        className="min-h-[60px] min-w-[120px] rounded-xl bg-amber-600 px-6 text-xl font-bold text-white shadow-md transition-colors hover:bg-amber-500"
      >
        パス（出せないとき）
      </button>
    </div>
  )
}
