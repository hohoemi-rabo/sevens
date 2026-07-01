/**
 * カード1枚の表示（プレゼンテーショナル）。
 *
 * 04 で生成した public/cards/*.svg を plain <img> で描画する。
 * 出せる/出せない等の状態表現は UI 側スタイルで行う（04方針）。
 * クリック等のインタラクションは親（Client Component）から onClick で受け取る。
 */
import { cardId, type Card as CardType } from '@/lib/sevens/cards'

const SIZE = {
  sm: 'w-12 h-[67px]', // 小さめ（48x67）
  bd: 'w-12 h-[67px] tall:w-16 tall:h-[90px]', // 場（盤面）。短い画面=48x67／背の高い画面=64x90
  md: 'w-[72px] h-[101px]', // 相手枚数など
  lg: 'w-20 h-28', // 手札（80x112, タップ領域60px以上）
} as const

export interface CardProps {
  /** 表向きのカード。未指定なら裏面を表示する。 */
  card?: CardType
  size?: keyof typeof SIZE
  /** 出せる札の強調（リング）。 */
  highlighted?: boolean
  /** 出せない札の抑制（グレーアウト）。 */
  dimmed?: boolean
  /** 選択中（少し持ち上げ＋リング）。 */
  selected?: boolean
  onClick?: () => void
}

export default function Card({
  card,
  size = 'lg',
  highlighted = false,
  dimmed = false,
  selected = false,
  onClick,
}: CardProps) {
  const src = card ? `/cards/${cardId(card)}.svg` : '/cards/back.svg'
  const alt = card ? `${card.suit}${card.rank}` : 'card back'

  const classes = [
    SIZE[size],
    'rounded-lg bg-white shadow-md select-none transition-transform',
    // マウス前提（4.2）: クリック可なら hover で持ち上げ＋リング。選択中は hover 効果を出さない。
    onClick ? 'cursor-pointer' : '',
    onClick && !selected ? 'hover:-translate-y-1 hover:ring-2 hover:ring-sky-300' : '',
    highlighted ? 'ring-4 ring-yellow-400' : '',
    selected ? '-translate-y-3 ring-4 ring-sky-500' : '',
    dimmed ? 'opacity-40 grayscale' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVGは最適化不要、plain img で十分
    <img
      src={src}
      alt={alt}
      draggable={false}
      onClick={onClick}
      // 出す演出（手元→置き場の飛行）で位置採寸するための識別子。表向きのときのみ。
      data-card-id={card ? cardId(card) : undefined}
      className={classes}
    />
  )
}
