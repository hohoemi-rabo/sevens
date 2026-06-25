/**
 * 中央の場（4スートの並び）の表示（プレゼンテーショナル）。
 *
 * 各スートを1行で表示し、low..high に並んだカードを小さめに描画する。
 * 未着手（null）のスートは空のプレースホルダを示す。
 */
import { SUITS, SUIT_LABEL, isRedSuit, type Rank } from '@/lib/sevens/cards'
import type { BoardState } from '@/lib/sevens/board'
import Card from './Card'

function rangeRanks(low: Rank, high: Rank): Rank[] {
  const ranks: Rank[] = []
  for (let r = low; r <= high; r++) ranks.push(r as Rank)
  return ranks
}

export default function Board({ board }: { board: BoardState }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-green-900/40 p-4">
      {SUITS.map((suit) => {
        const run = board[suit]
        const color = isRedSuit(suit) ? 'text-red-500' : 'text-gray-100'
        return (
          <div key={suit} className="flex items-center gap-3">
            <div className={`w-20 shrink-0 text-lg font-bold ${color}`}>
              {SUIT_LABEL[suit]}
            </div>
            <div className="flex min-h-[67px] flex-wrap items-center gap-1">
              {run === null ? (
                <span className="text-sm text-gray-300">（まだ出ていません）</span>
              ) : (
                rangeRanks(run.low, run.high).map((rank) => (
                  <Card key={rank} card={{ suit, rank }} size="sm" />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
