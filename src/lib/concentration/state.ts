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
import { applyPeek, applyShuffle, applySwap } from "@/lib/concentration/special";

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
  readonly shuffleSwapPairs: number; // シャッフル特殊が動かす組数（config由来・実行時に必要）
  readonly rngSeed: number; // シャッフル特殊などの追加乱数（決定論・JSON安全＝Rng closure を持たない）
  // 覗き見中の1枚（発動者だけに中身を見せる・§5.3）。中身は共有状態に出さず、
  // getView（module）が peek.seat の view にだけ face を載せる。発動者の次アクションで消える。
  readonly peek: { readonly seat: number; readonly pos: number } | null;
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
  return {
    slots,
    players,
    currentSeat: 0,
    phase: "playing",
    revealed: [],
    pending: null,
    pointByRank,
    shuffleSwapPairs: opts.config.shuffleSwapPairs,
    rngSeed: nextSeed(rng), // 場生成後の乱数系列から派生（以降のシャッフル特殊で使う）
    peek: null,
  };
}

export function currentPlayer(state: ConcentrationState): CPlayer {
  return state.players[state.currentSeat];
}

/** 終局したか（揃えられるトランプが場に残っていない）。 */
export function isFinished(state: ConcentrationState): boolean {
  return state.phase === "ended";
}

const nextSeat = (state: ConcentrationState): number => (state.currentSeat + 1) % state.players.length;
/** 乱数系列から次に保存するシード（JSON安全な number）を導く。 */
const nextSeed = (rng: Rng): number => Math.floor(rng() * 0x7fffffff);

/**
 * 行動を適用して新しい状態を返す（不変・非破壊）。手番外・phase違い・pending違反・不正な位置は throw。
 * 席はサーバー束縛の playerId で本人確認する（自己申告 seat は使わない＝7並べ踏襲）。
 */
export function handleAction(state: ConcentrationState, playerId: string, action: CAction): ConcentrationState {
  if (state.phase !== "playing") throw new Error("game already ended");
  if (currentPlayer(state).id !== playerId) throw new Error("not your turn");

  // 覗き見の私的表示は発動者の「次の自分の手番の一手」で終える（getView が peek を見せている）。
  const s = state.peek && state.peek.seat === state.currentSeat ? { ...state, peek: null } : state;

  switch (action.type) {
    case "flip":
      return applyFlip(s, action.pos);
    case "resolve":
      return applyResolve(s);
    case "swap":
      return applySwapChoice(s, action.a, action.b);
    case "peek":
      return applyPeekChoice(s, action.pos);
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
  if (slot.status !== "facedown") throw new Error("card is not face-down");
  if (state.revealed.includes(pos)) throw new Error("already revealed this position");

  if (!isTrump(slot.face)) return applySpecial(state, slot); // 特殊カードはめくった瞬間に即発動（§5.1）

  const revealed = [...state.revealed, pos];
  const pending: Pending | null = revealed.length === 2 ? { type: "resolve" } : null;
  return { ...state, revealed, pending };
}

/**
 * 特殊カードの即発動（A方式・§5.1）。発動したカードは使い切りで場から除外（used）。
 * 既にめくっていたトランプ1枚目は伏せ戻す（revealed をクリア）。
 * シャッフルは自動発動して手番終了。入れ替え/覗き見は発動者の選択待ち（pending）に入る。
 */
function applySpecial(state: ConcentrationState, slot: Slot): ConcentrationState {
  if (slot.face.type !== "special") throw new Error("not a special card");
  const used = state.slots.map((s) => (s.pos === slot.pos ? { ...s, status: "used" as const } : s));
  switch (slot.face.special.kind) {
    case "shuffle": {
      const rng = seededRng(state.rngSeed);
      const slots = applyShuffle(used, rng, state.shuffleSwapPairs);
      return { ...state, slots, rngSeed: nextSeed(rng), revealed: [], pending: null, currentSeat: nextSeat(state) };
    }
    case "swap":
      return { ...state, slots: used, revealed: [], pending: { type: "choose-swap" } };
    case "peek":
      return { ...state, slots: used, revealed: [], pending: { type: "choose-peek" } };
  }
}

function applySwapChoice(state: ConcentrationState, a: number, b: number): ConcentrationState {
  if (state.pending?.type !== "choose-swap") throw new Error("no swap to choose");
  const slots = applySwap(state.slots, a, b);
  return { ...state, slots, pending: null, currentSeat: nextSeat(state) }; // 効果適用で手番終了
}

function applyPeekChoice(state: ConcentrationState, pos: number): ConcentrationState {
  if (state.pending?.type !== "choose-peek") throw new Error("no peek to choose");
  const slots = applyPeek(state.slots, pos); // 検証のみ（共有状態は不変）
  // 発動者（現手番）だけに中身を見せる印を残して手番終了。中身自体は共有状態に出さない。
  return { ...state, slots, pending: null, peek: { seat: state.currentSeat, pos }, currentSeat: nextSeat(state) };
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
