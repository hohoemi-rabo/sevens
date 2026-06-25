/**
 * 自分（現在の手番）の手札表示（プレゼンテーショナル）。
 *
 * 出せる札はハイライト＋クリック可、出せない札はグレーアウト＆クリック不可。
 * 選択中のカードは持ち上げ表示。実際の状態更新は親（GameTable）が行う。
 */
import { cardId, SUITS, type Card as CardType } from '@/lib/sevens/cards'
import { playableCards } from '@/lib/sevens/playable'
import type { BoardState } from '@/lib/sevens/board'
import Card from './Card'

export interface HandCardsProps {
  hand: CardType[]
  board: BoardState
  selectedId: string | null
  onSelect: (card: CardType) => void
  /** 自分の手番でないときは選択・ハイライトを無効化する。 */
  disabled?: boolean
}

/** スート順→ランク昇順で手札を並べる（見やすさのため）。 */
function sortHand(hand: CardType[]): CardType[] {
  const suitOrder = (s: CardType['suit']) => SUITS.indexOf(s)
  return [...hand].sort(
    (a, b) => suitOrder(a.suit) - suitOrder(b.suit) || a.rank - b.rank,
  )
}

export default function HandCards({
  hand,
  board,
  selectedId,
  onSelect,
  disabled = false,
}: HandCardsProps) {
  const playableIds = new Set(playableCards(hand, board).map(cardId))

  return (
    <div className="flex flex-wrap items-end justify-center gap-2">
      {sortHand(hand).map((card) => {
        const id = cardId(card)
        const isPlayable = !disabled && playableIds.has(id)
        return (
          <Card
            key={id}
            card={card}
            size="lg"
            highlighted={isPlayable && selectedId !== id}
            selected={selectedId === id}
            dimmed={!isPlayable}
            onClick={isPlayable ? () => onSelect(card) : undefined}
          />
        )
      })}
    </div>
  )
}
