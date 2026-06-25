import { describe, it, expect } from 'vitest'
import { computeStandings, standingLabel } from './ranking'
import { initBoard } from './board'
import type { GameState, Player } from './state'

function player(over: Partial<Player>): Player {
  return {
    id: over.id ?? 'p',
    name: over.name ?? 'P',
    seat: over.seat ?? 0,
    hand: [],
    passesLeft: 0,
    status: 'playing',
    ...over,
  }
}

function state(players: Player[]): GameState {
  return {
    players,
    board: initBoard('diamond7'),
    currentSeat: 0,
    phase: 'ended',
    startMode: 'diamond7',
    maxPass: 3,
  }
}

describe('computeStandings', () => {
  it('全員上がり: rank 昇順に並ぶ', () => {
    const s = state([
      player({ id: 'a', seat: 0, status: 'finished', rank: 3 }),
      player({ id: 'b', seat: 1, status: 'finished', rank: 1 }),
      player({ id: 'c', seat: 2, status: 'finished', rank: 4 }),
      player({ id: 'd', seat: 3, status: 'finished', rank: 2 }),
    ])
    expect(computeStandings(s).map((x) => x.player.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(computeStandings(s).map((x) => x.rank)).toEqual([1, 2, 3, 4])
  })

  it('上がり＋脱落混在: 上がりが上位、脱落はその下', () => {
    const s = state([
      player({ id: 'win1', status: 'finished', rank: 1 }),
      player({ id: 'win2', status: 'finished', rank: 2 }),
      player({ id: 'out1', status: 'eliminated', eliminatedOrder: 1 }),
      player({ id: 'out2', status: 'eliminated', eliminatedOrder: 2 }),
    ])
    const result = computeStandings(s)
    // out2 は後から脱落（長く生き残った）ので out1 より上
    expect(result.map((x) => x.player.id)).toEqual(['win1', 'win2', 'out2', 'out1'])
    // 脱落者は rank を持たず outcome='eliminated'
    const out = result.filter((x) => x.outcome === 'eliminated')
    expect(out.every((x) => x.rank === undefined)).toBe(true)
  })

  it('脱落者が複数: 後に脱落した人ほど上', () => {
    const s = state([
      player({ id: 'e1', status: 'eliminated', eliminatedOrder: 1 }),
      player({ id: 'e2', status: 'eliminated', eliminatedOrder: 2 }),
      player({ id: 'e3', status: 'eliminated', eliminatedOrder: 3 }),
    ])
    expect(computeStandings(s).map((x) => x.player.id)).toEqual(['e3', 'e2', 'e1'])
  })

  it('進行中(playing)が残っていても例外を投げず末尾に置く', () => {
    const s = state([
      player({ id: 'win', status: 'finished', rank: 1 }),
      player({ id: 'busy', status: 'playing' }),
      player({ id: 'out', status: 'eliminated', eliminatedOrder: 1 }),
    ])
    const result = computeStandings(s)
    expect(result.map((x) => x.player.id)).toEqual(['win', 'out', 'busy'])
    expect(result[2].outcome).toBe('playing')
  })

  it('構造が結果画面で使える形（player 参照・outcome・rank）', () => {
    const s = state([player({ id: 'a', name: 'Alice', status: 'finished', rank: 1 })])
    const top = computeStandings(s)[0]
    expect(top.player.name).toBe('Alice')
    expect(top.outcome).toBe('finished')
    expect(top.rank).toBe(1)
  })
})

describe('standingLabel', () => {
  it('上がりは「N位」、脱落は「脱落」、進行中は「—」', () => {
    expect(
      standingLabel({ player: player({}), outcome: 'finished', rank: 2 }),
    ).toBe('2位')
    expect(standingLabel({ player: player({}), outcome: 'eliminated' })).toBe('脱落')
    expect(standingLabel({ player: player({}), outcome: 'playing' })).toBe('—')
  })
})
