// サーバー権威のセッションコア（純粋・socket/next 非依存 / docs/10）。
// 部屋・席・ゲーム進行をメモリ上で管理する（DB無し）。socket グルー（server.ts）は
// これを薄く呼ぶだけ。ゲームロジック層（src/lib/sevens/**）が単一の真実で、不正アクションは
// playCard/pass の throw を捕まえて AdapterError に翻訳する。
//
// 麻雀（流用元）との違い: アクションは play/pass の2種だけ。reducer/validate/settle/claims や
// CPU への rng 注入が無く、seat→playerId の解決層と「例外→エラー翻訳」が中核になる。

import { type GameState, initGame, pass, playCard } from "@/lib/sevens/state";
import { seededRng } from "@/lib/sevens/deal";
import { isValidMaxPass } from "@/lib/sevens/pass";
import { type StartMode } from "@/lib/sevens/board";
import { type Action, type CpuStrength, strategyFor } from "@/lib/sevens/cpu";
import type {
  AdapterError,
  AdapterErrorCode,
  ClientToken,
  Passcode,
  PlayerInfo,
  RoomId,
  Seat,
  StartOptions,
} from "@/lib/adapter/types";

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err = { readonly ok: false; readonly error: AdapterError };
export type Result<T> = Ok<T> | Err;

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const ERR_MESSAGE: Readonly<Record<AdapterErrorCode, string>> = {
  ROOM_NOT_FOUND: "部屋が見つかりません",
  WRONG_PASSCODE: "合言葉が違います",
  ROOM_FULL: "この部屋は満員です",
  NAME_REQUIRED: "名前を入力してください",
  GAME_ALREADY_STARTED: "対局はすでに始まっています",
  GAME_NOT_STARTED: "対局はまだ始まっていません",
  NOT_HOST: "ホストのみ操作できます",
  ILLEGAL_ACTION: "その手は出せません",
  INVALID_OPTIONS: "設定が正しくありません",
  INTERNAL: "エラーが発生しました",
};
const err = (code: AdapterErrorCode): Err => ({ ok: false, error: { code, message: ERR_MESSAGE[code] } });

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const DEFAULT_MAX_PASS = 3;
const DEFAULT_START_MODE: StartMode = "all7"; // シニア向け既定（7を全部並べてスタート）
const DEFAULT_CPU: CpuStrength = "weak";
// CPU席の名前（GameTable.tsx のキャラ名を踏襲）。席順に割り当てる。
const CPU_NAMES = ["りつこ", "ハジメ", "ミミ", "サブ"] as const;

interface SeatSlot {
  /** ゲームロジックに渡す安定したプレイヤーID（席ごとに固定 `p0`..`p3`）。 */
  playerId: string;
  name: string;
  isCpu: boolean;
  connected: boolean;
  token: ClientToken;
  socketId: string | null; // グルーが束ねる（#13 シーム）
  /** CPU席の強さ（人間席は null）。stepAuto が strategyFor で思考を解決する。 */
  cpuStrength: CpuStrength | null;
}

interface Room {
  roomId: RoomId;
  passcode: Passcode;
  hostSeat: Seat;
  seats: (SeatSlot | null)[]; // length 4, index === seat
  state: GameState | null;
  started: boolean;
  maxPass: number;
  startMode: StartMode;
  /** A-Kループ（ローカルルール）。rematch で同設定を引き継ぐため保持する。 */
  wrapAround: boolean;
  seed: number | null;
}

const randId = (): string => `r-${Math.random().toString(36).slice(2, 8)}`;
const randToken = (): string => Math.random().toString(36).slice(2, 12);
const seatPlayerId = (seat: Seat): string => `p${seat}`;

export class RoomStore {
  private readonly rooms = new Map<RoomId, Room>();

  private freshPasscode(): Passcode {
    const taken = new Set([...this.rooms.values()].map((r) => r.passcode));
    let code: string;
    do {
      code = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0");
    } while (taken.has(code));
    return code;
  }

  private freshRoomId(): RoomId {
    let id: string;
    do {
      id = randId();
    } while (this.rooms.has(id));
    return id;
  }

