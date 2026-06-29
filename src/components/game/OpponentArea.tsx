/**
 * 対戦相手の情報表示（プレゼンテーショナル）。
 *
 * REQUIREMENTS 4.1: 画面上部に相手3人を横並び。各相手の アバター / 名前 / 残り枚数 /
 * 残パス回数 / 手番ハイライト / 上がり・脱落 / 切断中 を示す。
 * CPU/接続状態は GameState.players には無いため、席→PlayerInfo の引き当て関数で受け取る。
 */
import type { Player } from '@/lib/sevens/state'
import type { PlayerInfo } from '@/lib/adapter/types'
import Card from './Card'
import Avatar from './Avatar'

function StatusBadge({ player, connected }: { player: Player; connected: boolean }) {
  if (player.status === 'finished') {
    return (
      <span className="rounded bg-emerald-600 px-2 py-0.5 text-sm font-bold text-white">
        {player.rank}位 あがり
      </span>
    )
  }
  if (player.status === 'eliminated') {
    return (
      <span className="rounded bg-rose-700 px-2 py-0.5 text-sm font-bold text-white">脱落</span>
    )
  }
  if (!connected) {
    return (
      <span className="rounded bg-gray-500 px-2 py-0.5 text-sm font-bold text-white">切断中…</span>
    )
  }
  return null
}

export interface OpponentAreaProps {
  /** 自分以外のプレイヤー。 */
  players: Player[]
  /** 現在の手番の席番号（ハイライト用）。 */
  currentSeat: number
  /** 席番号 → 接続/CPU 情報（gameStore の players=PlayerInfo[] から引く）。 */
  infoBySeat: (seat: number) => PlayerInfo | undefined
}

export default function OpponentArea({ players, currentSeat, infoBySeat }: OpponentAreaProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {players.map((p) => {
        const info = infoBySeat(p.seat)
        const connected = info?.connected ?? true
        const isCpu = info?.isCpu ?? false
        const isTurn = p.seat === currentSeat && p.status === 'playing'
        return (
          <div
            key={p.id}
            // 出す演出（相手→置き場の飛行）でこの席の発射位置を採寸する。
            data-opponent-seat={p.seat}
            className={`flex min-w-[170px] flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors ${
              isTurn
                ? 'border-yellow-400 bg-yellow-100 ring-4 ring-yellow-300'
                : 'border-gray-300 bg-white'
            } ${!connected ? 'opacity-70' : ''}`}
          >
            <Avatar seat={p.seat} name={p.name} size="md" dimmed={!connected} />
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-800">{p.name}</span>
              {isCpu && (
                <span className="rounded bg-sky-600 px-1.5 py-0.5 text-xs font-bold text-white">
                  CPU
                </span>
              )}
              <StatusBadge player={p} connected={connected} />
            </div>
            <div className="flex items-center gap-2">
              <Card size="md" />
              <span className="text-3xl font-bold text-gray-800">
                {p.hand.length}
                <span className="ml-1 text-base font-normal">枚</span>
              </span>
            </div>
            <div className="text-base text-gray-700">
              残りパス: <span className="font-bold">{p.passesLeft}</span>回
            </div>
          </div>
        )
      })}
    </div>
  )
}
