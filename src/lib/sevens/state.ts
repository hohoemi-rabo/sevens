/**
 * ゲーム状態とターン進行（純粋TS）。
 *
 * 1ゲーム分の状態（プレイヤー・手札・場・手番・パス残数・順位）を保持し、
 * 「カードを出す」「パスする」操作でイミュータブルに状態遷移する。
 * これが通信層・Zustand から参照される単一の信頼できる情報源（SSOT）。
 *
 * 通信層・UIに一切依存しないこと。状態は純粋データ（関数・クラスを持たない）で、
 * JSON でシリアライズ/デシリアライズして再接続復元・通信同期できる。
 */
import { createDeck, cardId, cardsEqual, SUITS, type Card } from './cards'
import { shuffle, deal, type Rng } from './deal'
import { initBoard, place, placeForced, type BoardState, type StartMode } from './board'
import { isPlayable } from './playable'
import { willEliminateOnPass, isValidMaxPass } from './pass'

/** プレイヤーの状態。 */
export type PlayerStatus = 'playing' | 'finished' | 'eliminated'

export interface Player {
  id: string
  name: string
  /** 席番号 0..n-1。手番はこの順で進む。 */
  seat: number
  hand: Card[]
  /** 残りパス可能回数。0でパスすると脱落（手札を場に放出）。 */
  passesLeft: number
  status: PlayerStatus
  /** 上がりの確定順位（1始まり）。脱落者には付かない（08で最終順位を組み立てる）。 */
  rank?: number
  /** 脱落の発生順（1始まり）。順位(rank)とは別枠（08で利用）。 */
  eliminatedOrder?: number
}

export interface GameState {
  players: Player[]
  board: BoardState
  /** 現在の手番の席番号。phase が 'ended' のときは意味を持たない。 */
  currentSeat: number
  phase: 'playing' | 'ended'
  startMode: StartMode
  /** ホストが設定したパス可能回数（1〜5）。 */
  maxPass: number
}

export interface InitGameOptions {
  /** 参加プレイヤー。配列順に席番号 0..n-1 を割り当てる（人間＋CPUで4人想定）。 */
  players: { id: string; name: string }[]
  /** パス可能回数（1〜5）。 */
  maxPass: number
  startMode: StartMode
  /** シャッフル用RNG。テストでは seededRng を渡して決定論的にする。 */
  rng?: Rng
}

/** 場に自動配置される7を各プレイヤーの手札から取り除く。 */
function removeStartingSevens(
  hands: Card[][],
  mode: StartMode,
): { hands: Card[][]; diamondSevenSeat: number } {
  const targets =
    mode === 'diamond7'
      ? [{ suit: 'd' as const, rank: 7 as const }]
      : SUITS.map((suit) => ({ suit, rank: 7 as const }))

  let diamondSevenSeat = -1
  const nextHands = hands.map((hand, seat) => {
    const filtered = hand.filter((card) => {
      const isStarter = targets.some((t) => cardsEqual(t, card))
      if (isStarter && card.suit === 'd') diamondSevenSeat = seat
      return !isStarter
    })
    return filtered
  })
  return { hands: nextHands, diamondSevenSeat }
}

/**
 * ゲームを初期化する。配札 → 場初期化（開始7を自動配置）→ 先頭手番決定。
 * - diamond7: ♦7を持っていた人の次の席から開始（♦7の自動配置がその人の開幕手に相当）
 * - all7: 席0から開始
 */
export function initGame(opts: InitGameOptions): GameState {
  const { players, maxPass, startMode, rng } = opts
  if (!isValidMaxPass(maxPass)) {
    throw new Error(`maxPass must be 1..5: ${maxPass}`)
  }
  const playerCount = players.length

  const dealtRaw = deal(shuffle(createDeck(), rng), playerCount)
  const { hands, diamondSevenSeat } = removeStartingSevens(dealtRaw, startMode)

  const built: Player[] = players.map((p, seat) => ({
    id: p.id,
    name: p.name,
    seat,
    hand: hands[seat],
    passesLeft: maxPass,
    status: 'playing',
  }))

  const firstSeat =
    startMode === 'diamond7' && diamondSevenSeat >= 0
      ? (diamondSevenSeat + 1) % playerCount
      : 0

  return {
    players: built,
    board: initBoard(startMode),
    currentSeat: firstSeat,
    phase: 'playing',
    startMode,
    maxPass,
  }
}

/** 席番号からプレイヤーを取得（見つからなければ例外）。 */
function playerBySeat(state: GameState, seat: number): Player {
  const player = state.players.find((p) => p.seat === seat)
  if (!player) throw new Error(`No player at seat ${seat}`)
  return player
}

