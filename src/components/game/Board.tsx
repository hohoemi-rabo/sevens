/**
 * 中央の場（4スートの並び）の表示（プレゼンテーショナル）。
 *
 * 各スートを1行で表示し、配置済みのランク（昇順）を小さめのカードで描画する。
 * 未着手（空配列）のスートは空のプレースホルダを示す。
 * 隙間（脱落で放出された飛んだ札）の見せ方の作り込みは 16 で行う。
 */
import { SUITS, SUIT_LABEL, isRedSuit } from '@/lib/sevens/cards'
import type { BoardState } from '@/lib/sevens/board'
import Card from './Card'

export default function Board({ board }: { board: BoardState }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-green-900/40 p-4">
      {SUITS.map((suit) => {
        const pile = board[suit]
        const color = isRedSuit(suit) ? 'text-red-500' : 'text-gray-100'
        return (
          <div key={suit} className="flex items-center gap-3">
            <div className={`w-20 shrink-0 text-lg font-bold ${color}`}>
              {SUIT_LABEL[suit]}
            </div>
            <div className="flex min-h-[67px] flex-wrap items-center gap-1">
              {pile.length === 0 ? (
                <span className="text-sm text-gray-300">（まだ出ていません）</span>
              ) : (
                pile.map((rank) => (
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
