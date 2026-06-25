/**
 * 対戦相手の情報表示（プレゼンテーショナル・仮）。
 *
 * 各相手の 名前 / 残り枚数 / 残パス回数 / 手番ハイライト / 上がり・脱落バッジ を示す。
 * 本格的なアバター・レイアウトは 16 で作り込む。
 */
import type { Player } from '@/lib/sevens/state'
import Card from './Card'

function StatusBadge({ player }: { player: Player }) {
  if (player.status === 'finished') {
    return (
      <span className="rounded bg-emerald-600 px-2 py-0.5 text-sm font-bold text-white">
        {player.rank}位 あがり
      </span>
    )
  }
  if (player.status === 'eliminated') {
    return (
      <span className="rounded bg-rose-700 px-2 py-0.5 text-sm font-bold text-white">
        脱落
      </span>
    )
  }
  return null
}

export interface OpponentAreaProps {
  /** 自分以外のプレイヤー。 */
  players: Player[]
  /** 現在の手番の席番号（ハイライト用）。 */
  currentSeat: number
}

export default function OpponentArea({
  players,
  currentSeat,
}: OpponentAreaProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {players.map((p) => {
        const isTurn = p.seat === currentSeat
        return (
          <div
            key={p.id}
            className={`flex min-w-[160px] flex-col items-center gap-1 rounded-xl border-2 p-3 ${
              isTurn ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-800">{p.name}</span>
              <StatusBadge player={p} />
            </div>
            <div className="flex items-center gap-2">
              <Card size="md" />
              <span className="text-2xl font-bold text-gray-800">
                {p.hand.length}
                <span className="ml-1 text-base font-normal">枚</span>
              </span>
            </div>
            <div className="text-sm text-gray-600">
              残りパス: {p.passesLeft}回
            </div>
          </div>
        )
      })}
    </div>
  )
}
