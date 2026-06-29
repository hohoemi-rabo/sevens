/**
 * 中央の場（4スートの並び）の表示（プレゼンテーショナル）。
 *
 * REQUIREMENTS 4.1/4.2: A〜K を横一列の固定13列で並べ、7を中央基準にして左右に伸びる様子を
 * 直感的に見せる。配置済みランクはカード、未配置はうっすい空きスロットで「これから伸びる場所」を示す。
 * 脱落で飛んだ札（隙間）は空きスロットのまま残るので、本来ルールの「隙間」も自然に表現される。
 * 横長最優先。狭い画面は横スクロール（タブレット対応）。
 */
import { SUITS, RANKS, SUIT_LABEL, isRedSuit, type Suit, type Rank } from '@/lib/sevens/cards'
import type { BoardState } from '@/lib/sevens/board'
import Card from './Card'

const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

/** 場の短いランク表記（A/2..10/J/Q/K）。読み上げ用の RANK_LABEL とは別（視認性優先）。 */
const shortRank = (rank: Rank): string =>
  (({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }) as Record<number, string>)[rank] ?? String(rank)

const PIVOT: Rank = 7

function SuitRow({
  suit,
  pile,
  hideCardId,
}: {
  suit: Suit
  pile: readonly Rank[]
  /** 出す演出中、着地まで隠す札の id（`${suit}${rank}`＝cardId 形式）。 */
  hideCardId?: string | null
}) {
  const placed = new Set<number>(pile)
  const color = isRedSuit(suit) ? 'text-red-600' : 'text-gray-100'

  return (
    <div className="flex items-center gap-3">
      <div className={`flex w-12 shrink-0 items-center justify-center text-3xl font-bold ${color}`}>
        {SUIT_SYMBOL[suit]}
        <span className="sr-only">{SUIT_LABEL[suit]}</span>
      </div>
      <div className="flex items-center gap-1">
        {RANKS.map((rank) => {
          const slot = `${suit}${rank}` // cardId と同形式（例: d7）
          if (placed.has(rank)) {
            // 飛行アニメ中の札は着地まで隠す（同サイズの透明枠でレイアウト維持）。
            if (slot === hideCardId) {
              return <div key={rank} aria-hidden className="h-[90px] w-16" />
            }
            return <Card key={rank} card={{ suit, rank }} size="bd" />
          }
          const isPivot = rank === PIVOT
          return (
            <div
              key={rank}
              aria-hidden
              data-board-slot={slot}
              className={`flex h-[90px] w-16 items-center justify-center rounded-lg border-2 border-dashed text-base font-bold ${
                isPivot ? 'border-yellow-400/80 text-yellow-300' : 'border-white/20 text-white/30'
              }`}
            >
              {shortRank(rank)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Board({
  board,
  hideCardId,
}: {
  board: BoardState
  /** 出す演出中、着地まで盤面で隠す札の id（cardId）。 */
  hideCardId?: string | null
}) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-green-900/40 p-3">
      {/* 中身は自然な幅（w-max）のまま、背景ボックス内で中央寄せ（mx-auto）。
          画面が狭く収まらないときは overflow-x-auto で横スクロールに切り替わる。 */}
      <div className="mx-auto flex w-max flex-col gap-2">
        {SUITS.map((suit) => (
          <SuitRow key={suit} suit={suit} pile={board[suit]} hideCardId={hideCardId} />
        ))}
      </div>
    </div>
  )
}
