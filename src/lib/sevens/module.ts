// 7並べを GameModule として土台に差し込むアダプタ（REQUIREMENTS_platform.md §1.2 / §6）。
// 既存の純関数（state.ts / deal.ts / cpu）を薄くラップするだけ＝ロジック本体は無改修。
// 7並べは状態が全公開なので getView は恒等（(s)=>s）・viewIsPublic:true。
//
// これにより RoomStore（土台）は initGame/playCard/pass/strategyFor を直接呼ばず、
// this.module 経由でゲームを進められる（神経衰弱を別モジュールとして追加可能になる）。

import { type GameState, initGame, playCard, pass } from "@/lib/sevens/state";
import { seededRng } from "@/lib/sevens/deal";
import { type StartMode } from "@/lib/sevens/board";
import { type Action, strategyFor } from "@/lib/sevens/cpu";
import type { GameModule, GameTransition, PlayerRef, Seat } from "@/lib/platform/gameModule";

/** 7並べの開始設定（＝StartOptions のうちルールに効く部分）。 */
export interface SevensConfig {
  readonly maxPass: number; // 1..5、または 0=無制限
  readonly startMode: StartMode; // 'diamond7' | 'all7'
  readonly wrapAround: boolean; // A-Kループ（ローカルルール）
}

export const sevensModule: GameModule<GameState, Action, GameState, SevensConfig> = {
  id: "sevens",
  name: "7並べ",
  minPlayers: 4,
  maxPlayers: 4,
  cpuFill: true,
  viewIsPublic: true, // 全席の手札を含むが、UIは自席のみ表示（教室内クローズドLAN前提・§確定判断）

  createInitialState(players: readonly PlayerRef[], config: SevensConfig, seed: number): GameState {
    return initGame({
      players: players.map((p) => ({ id: p.id, name: p.name })),
      maxPass: config.maxPass,
      startMode: config.startMode,
      wrapAround: config.wrapAround,
      rng: seededRng(seed),
    });
  },

  handleAction(state: GameState, playerId: string, action: Action): GameState {
    return action.type === "play" ? playCard(state, playerId, action.card) : pass(state, playerId);
  },

  getView(state: GameState): GameState {
    return state; // 恒等（全公開）
  },

  isFinished(state: GameState): boolean {
    return state.phase === "ended";
  },

  currentSeat(state: GameState): Seat | null {
    return state.phase === "ended" ? null : state.currentSeat;
  },

  decideAuto(state, playerId, strength) {
    return strategyFor(strength)(state, playerId);
  },

  transitions(before: GameState, after: GameState): readonly GameTransition[] {
    const out: GameTransition[] = [];
    for (const p of after.players) {
      const prev = before.players.find((q) => q.seat === p.seat);
      if (!prev) continue;
      if (prev.status !== "finished" && p.status === "finished") {
        out.push({ type: "finish", seat: p.seat, rank: p.rank });
      }
      if (prev.status !== "eliminated" && p.status === "eliminated") {
        out.push({ type: "eliminated", seat: p.seat, order: p.eliminatedOrder });
      }
    }
    return out;
  },
};
