/**
 * 下部の操作バー（プレゼンテーショナル・REQUIREMENTS 4.1）。
 *
 * 横長レイアウト: 左=「パス（残りn回）」／中央=自分のアバター＋名前＋「待って」／右=「出す」。
 * シニア向けに大きく・高コントラスト（最小タップ領域 60px 以上）。
 * 「出す」は出せるカードを選択しているときのみ活性。「待って」はローカルの一時停止（#16）。
 */
import Avatar from './Avatar'

export interface ActionButtonsProps {
  /** 選択中カードが出せる状態か（出すボタンの活性条件）。 */
  canPlay: boolean
  onPlay: () => void
  onPass: () => void
  /** 「待って」（自分の番を一時停止＝ローカル演出）。 */
  onWait: () => void
  /** 自分の残りパス回数（ボタンに表示）。 */
  passesLeft: number
  mySeat: number
  myName: string
}

export default function ActionButtons({
  canPlay,
  onPlay,
  onPass,
  onWait,
  passesLeft,
  mySeat,
  myName,
}: ActionButtonsProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <button
        type="button"
        onClick={onPass}
        className="min-h-tap min-w-[140px] rounded-xl bg-amber-600 px-6 py-3 text-xl font-bold text-white shadow-md transition-colors hover:bg-amber-500"
      >
        パス
        <span className="ml-2 text-base font-normal">（残り{passesLeft}回）</span>
      </button>

      <div className="flex flex-col items-center gap-1">
        <Avatar seat={mySeat} name={myName} size="md" />
        <span className="text-base font-bold text-white">{myName}（あなた）</span>
        <button
          type="button"
          onClick={onWait}
          className="min-h-tap rounded-lg bg-white/90 px-4 text-base font-bold text-gray-900 shadow-sm transition-colors hover:bg-white"
        >
          ⏸ 待って
        </button>
      </div>

      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        className="min-h-tap min-w-[140px] rounded-xl bg-sky-600 px-6 py-3 text-xl font-bold text-white shadow-md transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        出す ↑
      </button>
    </div>
  )
}