  createRoom(hostName: string): Result<{ roomId: RoomId; passcode: Passcode; seat: Seat; token: ClientToken }> {
    if (!hostName.trim()) return err("NAME_REQUIRED");
    const roomId = this.freshRoomId();
    const passcode = this.freshPasscode();
    const token = randToken();
    const seats: (SeatSlot | null)[] = [null, null, null, null];
    seats[0] = {
      playerId: seatPlayerId(0),
      name: hostName.trim(),
      isCpu: false,
      connected: true,
      token,
      socketId: null,
      cpuStrength: null,
    };
    this.rooms.set(roomId, {
      roomId,
      passcode,
      hostSeat: 0,
      seats,
      state: null,
      started: false,
      maxPass: DEFAULT_MAX_PASS,
      startMode: DEFAULT_START_MODE,
      wrapAround: false,
      seed: null,
    });
    return ok({ roomId, passcode, seat: 0, token });
  }

  joinRoom(passcode: Passcode, name: string): Result<{ roomId: RoomId; seat: Seat; token: ClientToken }> {
    if (!name.trim()) return err("NAME_REQUIRED");
    const room = [...this.rooms.values()].find((r) => r.passcode === passcode);
    if (!room) return err("WRONG_PASSCODE"); // 未存在も合言葉違いに丸める（列挙防止）
    if (room.started) return err("GAME_ALREADY_STARTED");
    const seat = SEATS.find((s) => room.seats[s] === null);
    if (seat === undefined) return err("ROOM_FULL");
    const token = randToken();
    room.seats[seat] = {
      playerId: seatPlayerId(seat),
      name: name.trim(),
      isCpu: false,
      connected: true,
      token,
      socketId: null,
      cpuStrength: null,
    };
    return ok({ roomId: room.roomId, seat, token });
  }

  /** 空席をCPUで埋める（冪等・占有席は変更しない）。strength は空席のCPUに割り当てる。 */
  fillWithCpu(roomId: RoomId, strength: CpuStrength = DEFAULT_CPU): void {
    const room = this.rooms.get(roomId);
    if (!room || room.started) return;
    for (const s of SEATS) {
      if (room.seats[s] === null) {
        room.seats[s] = {
          playerId: seatPlayerId(s),
          name: CPU_NAMES[s],
          isCpu: true,
          connected: true,
          token: randToken(),
          socketId: null,
          cpuStrength: strength,
        };
      }
    }
  }

  /** 現在の席編成で配り直して room.state を作る（startGame/rematch 共通）。席は埋まっている前提。 */
  private dealInto(
    room: Room,
    maxPass: number,
    startMode: StartMode,
    wrapAround: boolean,
    seed: number,
  ): GameState {
    const players = SEATS.map((s) => {
      const slot = room.seats[s]!; // fill 後は全席埋まる
      return { id: slot.playerId, name: slot.name };
    });
    room.maxPass = maxPass;
    room.startMode = startMode;
    room.wrapAround = wrapAround;
    room.seed = seed;
    room.started = true;
    room.state = initGame({ players, maxPass, startMode, wrapAround, rng: seededRng(seed) });
    return room.state;
  }

  startGame(roomId: RoomId, opts?: StartOptions): Result<GameState> {
    const room = this.rooms.get(roomId);
    if (!room) return err("ROOM_NOT_FOUND");
    if (room.started) return err("GAME_ALREADY_STARTED");
    const maxPass = opts?.maxPass ?? DEFAULT_MAX_PASS;
    if (!isValidMaxPass(maxPass)) return err("INVALID_OPTIONS");
    const startMode = opts?.startMode ?? DEFAULT_START_MODE;
    const wrapAround = opts?.wrapAround ?? false;
    // 空席は安全側でCPU補完（4席必ず埋める）。CPU強さはホスト指定（既定 weak）。
    this.fillWithCpu(roomId, opts?.cpuStrength ?? DEFAULT_CPU);
    const seed = opts?.seed ?? Math.floor(Math.random() * 0x7fffffff);
    return ok(this.dealInto(room, maxPass, startMode, wrapAround, seed));
  }

  /**
   * 同じ部屋・同じ席編成・同じ設定（maxPass/startMode/CPU強さ）で再戦する（#17「もう一回」）。
   * 終局後のみ可。新しい seed で配り直すので毎回ちがう手札になる。
   */
  rematch(roomId: RoomId): Result<GameState> {
    const room = this.rooms.get(roomId);
    if (!room) return err("ROOM_NOT_FOUND");
    if (!room.started || room.state?.phase !== "ended") return err("GAME_NOT_STARTED");
    room.started = false; // dealInto が再度 true にする
    const seed = Math.floor(Math.random() * 0x7fffffff);
    return ok(this.dealInto(room, room.maxPass, room.startMode, room.wrapAround, seed));
  }

