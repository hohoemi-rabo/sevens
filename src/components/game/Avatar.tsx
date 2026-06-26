/**
 * プレイヤーアバター表示（プレゼンテーショナル）。
 *
 * 席番号から生成済みSVG（public/avatars/）を選び、plain <img> で描画する（04のカードと同方針）。
 * 切断中は淡色＋グレースケールで「いない感」を出す。サイズは数段から選択。
 */
import { avatarSrcForSeat } from '@/lib/avatar'
import { cn } from '@/lib/cn'

const SIZE = {
  sm: 'w-12 h-12', // 48px
  md: 'w-16 h-16', // 64px
  lg: 'w-20 h-20', // 80px
} as const

export interface AvatarProps {
  seat: number
  /** 読み上げ・代替テキスト用の名前。 */
  name: string
  size?: keyof typeof SIZE
  /** 切断中は淡色＋グレースケール。 */
  dimmed?: boolean
  className?: string
}

export default function Avatar({ seat, name, size = 'md', dimmed = false, className }: AvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVGは最適化不要、plain img で十分
    <img
      src={avatarSrcForSeat(seat)}
      alt={name}
      draggable={false}
      className={cn(
        SIZE[size],
        'shrink-0 rounded-full bg-white shadow-sm select-none',
        dimmed && 'opacity-40 grayscale',
        className,
      )}
    />
  )
}
