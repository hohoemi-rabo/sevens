import { describe, it, expect } from 'vitest'
import {
  initGame,
  playCard,
  pass,
  currentPlayer,
  serializeState,
  deserializeState,
  type GameState,
  type Player,
} from './state'
import { initBoard, type BoardState } from './board'
import { cardId, type Card } from './cards'
import { seededRng } from './deal'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

/** 手番進行系を決定論的に試すための手作りステート（配札に依存しない）。 */
function makeState(
  hands: Card[][],
  opts?: { maxPass?: number; currentSeat?: number; board?: BoardState; wrapAround?: boolean },
): GameState {
  const maxPass = opts?.maxPass ?? 3
  const players: Player[] = hands.map((hand, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    hand,
    passesLeft: maxPass,
    status: 'playing',
  }))
  return {
    players,
    board: opts?.board ?? initBoard('diamond7'),
    currentSeat: opts?.currentSeat ?? 0,
    phase: 'playing',
    startMode: 'diamond7',
    maxPass,
    wrapAround: opts?.wrapAround ?? false,
  }
}

describe('initGame', () => {
  it('diamond7: ♦7を自動配置し、合計52枚・重複なし', () => {
    const game = initGame({
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D' },
      ],
      maxPass: 3,
      startMode: 'diamond7',
      rng: seededRng(1),
    })

    expect(game.board.d).toEqual([7])

    const handCards = game.players.flatMap((p) => p.hand.map(cardId))
    expect(handCards).toHaveLength(51) // ♦7は場へ
    expect(new Set([...handCards, 'd7']).size).toBe(52) // 重複なし

    // ♦7を持っていた人だけ12枚、他は13枚
    const counts = game.players.map((p) => p.hand.length).sort()
    expect(counts).toEqual([12, 13, 13, 13])
    // 誰の手札にも♦7は無い
    expect(handCards).not.toContain('d7')
  })

  it('diamond7: ♦7保持者の次の席から開始', () => {
    const game = initGame({
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D' },
      ],
      maxPass: 3,
      startMode: 'diamond7',
      rng: seededRng(1),
    })
    const holderSeat = game.players.find((p) => p.hand.length === 12)!.seat
    expect(game.currentSeat).toBe((holderSeat + 1) % 4)
  })

  it('all7: 4枚の7を自動配置し、席0から開始', () => {
    const game = initGame({
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
        { id: 'd', name: 'D' },
      ],
      maxPass: 5,
      startMode: 'all7',
      rng: seededRng(2),
    })
    for (const suit of ['s', 'h', 'd', 'c'] as const) {
      expect(game.board[suit]).toEqual([7])
    }
    const handCards = game.players.flatMap((p) => p.hand.map(cardId))
    expect(handCards).toHaveLength(48) // 7が4枚場へ
    expect(handCards.filter((id) => id.endsWith('7'))).toEqual([])
    expect(game.currentSeat).toBe(0)
  })

  it('全プレイヤーの残パス回数が maxPass で初期化される', () => {
    const game = initGame({
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }],
      maxPass: 4,
      startMode: 'diamond7',
      rng: seededRng(3),
    })
    expect(game.players.every((p) => p.passesLeft === 4)).toBe(true)
    expect(game.phase).toBe('playing')
  })
})

describe('initGame バリデーション', () => {
  const fourPlayers = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' },
  ]
  it('パス上限が範囲外（6・-1・非整数）は例外', () => {
    for (const maxPass of [6, -1, 2.5]) {
      expect(() =>
        initGame({ players: fourPlayers, maxPass, startMode: 'diamond7', rng: seededRng(1) }),
      ).toThrow()
    }
  })
  it('maxPass=0（無制限）は有効（例外にならない）', () => {
    expect(() =>
      initGame({ players: fourPlayers, maxPass: 0, startMode: 'diamond7', rng: seededRng(1) }),
    ).not.toThrow()
  })
})

describe('pass 無制限モード（maxPass=0）', () => {
  it('残パス0でも脱落せず、残数も減らさない（何度でもパスできる）', () => {
    // 手札は出せない札のみ（s2 は d7 起点では出せない）＝パスするしかない状況。
    let state = makeState([[c('s', 2)], [c('h', 2)]], { maxPass: 0 })
    expect(state.players[0].passesLeft).toBe(0) // 無制限は passesLeft=maxPass=0 で初期化
    for (let i = 0; i < 10; i++) {
      const seat = state.currentSeat
      const pid = state.players.find((p) => p.seat === seat)!.id
      state = pass(state, pid)
      // 誰も脱落していない・phase は継続。
      expect(state.players.every((p) => p.status === 'playing')).toBe(true)
      expect(state.phase).toBe('playing')
    }
    expect(state.players.every((p) => p.passesLeft === 0)).toBe(true)
  })
})

describe('終了後の操作は例外', () => {
  const ended = (): GameState => ({ ...makeState([[c('d', 8)], [c('h', 1)]]), phase: 'ended' })
  it('playCard は終了後に例外', () => {
    expect(() => playCard(ended(), 'p0', c('d', 8))).toThrow()
  })
  it('pass は終了後に例外', () => {
    expect(() => pass(ended(), 'p0')).toThrow()
  })
})

