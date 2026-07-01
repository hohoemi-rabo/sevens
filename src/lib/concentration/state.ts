// 神経衰弱のゲーム状態と進行（純粋TS・不変・不正手は throw / REQUIREMENTS_platform.md §2-3, §5）。
// 状態はプレーンJSON（関数/クラスを持たない）＝通信同期・再接続・GameModule 化（フェーズ3）に耐える。
//
// 手番: 2枚めくる → 揃えば獲得して連続手番、外せば「見せてから」伏せて次の人（明示的 resolve）。
// 特殊カードはめくった瞬間に即発動し、その手番は終了する（配線は special.ts / フェーズC3）。

import type { Rank } from "@/lib/sevens/cards";
import { type Rng, seededRng } from "@/lib/sevens/deal";
import { type ConcentrationConfig, type Slot, generateBoard } from "@/lib/concentration/board";
import { isPair, isTrump } from "@/lib/concentration/cards";
import { hasFacedownTrump, slotAt } from "@/lib/concentration/flip";

export interface CPlayer {
  readonly id: string;
  readonly name: string;
  readonly seat: number;
  readonly collected: Rank[]; // 獲得したペアの数字（得点は pointByRank から導出）
}

/** 手番の途中で「次に何を待っているか」。null=通常のめくり待ち。 */
export type Pending =
  | { readonly type: "resolve" } // トランプ2枚めくり済み → 揃い判定待ち
  | { readonly type: "choose-swap" } // 入れ替え発動 → 発動者が2枚選ぶ
  | { readonly type: "choose-peek" }; // 覗き見発動 → 発動者が1枚選ぶ

export interface ConcentrationState {
  readonly slots: Slot[];
  readonly players: CPlayer[];
  readonly currentSeat: number;
  readonly phase: "playing" | "ended";
  readonly revealed: number[]; // この手番でめくって表になっている位置（0..2）
  readonly pending: Pending | null;
  readonly pointByRank: Partial<Record<Rank, number>>;
}

export type CAction =
  | { readonly type: "flip"; readonly pos: number }
  | { readonly type: "resolve" }
  | { readonly type: "swap"; readonly a: number; readonly b: number }
  | { readonly type: "peek"; readonly pos: number };

export interface InitOptions {
  readonly players: { readonly id: string; readonly name: string }[];
  readonly config: ConcentrationConfig;
  readonly rng?: Rng;
  readonly seed?: number;
}

/** 初期状態を作る。seed か rng を渡すと決定論的（テスト・再現）。 */
export function initGame(opts: InitOptions): ConcentrationState {
  const rng = opts.rng ?? seededRng(opts.seed ?? 0);
  const { slots, pointByRank } = generateBoard(opts.config, rng);
  const players: CPlayer[] = opts.players.map((p, seat) => ({ id: p.id, name: p.name, seat, collected: [] }));
  return { slots, players, currentSeat: 0, phase: "playing", revealed: [], pending: null, pointByRank };
}

export function currentPlayer(state: ConcentrationState): CPlayer {
  return state.players[state.currentSeat];
}

/** 終局したか（揃えられるトランプが場に残っていない）。 */
export function isFinished(state: ConcentrationState): boolean {
  return state.phase === "ended";
}

const nextSeat = (state: ConcentrationState): number => (state.currentSeat + 1) % state.players.length;

/**
 * 行動を適用して新しい状態を返す（不変・非破壊）。手番外・phase違い・pending違反・不正な位置は throw。
 * 席はサーバー束縛の playerId で本人確認する（自己申告 seat は使わない＝7並べ踏襲）。
 */
export function handleAction(state: ConcentrationState, playerId: string, action: CAction): ConcentrationState {
  if (state.phase !== "playing") throw new Error("game already ended");
  if (currentPlayer(state).id !== playerId) throw new Error("not your turn");

  switch (action.type) {
    case "flip":
      return applyFlip(state, action.pos);
    case "resolve":
      return applyResolve(state);
    case "swap":
    case "peek":
      // 特殊カードの選択（choose-swap / choose-peek）はフェーズC3で配線する。
      throw new Error(`action not wired yet: ${action.type}`);
    default: {
      const _exhaustive: never = action;
      throw new Error(`unknown action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function applyFlip(state: ConcentrationState, pos: number): ConcentrationState {
  if (state.pending) throw new Error("must resolve pending first");
  if (state.revealed.length >= 2) throw new Error("already revealed two cards");
  const slot = slotAt(state.slots, pos);
  if (!isTrump(slot.face) || slot.status !== "facedown") {
    // 特殊カードはフェーズC3で即発動配線。ここでは伏せトランプのみ受け付ける。
    if (slot.status !== "facedown") throw new Error("card is not face-down");
    throw new Error("special cards not wired yet");
  }
  if (state.revealed.includes(pos)) throw new Error("already revealed this position");

  const revealed = [...state.revealed, pos];
  const pending: Pending | null = revealed.length === 2 ? { type: "resolve" } : null;
  return { ...state, revealed, pending };
}

function applyResolve(state: ConcentrationState): ConcentrationState {
  if (state.pending?.type !== "resolve") throw new Error("nothing to resolve");
  const [p0, p1] = state.revealed;
  const a = slotAt(state.slots, p0);
  const b = slotAt(state.slots, p1);
  const seat = state.currentSeat;

  if (isPair(a.face, b.face)) {
    // 揃った: 獲得して連続手番（場が尽きたら終局）。
    const slots = state.slots.map((s) =>
      s.pos === p0 || s.pos === p1 ? { ...s, status: "collected" as const, owner: seat } : s,
    );
    const rank = isTrump(a.face) ? a.face.card.rank : undefined; // isPair 成立時は必ずトランプ
    const players = state.players.map((pl) =>
      pl.seat === seat && rank !== undefined ? { ...pl, collected: [...pl.collected, rank] } : pl,
    );
    const phase = hasFacedownTrump(slots) ? "playing" : "ended";
    return { ...state, slots, players, revealed: [], pending: null, phase };
  }

  // 外れた: 伏せ戻して次の人へ（revealed をクリアするだけ＝status は facedown のまま）。
  return { ...state, revealed: [], pending: null, currentSeat: nextSeat(state) };
}

export function serializeState(state: ConcentrationState): string {
  return JSON.stringify(state);
}
export function deserializeState(serialized: string): ConcentrationState {
  return JSON.parse(serialized) as ConcentrationState;
}