  applyPlayerAction(roomId: RoomId, seat: Seat, action: Action): Result<GameState> {
    const room = this.rooms.get(roomId);
    if (!room) return err("ROOM_NOT_FOUND");
    if (!room.state || !room.started) return err("GAME_NOT_STARTED");
    const slot = room.seats[seat];
    if (!slot) return err("ILLEGAL_ACTION");
    // 席はサーバー束縛を使う（自己申告を信用しない）。slot.playerId で本人を特定する。
    // 手番外・非保持・出せない札は playCard/pass が throw するので捕まえて翻訳する。
    try {
      const next =
        action.type === "play"
          ? playCard(room.state, slot.playerId, action.card)
          : pass(room.state, slot.playerId);
      room.state = next;
      return ok(next);
    } catch {
      return err("ILLEGAL_ACTION");
    }
  }

  /**
   * 自動席（CPU、または切断中の人間＝CPU代行）の「次の一手」だけ進める。
   * 接続中の人間の手番・終局・該当なしは acted:false（停止）。一手ずつの思考演出に使う（#13）。
   */
  stepAuto(roomId: RoomId): { state: GameState | null; acted: boolean } {
    const room = this.rooms.get(roomId);
    if (!room?.state) return { state: null, acted: false };
    const state = room.state;
    if (state.phase === "ended") return { state, acted: false };
    const seat = state.currentSeat;
    const slot = room.seats[seat];
    const auto = !!slot && (slot.isCpu || !slot.connected); // 切断中の人間は CPU が代行
    if (!auto) return { state, acted: false }; // 接続中の人間の手番で停止
    const action = strategyFor(slot.cpuStrength ?? DEFAULT_CPU)(state, slot.playerId);
    try {
      const next =
        action.type === "play"
          ? playCard(state, slot.playerId, action.card)
          : pass(state, slot.playerId);
      room.state = next;
      return { state: next, acted: true };
    } catch {
      // decideWeak が万一不正手を返したら安全側で pass にフォールバック。
      try {
        room.state = pass(state, slot.playerId);
        return { state: room.state, acted: true };
      } catch {
        return { state, acted: false };
      }
    }
  }

  /** 自動席が続く限りまとめて進める（接続中の人間席・終局で停止）。最終 state を返す（無進行は null）。 */
  advanceAuto(roomId: RoomId): GameState | null {
    let advanced = false;
    let guard = 0;
    while (guard++ < 3000) {
      const r = this.stepAuto(roomId);
      if (!r.acted) break;
      advanced = true;
    }
    return advanced ? (this.rooms.get(roomId)?.state ?? null) : null;
  }

  // --- 切断/再接続（#13） ---

  /** socket を席に束ねる（create/join/reconnect 後）。connected=true にする。 */
  bindSocket(roomId: RoomId, seat: Seat, socketId: string): void {
    const slot = this.rooms.get(roomId)?.seats[seat];
    if (!slot) return;
    slot.socketId = socketId;
    slot.connected = true;
  }

  /**
   * socket 切断を反映し、該当席を connected=false にして {roomId,seat} を返す（無ければ null）。
   * socketId 一致のときだけ落とす＝再接続で別IDに束ね直し済みなら旧切断は無視（競合回避）。
   */
  markDisconnected(socketId: string): { roomId: RoomId; seat: Seat } | null {
    for (const room of this.rooms.values()) {
      for (const seat of SEATS) {
        const slot = room.seats[seat];
        if (slot && slot.socketId === socketId) {
          slot.connected = false;
          slot.socketId = null;
          return { roomId: room.roomId, seat };
        }
      }
    }
    return null;
  }

  /** 再接続。token 検証のうえ席を再束縛し、現在の state を返す（未開始なら null）。 */
  reconnect(roomId: RoomId, seat: Seat, token: ClientToken, socketId: string): Result<GameState | null> {
    const room = this.rooms.get(roomId);
    if (!room) return err("ROOM_NOT_FOUND");
    const slot = room.seats[seat];
    if (!slot || slot.token !== token) return err("ROOM_NOT_FOUND"); // 不一致は安全側で丸める（列挙防止）
    slot.connected = true;
    slot.socketId = socketId;
    return ok(room.state);
  }

  getPlayers(roomId: RoomId): readonly PlayerInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return SEATS.flatMap((s) => {
      const slot = room.seats[s];
      return slot
        ? [{ seat: s, name: slot.name, isCpu: slot.isCpu, connected: slot.connected, isHost: s === room.hostSeat }]
        : [];
    });
  }

  getState(roomId: RoomId): GameState | null {
    return this.rooms.get(roomId)?.state ?? null;
  }

  removeRoom(roomId: RoomId): void {
    this.rooms.delete(roomId);
  }
}
