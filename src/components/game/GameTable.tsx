'use client'

/**
 * 対局画面のコンテナ（唯一の状態保持＝Client Component の境界）。
 *
 * 03 のゲームロジック（純関数）を useState で保持し、出す/パスで状態遷移する。
 * 通信なし・ローカル単独。CPU未実装のため「ホットシート」: 常に現在の手番の
 * プレイヤーの手札を表示し、1人で全員分を操作して最後まで進められる
 *（06で席1〜3をCPUに置換予定）。状態は後段で Zustand store に載せ替える。
 */
import { useState } from 'react'
import {
  initGame,
  playCard,
  pass,
  currentPlayer,
  type GameState,
} from '@/lib/sevens/state'
import { isPlayable } from '@/lib/sevens/playable'
import { cardId, type Card } from '@/lib/sevens/cards'
import Board from './Board'
import HandCards from './HandCards'
import ActionButtons from './ActionButtons'
import OpponentArea from './OpponentArea'

// CPUキャラ名は仮置き（REQUIREMENTS 3.4）。06でCPU実装と紐づける。
const PLAYERS = [
  { id: 'you', name: 'あなた' },
  { id: 'cpu1', name: 'りつこ' },
  { id: 'cpu2', name: 'ハジメ' },
  { id: 'cpu3', name: 'ミミ' },
]

function newGame(): GameState {
  return initGame({ players: PLAYERS, maxPass: 3, startMode: 'diamond7' })
}

export default function GameTable() {
  const [state, setState] = useState<GameState>(newGame)
  const [selected, setSelected] = useState<Card | null>(null)

  const ended = state.phase === 'ended'
  const current = ended ? null : currentPlayer(state)
  const canPlay = !!selected && !!current && isPlayable(selected, state.board)

  function handlePlay() {
    if (!selected || !current) return
    try {
      setState(playCard(state, current.id, selected))
      setSelected(null)
    } catch {
      // 不正手（手番違い・出せない札）は無視。お助けの警告は15で実装。
    }
  }

  function handlePass() {
    if (!current) return
    setState(pass(state, current.id))
    setSelected(null)
  }

  function handleRestart() {
    setState(newGame())
    setSelected(null)
  }

  const opponents = current
    ? state.players.filter((p) => p.seat !== current.seat)
    : state.players

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-green-800 p-4 text-white">
      <h1 className="text-center text-2xl font-bold">7並べ</h1>

      <OpponentArea players={opponents} currentSeat={state.currentSeat} />

      <Board board={state.board} />

      {ended ? (
        <Results state={state} onRestart={handleRestart} />
      ) : (
        current && (
          <div className="mt-auto flex flex-col items-center gap-4 rounded-2xl bg-green-900/40 p-4">
            <div className="text-xl">
              現在の手番:{' '}
              <span className="font-bold text-yellow-300">{current.name}</span>
              さん（残りパス {current.passesLeft}回）
            </div>
            <HandCards
              hand={current.hand}
              board={state.board}
              selectedId={selected ? cardId(selected) : null}
              onSelect={setSelected}
            />
            <ActionButtons
              canPlay={canPlay}
              onPlay={handlePlay}
              onPass={handlePass}
            />
          </div>
        )
      )}
    </div>
  )
}

function Results({
  state,
  onRestart,
}: {
  state: GameState
  onRestart: () => void
}) {
  const ordered = [...state.players].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
  )
  return (
    <div className="mt-auto flex flex-col items-center gap-4 rounded-2xl bg-green-900/60 p-6">
      <h2 className="text-2xl font-bold">対局終了</h2>
      <ol className="flex flex-col gap-2">
        {ordered.map((p) => (
          <li key={p.id} className="text-xl">
            <span className="font-bold text-yellow-300">
              {p.rank ? `${p.rank}位` : '—'}
            </span>{' '}
            {p.name}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onRestart}
        className="min-h-[60px] min-w-[160px] rounded-xl bg-sky-600 px-6 text-xl font-bold text-white shadow-md hover:bg-sky-500"
      >
        もう一回
      </button>
    </div>
  )
}
