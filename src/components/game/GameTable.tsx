'use client'

/**
 * 対局画面のコンテナ（唯一の状態保持＝Client Component の境界）。
 *
 * 人間は席0（id 'you'）。席1〜3はCPU（弱）。03の純ロジックを useState で保持し、
 * 出す/パスで状態遷移する。CPUの手番は useEffect で1〜2秒の演出後に自動進行する
 *（REQUIREMENTS 3.4）。通信なし・ローカル単独。状態は後段で Zustand に載せ替える。
 */
import { useEffect, useState } from 'react'
import {
  initGame,
  playCard,
  pass,
  currentPlayer,
  type GameState,
} from '@/lib/sevens/state'
import { isPlayable } from '@/lib/sevens/playable'
import { decideWeak } from '@/lib/sevens/cpu'
import { cardId, type Card } from '@/lib/sevens/cards'
import Board from './Board'
import HandCards from './HandCards'
import ActionButtons from './ActionButtons'
import OpponentArea from './OpponentArea'

const HUMAN_ID = 'you'

// 席0=人間、席1〜3=CPU（弱）。名前は REQUIREMENTS 3.4 のキャラ名を仮置き。
const PLAYERS = [
  { id: HUMAN_ID, name: 'あなた' },
  { id: 'cpu1', name: 'りつこ' },
  { id: 'cpu2', name: 'ハジメ' },
  { id: 'cpu3', name: 'ミミ' },
]

/** CPUの思考演出時間（ミリ秒）。 */
const CPU_THINK_MS = 1200

function newGame(): GameState {
  return initGame({ players: PLAYERS, maxPass: 3, startMode: 'diamond7' })
}

export default function GameTable() {
  // 配札は Math.random を使うため、SSRとクライアントで結果が変わりハイドレーション不一致になる。
  // 初期ゲームはクライアントのマウント後に生成し、SSR中は決定的なプレースホルダを描画する。
  const [state, setState] = useState<GameState | null>(null)
  const [selected, setSelected] = useState<Card | null>(null)

  useEffect(() => {
    setState(newGame())
  }, [])

  // CPUの手番を自動進行（思考待ち演出つき）。
  useEffect(() => {
    if (!state || state.phase === 'ended') return
    const cur = currentPlayer(state)
    if (cur.id === HUMAN_ID) return

    const cpuId = cur.id
    const timer = setTimeout(() => {
      setState((prev) => {
        if (!prev || prev.phase === 'ended') return prev
        const p = currentPlayer(prev)
        if (p.id !== cpuId) return prev // 既に進んでいたら何もしない
        const action = decideWeak(prev, cpuId)
        try {
          return action.type === 'play'
            ? playCard(prev, cpuId, action.card)
            : pass(prev, cpuId)
        } catch {
          return pass(prev, cpuId)
        }
      })
    }, CPU_THINK_MS)

    return () => clearTimeout(timer)
  }, [state])

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-800 text-2xl font-bold text-white">
        7並べ　準備中…
      </div>
    )
  }

  const ended = state.phase === 'ended'
  const current = ended ? null : currentPlayer(state)
  const isHumanTurn = current?.id === HUMAN_ID
  const human = state.players.find((p) => p.id === HUMAN_ID)!
  const canPlay = isHumanTurn && !!selected && isPlayable(selected, state.board)

  function handlePlay() {
    if (!state || !canPlay || !selected) return
    try {
      setState(playCard(state, HUMAN_ID, selected))
      setSelected(null)
    } catch {
      // 不正手は無視（お助けの警告は15で実装）。
    }
  }

  function handlePass() {
    if (!state || !isHumanTurn) return
    setState(pass(state, HUMAN_ID))
    setSelected(null)
  }

  function handleRestart() {
    setState(newGame())
    setSelected(null)
  }

  const opponents = state.players.filter((p) => p.id !== HUMAN_ID)

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 bg-green-800 p-4 text-white">
      <h1 className="text-center text-2xl font-bold">7並べ</h1>

      <OpponentArea players={opponents} currentSeat={state.currentSeat} />

      <Board board={state.board} />

      {ended ? (
        <Results state={state} onRestart={handleRestart} />
      ) : (
        <div className="mt-auto flex flex-col items-center gap-4 rounded-2xl bg-green-900/40 p-4">
          <div className="text-xl">
            {isHumanTurn ? (
              <>
                あなたの番です（残りパス{' '}
                <span className="font-bold text-yellow-300">
                  {human.passesLeft}
                </span>
                回）
              </>
            ) : (
              <>
                <span className="font-bold text-yellow-300">
                  {current?.name}
                </span>
                さんが考え中…
              </>
            )}
          </div>

          <HandCards
            hand={human.hand}
            board={state.board}
            selectedId={selected ? cardId(selected) : null}
            onSelect={setSelected}
            disabled={!isHumanTurn || human.status !== 'playing'}
          />

          {isHumanTurn && human.status === 'playing' && (
            <ActionButtons
              canPlay={canPlay}
              onPlay={handlePlay}
              onPass={handlePass}
            />
          )}
        </div>
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
            {p.id === HUMAN_ID && '（あなた）'}
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