/** 現在の手番のプレイヤー。 */
export function currentPlayer(state: GameState): Player {
  return playerBySeat(state, state.currentSeat)
}

/** まだプレイ中（playing）のプレイヤーが残っているか。 */
function hasActivePlayers(players: Player[]): boolean {
  return players.some((p) => p.status === 'playing')
}

/**
 * 次に手番を持つ席を返す。finished/eliminated はスキップ。
 * プレイ中が誰もいなければ -1（＝対局終了）。
 */
function nextActiveSeat(players: Player[], fromSeat: number): number {
  const n = players.length
  for (let step = 1; step <= n; step++) {
    const seat = (fromSeat + step) % n
    const player = players.find((p) => p.seat === seat)
    if (player && player.status === 'playing') return seat
  }
  return -1
}

/** プレイヤーを更新した新しい players 配列を返す（非破壊）。 */
function withPlayer(players: Player[], seat: number, patch: Partial<Player>): Player[] {
  return players.map((p) => (p.seat === seat ? { ...p, ...patch } : p))
}

/** 手番を次のプレイヤーへ送り、必要なら対局終了に遷移した状態を返す。 */
function advanceTurn(state: GameState): GameState {
  if (!hasActivePlayers(state.players)) {
    return { ...state, phase: 'ended' }
  }
  const next = nextActiveSeat(state.players, state.currentSeat)
  if (next < 0) {
    return { ...state, phase: 'ended' }
  }
  return { ...state, currentSeat: next }
}

/** 次に付与する順位（既に確定している人数 + 1）。 */
function nextRank(players: Player[]): number {
  return players.filter((p) => p.rank !== undefined).length + 1
}

/**
 * カードを場に出す（イミュータブル）。
 * 合法手チェック（手番・手札所持・場に出せる）→ 場更新 → 手札除去 →
 * 手札0なら上がり（rank付与）→ 手番送り → 終了判定。
 */
export function playCard(state: GameState, playerId: string, card: Card): GameState {
  if (state.phase === 'ended') {
    throw new Error('Game already ended')
  }
  const player = currentPlayer(state)
  if (player.id !== playerId) {
    throw new Error(`Not ${playerId}'s turn`)
  }
  if (!player.hand.some((c) => cardsEqual(c, card))) {
    throw new Error(`Player does not hold ${cardId(card)}`)
  }
  if (!isPlayable(card, state.board)) {
    throw new Error(`Card ${cardId(card)} is not playable`)
  }

  const board = place(state.board, card)
  const hand = player.hand.filter((c) => !cardsEqual(c, card))

  let players: Player[]
  if (hand.length === 0) {
    players = withPlayer(state.players, player.seat, {
      hand,
      status: 'finished',
      rank: nextRank(state.players),
    })
  } else {
    players = withPlayer(state.players, player.seat, { hand })
  }

  return advanceTurn({ ...state, players, board })
}

/** 次に付与する脱落順（既に脱落した人数 + 1）。 */
function nextEliminatedOrder(players: Player[]): number {
  return players.filter((p) => p.eliminatedOrder !== undefined).length + 1
}

/**
 * パスする（イミュータブル）。
 * - 残パス回数が残っていれば1減らして手番を送る。
 * - 上限を超過するパスなら脱落: 手札を全て場に放出し（placeForced）、
 *   status を 'eliminated' にして手番から除外する（順位 rank は付けない＝08で別枠管理）。
 */
export function pass(state: GameState, playerId: string): GameState {
  if (state.phase === 'ended') {
    throw new Error('Game already ended')
  }
  const player = currentPlayer(state)
  if (player.id !== playerId) {
    throw new Error(`Not ${playerId}'s turn`)
  }

  if (willEliminateOnPass(player)) {
    const board = placeForced(state.board, player.hand)
    const players = withPlayer(state.players, player.seat, {
      hand: [],
      status: 'eliminated',
      eliminatedOrder: nextEliminatedOrder(state.players),
    })
    return advanceTurn({ ...state, players, board })
  }

  const passesLeft = player.passesLeft - 1
  const players = withPlayer(state.players, player.seat, { passesLeft })
  return advanceTurn({ ...state, players })
}

/** 状態を文字列にシリアライズする（再接続復元・通信同期用）。 */
export function serializeState(state: GameState): string {
  return JSON.stringify(state)
}

/** シリアライズした文字列から状態を復元する。 */
export function deserializeState(serialized: string): GameState {
  return JSON.parse(serialized) as GameState
}