describe('playCard', () => {
  it('場・手札・手番を更新する', () => {
    const state = makeState([[c('d', 8), c('s', 2)], [c('h', 1)]])
    const next = playCard(state, 'p0', c('d', 8))

    expect(next.board.d).toEqual([7, 8])
    expect(next.players[0].hand.map(cardId)).toEqual(['s2'])
    expect(next.currentSeat).toBe(1)
  })

  it('非破壊（元の状態を変えない）', () => {
    const state = makeState([[c('d', 8)], [c('h', 1)]])
    playCard(state, 'p0', c('d', 8))
    expect(state.board.d).toEqual([7])
    expect(state.players[0].hand).toHaveLength(1)
  })

  it('手番でないプレイヤーは例外', () => {
    const state = makeState([[c('d', 8)], [c('h', 1)]])
    expect(() => playCard(state, 'p1', c('h', 1))).toThrow()
  })

  it('持っていない札は例外', () => {
    const state = makeState([[c('s', 2)], [c('h', 1)]])
    expect(() => playCard(state, 'p0', c('d', 8))).toThrow()
  })

  it('場に出せない札は例外', () => {
    const state = makeState([[c('d', 9)], [c('h', 1)]])
    expect(() => playCard(state, 'p0', c('d', 9))).toThrow()
  })

  it('手札を出し切ると上がり・順位が付き、以降スキップされる', () => {
    const state = makeState([[c('d', 8)], [c('d', 6)]])
    const afterP0 = playCard(state, 'p0', c('d', 8))
    expect(afterP0.players[0].status).toBe('finished')
    expect(afterP0.players[0].rank).toBe(1)
    expect(afterP0.currentSeat).toBe(1)

    // p1も出し切ると2位、全員終了でゲーム終了
    const afterP1 = playCard(afterP0, 'p1', c('d', 6))
    expect(afterP1.players[1].status).toBe('finished')
    expect(afterP1.players[1].rank).toBe(2)
    expect(afterP1.phase).toBe('ended')
  })

  it('A-Kループ有効時は K の次に A を出せる', () => {
    // ♥ 7〜K が並んだ場で p0 が ♥A を持つ（2は場に無い）
    const board: BoardState = { s: [], h: [7, 8, 9, 10, 11, 12, 13], d: [7], c: [] }
    const state = makeState([[c('h', 1)], [c('d', 8)]], { board, wrapAround: true })
    const after = playCard(state, 'p0', c('h', 1))
    expect(after.board.h).toContain(1)
    expect(after.players[0].status).toBe('finished')
  })

  it('A-Kループ無効（標準）では K の次に A を出せない', () => {
    const board: BoardState = { s: [], h: [7, 8, 9, 10, 11, 12, 13], d: [7], c: [] }
    const state = makeState([[c('h', 1)], [c('d', 8)]], { board })
    expect(() => playCard(state, 'p0', c('h', 1))).toThrow()
  })
})

describe('pass', () => {
  it('残パス回数を1減らして手番を送る', () => {
    const state = makeState([[c('s', 2)], [c('h', 1)]], { maxPass: 3 })
    const next = pass(state, 'p0')
    expect(next.players[0].passesLeft).toBe(2)
    expect(next.currentSeat).toBe(1)
  })

  it('手番でないプレイヤーのパスは例外', () => {
    const state = makeState([[c('s', 2)], [c('h', 1)]], { currentSeat: 0 })
    expect(() => pass(state, 'p1')).toThrow()
  })

  it('上限超過のパスで脱落: 手札を場に放出し、以降の手番から除外される', () => {
    // p0 は ♦9,♦10（今は出せない）を持つ。maxPass=1 で2回目のパスで脱落。
    const state = makeState([[c('d', 9), c('d', 10)], [c('h', 1)], [c('s', 2)]], {
      maxPass: 1,
      currentSeat: 0,
    })
    const once = pass(state, 'p0') // 1→0
    expect(once.players[0].status).toBe('playing')

    const out = pass({ ...once, currentSeat: 0 }, 'p0') // 超過 → 脱落
    expect(out.players[0].status).toBe('eliminated')
    expect(out.players[0].hand).toEqual([]) // 手札は空
    expect(out.players[0].eliminatedOrder).toBe(1)
    // 手札は場に放出されている（♦に9,10が隙間つきで配置）
    expect(out.board.d).toEqual([7, 9, 10])
    // 手番は脱落者をスキップして次の playing へ
    expect(out.currentSeat).toBe(1)
  })

  it('全員が上がり/脱落で対局終了', () => {
    // p0 は脱落、p1 は ♦6 を出して上がり → 全員終了
    const state = makeState([[c('s', 2)], [c('d', 6)]], { maxPass: 1, currentSeat: 0 })
    const s1 = pass(state, 'p0') // 1→0
    const s2 = pass({ ...s1, currentSeat: 0 }, 'p0') // 脱落
    expect(s2.players[0].status).toBe('eliminated')
    const s3 = playCard({ ...s2, currentSeat: 1 }, 'p1', c('d', 6)) // p1上がり
    expect(s3.players[1].status).toBe('finished')
    expect(s3.phase).toBe('ended')
  })
})

describe('currentPlayer', () => {
  it('現在の手番の席のプレイヤーを返す', () => {
    const state = makeState([[c('d', 8)], [c('h', 1)]], { currentSeat: 1 })
    expect(currentPlayer(state).id).toBe('p1')
  })
})

describe('serialize / deserialize', () => {
  it('JSON往復で同値', () => {
    const state = makeState([[c('d', 8), c('s', 2)], [c('h', 1)]])
    const restored = deserializeState(serializeState(state))
    expect(restored).toEqual(state)
  })
})
