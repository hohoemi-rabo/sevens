// 神経衰弱を GameModule として土台に差し込むアダプタ（REQUIREMENTS_platform.md §5, §2.2）。
// 既存の純ルール（state/board/special/score）をラップし、getView で中身を秘匿する（＝カンニング防止の核心）。
// viewIsPublic:false ＝ 席ごとに見える中身が違うので、サーバーは席ごとに配信する（server.ts の per-socket 経路）。

import { type ConcentrationState, type CAction, type Pending, handleAction, initGame } from "@/lib/concentration/state";
import type { ConcentrationConfig } from "@/lib/concentration/board";
import type { FaceCard } from "@/lib/concentration/cards";
import type { GameModule, PlayerRef, Seat } from "@/lib/platform/gameModule";

/** 席ごとに配る可視状態。伏せ札は face を落として送る（中身は端末に届かない）。 */
export interface ViewSlot {
  readonly pos: number;
  readonly status: "facedown" | "collected" | "used";
  readonly face?: FaceCard; // 見えるときだけ載る（めくり中/取得済/発動済特殊/覗き見中の自分）
}
export interface ViewPlayer {
  readonly seat: number;
  readonly name: string;
  readonly pairs: number; // 獲得ペア数
  readonly score: number; // 合計点（点数は取得して初めて判明＝pointByRank は生では送らない）
}
export interface ConcentrationView {
  readonly slots: ViewSlot[];
  readonly players: ViewPlayer[];
  readonly currentSeat: number;
  readonly phase: "playing" | "ended";
  readonly pending: Pending | null;
  readonly revealed: number[];
}

const scoreOf = (state: ConcentrationState, collected: readonly number[]): number =>
  collected.reduce((sum, rank) => sum + (state.pointByRank[rank as never] ?? 0), 0);

export const concentrationModule: GameModule<ConcentrationState, CAction, ConcentrationView, ConcentrationConfig> = {
  id: "concentration",
  name: "神経衰弱",
  minPlayers: 2,
  maxPlayers: 4,
  cpuFill: true,
  viewIsPublic: false, // 席ごとに中身が異なる＝サーバーが席ごとに getView して配信する

  createInitialState(players: readonly PlayerRef[], config: ConcentrationConfig, seed: number): ConcentrationState {
    return initGame({ players: players.map((p) => ({ id: p.id, name: p.name })), config, seed });
  },

  handleAction(state: ConcentrationState, playerId: string, action: CAction): ConcentrationState {
    return handleAction(state, playerId, action);
  },

  /**
   * 指定席から見える状態。伏せ札の中身は「①この手番でめくった revealed ②取得済 collected
   * ③発動済み特殊 used ④覗き見中の自分」だけ face を載せ、それ以外は落とす（§2.2 カンニング防止）。
   */
  getView(state: ConcentrationState, seat: Seat): ConcentrationView {
    const slots: ViewSlot[] = state.slots.map((sl) => {
      const visible =
        sl.status === "collected" ||
        sl.status === "used" ||
        state.revealed.includes(sl.pos) ||
        (state.peek?.seat === seat && state.peek.pos === sl.pos);
      return visible ? { pos: sl.pos, status: sl.status, face: sl.face } : { pos: sl.pos, status: sl.status };
    });
    const players: ViewPlayer[] = state.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      pairs: p.collected.length,
      score: scoreOf(state, p.collected),
    }));
    return {
      slots,
      players,
      currentSeat: state.currentSeat,
      phase: state.phase,
      pending: state.pending,
      revealed: state.revealed,
    };
  },

  isFinished(state: ConcentrationState): boolean {
    return state.phase === "ended";
  },

  currentSeat(state: ConcentrationState): Seat | null {
    return state.phase === "ended" ? null : state.currentSeat;
  },

  /**
   * 基本CPU（記憶なし＝memoryless / フェーズ3）。中身を覚えないので運まかせで揃える弱いCPU。
   * pending に応じて resolve/選択を返し、通常は最小indexの伏せ札をめくる。記憶保持率CPU（弱中強）はフェーズ4。
   */
  decideAuto(state: ConcentrationState): CAction {
    if (state.pending?.type === "resolve") return { type: "resolve" };
    const fd = state.slots.filter((sl) => sl.status === "facedown").map((sl) => sl.pos);
    if (state.pending?.type === "choose-swap") return { type: "swap", a: fd[0], b: fd[1] };
    if (state.pending?.type === "choose-peek") return { type: "peek", pos: fd[0] };
    if (state.revealed.length === 1) {
      const other = fd.find((p) => p !== state.revealed[0])!;
      return { type: "flip", pos: other };
    }
    return { type: "flip", pos: fd[0] };
  },

  autoResolvable(state: ConcentrationState): boolean {
    // 2枚めくった後の「見せてから伏せる」＝サーバーが（人間席でも）数秒後に自動確定する。
    return state.pending?.type === "resolve";
  },

  // 演出イベント（ペア成立/特殊）はフェーズ4の音声で扱う。GameTransition は現状 finish/eliminated 型なので空。
  transitions(): [] {
    return [];
  },
};
