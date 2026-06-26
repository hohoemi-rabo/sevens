/**
 * ゲーム状態の差分から「鳴らすべき音イベント」を導出する純関数（DOM非依存・テスト対象）。
 *
 * クライアントは `game:state` のみを購読しており、出札/パスには専用イベントが無い。
 * そこで前後の GameState を差分して「何が起きたか」を導出する。
 * 1回のサーバー遷移＝1アクションなので差分は素直（出札 or パス or 脱落のいずれか1つ）。
 *
 * 通信層・UI・ブラウザAPIに一切依存しないこと（CLAUDE.md の3層分離方針）。
 */
import { SUITS, type Card, type Rank } from '@/lib/sevens/cards'
import type { GameState, Player } from '@/lib/sevens/state'

/** 鳴らす音の種類。`card`/`seat` は種類に応じて付く。 */
export type AudioEvent =
  | { kind: 'deal' }
  | { kind: 'play'; card: Card; seat: number }
  | { kind: 'pass'; seat: number }
  | { kind: 'finish'; seat: number }
  | { kind: 'eliminated'; seat: number }
  | { kind: 'end' }

/** 場に置かれている全カード枚数（手札+場=52 の検算に使う）。 */
function boardCount(state: GameState): number {
  return SUITS.reduce((sum, suit) => sum + state.board[suit].length, 0)
}

/** 全プレイヤーの手札合計枚数。 */
function handTotal(state: GameState): number {
  return state.players.reduce((sum, p) => sum + p.hand.length, 0)
}

/**
 * 「配り終えた直後（ターン0）」の状態か。
 * 場が初期7のみ（誰もまだ出していない）かつ手札+場=52、全員 playing であることを表す。
 * 誰かが1枚でも出していれば場 > 初期7・手札合計が減るのでこの条件を満たさない＝
 * 再接続でゲーム途中に復帰した状態では deal は鳴らない。
 * 注: diamond7 では♦7保持者だけ手札が1枚少ない等、手札枚数は席ごとに不揃いになりうる
 * ため「全員同枚数」では判定しない（場+手札=52 の不変量で判定する）。
 */
function isFreshDeal(state: GameState): boolean {
  if (state.phase !== 'playing') return false
  if (state.players.some((p) => p.status !== 'playing')) return false // 脱落/上がりが居れば途中
  const initialBoard = state.startMode === 'all7' ? SUITS.length : 1
  if (boardCount(state) !== initialBoard) return false
  return handTotal(state) + boardCount(state) === 52
}

/** prev→next で新しく場に増えたカード（1枚想定）を返す。複数あれば最初の1枚。 */
function newlyPlacedCard(prev: GameState, next: GameState): Card | null {
  for (const suit of SUITS) {
    const before = new Set<number>(prev.board[suit])
    for (const rank of next.board[suit]) {
      if (!before.has(rank)) return { suit, rank: rank as Rank }
    }
  }
  return null
}

function statusChanged(prevP: Player | undefined, nextP: Player, to: Player['status']): boolean {
  return prevP?.status !== to && nextP.status === to
}

/**
 * 前後の状態から鳴らすイベント列を導出する。
 *
 * - prev === null（セッション最初の状態）はベースライン: 配札イベントのみ判定し、
 *   出札/パス等の過去イベントは鳴らさない（再接続時の一斉再生を防ぐ）。
 * - 検出は優先順で行う（脱落を出札と誤検出しない）。1遷移で複数イベント可
 *   （例: 手札最後の1枚を出して上がり = [play, finish]）。
 */
export function diffGameState(prev: GameState | null, next: GameState): AudioEvent[] {
  if (prev === null) {
    return isFreshDeal(next) ? [{ kind: 'deal' }] : []
  }

  const events: AudioEvent[] = []

  // 脱落（placeForced で場が大量に変わるため、出札判定より先に判定する）。
  let eliminatedThisStep = false
  for (const p of next.players) {
    const prevP = prev.players.find((q) => q.seat === p.seat)
    if (statusChanged(prevP, p, 'eliminated')) {
      events.push({ kind: 'eliminated', seat: p.seat })
      eliminatedThisStep = true
    }
  }

  // 出札（脱落が無く、場に新しい札が1枚増えたとき）。
  if (!eliminatedThisStep) {
    const card = newlyPlacedCard(prev, next)
    if (card) {
      events.push({ kind: 'play', card, seat: prev.currentSeat }) // 出した本人 = 手番だった席
    } else {
      // 場が不変 = パス（誰かの passesLeft が減っている）。
      for (const p of next.players) {
        const prevP = prev.players.find((q) => q.seat === p.seat)
        if (prevP && p.passesLeft < prevP.passesLeft) {
          events.push({ kind: 'pass', seat: p.seat })
        }
      }
    }
  }

  // 上がり（出札で手札0になった場合は play と両方鳴らす）。
  for (const p of next.players) {
    const prevP = prev.players.find((q) => q.seat === p.seat)
    if (statusChanged(prevP, p, 'finished')) {
      events.push({ kind: 'finish', seat: p.seat })
    }
  }

  // 終局。
  if (prev.phase !== 'ended' && next.phase === 'ended') {
    events.push({ kind: 'end' })
  }

  return events
}
