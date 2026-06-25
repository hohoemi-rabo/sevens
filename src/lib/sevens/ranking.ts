/**
 * 最終順位の判定（純粋TS）。
 *
 * 03/07 で記録済みの `Player.rank`（上がり順）と `Player.eliminatedOrder`（脱落順）から、
 * 結果画面（17）でそのまま使える最終順位データを導出する。状態は変更しない派生ビュー。
 *
 * 並び順（ベスト→ワースト）:
 *   1. 上がった人を rank 昇順（1,2,…,k）
 *   2. 脱落者をその下に、eliminatedOrder 降順（後に脱落＝長く生き残った人が上）
 *   3. まだプレイ中の人は末尾（途中経過表示にも耐えるため）
 * 脱落者は数字順位を付けず「脱落」と表示する（順位とは区別）。
 */
import type { GameState, Player } from './state'

export type Outcome = 'finished' | 'eliminated' | 'playing'

export interface Standing {
  player: Player
  outcome: Outcome
  /** 上がった人のみ 1..k。脱落者・プレイ中は undefined（＝「脱落」/未確定表示）。 */
  rank?: number
}

export function computeStandings(state: GameState): Standing[] {
  const finished = state.players
    .filter((p) => p.status === 'finished')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map<Standing>((player) => ({ player, outcome: 'finished', rank: player.rank }))

  const eliminated = state.players
    .filter((p) => p.status === 'eliminated')
    .sort((a, b) => (b.eliminatedOrder ?? 0) - (a.eliminatedOrder ?? 0))
    .map<Standing>((player) => ({ player, outcome: 'eliminated' }))

  const playing = state.players
    .filter((p) => p.status === 'playing')
    .map<Standing>((player) => ({ player, outcome: 'playing' }))

  return [...finished, ...eliminated, ...playing]
}

/** 結果表示用のラベル（"1位" / "脱落" / "—"）。UIと文言を共有する。 */
export function standingLabel(standing: Standing): string {
  if (standing.outcome === 'finished' && standing.rank !== undefined) {
    return `${standing.rank}位`
  }
  if (standing.outcome === 'eliminated') {
    return '脱落'
  }
  return '—'
}
