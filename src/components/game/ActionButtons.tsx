/**
 * 画面下に固定する操作バー（プレゼンテーショナル・REQUIREMENTS 4.1）。
 *
 * 「出す」はカード選択時の中央ポップアップへ移行したため、このバーは
 * 「パス（残りn回）」と「待って」のみを持つ。`fixed bottom-0` で常に画面下に
 * 貼り付き、ノートPCでもスクロール無しに必ず押せる（生徒さんプレイのFB対応）。
 * シニア向けに大きく・高コントラスト（最小タップ領域 60px 以上）。
 * 「待って」はローカルの一時停止（#16）。
 */
import Avatar from './Avatar'

export interface ActionButtonsProps {
  onPass: () => void
  /** 「待って」（自分の番を一時停止＝ローカル演出）。 */
  onWait: () => void
  /** 自分の残りパス回数（ボタンに表示）。 */
  passesLeft: number
  mySeat: number
  myName: string
}

export default function ActionButtons({
  onPass,
  onWait,
  passesLeft,
  mySeat,
  myName,
}: ActionButtonsProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-green-700 bg-green-900/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={onPass}
          className="min-h-tap min-w-[140px] rounded-xl bg-amber-600 px-6 py-3 text-xl font-bold text-white shadow-md transition-colors hover:bg-amber-500"
        >
          パス
          <span className="ml-2 text-base font-normal">（残り{passesLeft}回）</span>
        </button>

        <div className="flex items-center gap-3">
          <Avatar seat={mySeat} name={myName} size="md" />
          <span className="hidden text-base font-bold text-white sm:inline">
            {myName}（あなた）
          </span>
        </div>

        <button
          type="button"
          onClick={onWait}
          className="min-h-tap min-w-[140px] rounded-xl bg-white/90 px-6 py-3 text-xl font-bold text-gray-900 shadow-md transition-colors hover:bg-white"
        >
          ⏸ 待って
        </button>
      </div>
    </div>
  )
}
