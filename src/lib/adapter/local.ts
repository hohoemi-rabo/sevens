// LocalAdapter: 同一LAN向け Socket.io 実装（docs/10）。SevensAdapter を満たし、
// UI/ストアは Socket.io の詳細を知らずに済む。サーバー権威なので楽観適用はしない
// （送信→次の game:state で反映）。

import { type Socket, io } from "socket.io-client";
import type {
  AdapterError,
  ClientToken,
  ConnectionStatus,
  GameView,
  Passcode,
  PlayerAction,
  PlayerInfo,
  RoomId,
  Seat,
  SeatAssignment,
  SevensAdapter,
  StartOptions,
  Unsubscribe,
} from "@/lib/adapter/types";

export class LocalAdapter implements SevensAdapter {
  // autoConnect:false で構築時にソケットを用意し、connect() より前に on* を張れるようにする
  // （gameStore は購読を登録してから connect() する＝イベント取りこぼし防止の正しい順序）。
  // url 既定は same-origin（LAN ホストでそのまま動く）。
  private readonly socket: Socket;

  constructor(url?: string) {
    this.socket = url ? io(url, { autoConnect: false }) : io({ autoConnect: false });
  }

  private get s(): Socket {
    return this.socket;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket.connected) {
        resolve();
        return;
      }
      const cleanup = () => {
        this.socket.off("connect", onConnect);
        this.socket.off("connect_error", onErr);
      };
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onErr = (e: Error) => {
        cleanup();
        reject(e);
      };
      this.socket.once("connect", onConnect);
      this.socket.once("connect_error", onErr);
      this.socket.connect();
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  createRoom(hostName: string, gameId = "sevens", seatCount?: number): Promise<SeatAssignment> {
    return new Promise((resolve, reject) => {
      this.s.emit("room:create", { name: hostName, gameId, seatCount }, (res: SeatAssignment | AdapterError) => {
        if ("roomId" in res) resolve(res);
        else reject(res); // AdapterError をそのまま（code を保持）
      });
    });
  }

  joinRoom(passcode: Passcode, name: string): Promise<SeatAssignment> {
    return new Promise((resolve, reject) => {
      this.s.emit("room:join", { passcode, name }, (res: SeatAssignment | AdapterError) => {
        if ("roomId" in res) resolve(res);
        else reject(res);
      });
    });
  }

  reconnect(roomId: RoomId, seat: Seat, token: ClientToken): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s.emit("room:reconnect", { roomId, seat, token }, (res: { ok: true } | AdapterError) => {
        if ("ok" in res) resolve();
        else reject(res);
      });
    });
  }

  start(opts?: StartOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s.emit("game:start", { opts }, (res: { ok: true } | AdapterError) => {
        if ("ok" in res) resolve();
        else reject(res);
      });
    });
  }

  rematch(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s.emit("game:rematch", {}, (res: { ok: true } | AdapterError) => {
        if ("ok" in res) resolve();
        else reject(res);
      });
    });
  }

  dissolve(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s.emit("room:dissolve", {}, (res: { ok: true } | AdapterError) => {
        if ("ok" in res) resolve();
        else reject(res);
      });
    });
  }

  send(action: PlayerAction): void {
    // ゲーム非依存の汎用アクション経路（7並べ=play/pass、神経衰弱=flip/resolve/swap/peek）。
    this.s.emit("player:action", { action });
  }

  onPlayers(cb: (players: readonly PlayerInfo[]) => void): Unsubscribe {
    const h = (players: readonly PlayerInfo[]) => cb(players);
    this.s.on("room:players", h);
    return () => this.socket.off("room:players", h);
  }

  onState(cb: (state: GameView) => void): Unsubscribe {
    const h = (state: GameView) => cb(state);
    this.s.on("game:state", h);
    return () => this.socket.off("game:state", h);
  }

  onEnd(cb: (state: GameView) => void): Unsubscribe {
    const h = (state: GameView) => cb(state);
    this.s.on("game:end", h);
    return () => this.socket.off("game:end", h);
  }

  onError(cb: (err: AdapterError) => void): Unsubscribe {
    const h = (err: AdapterError) => cb(err);
    this.s.on("app:error", h); // "error" は socket.io 予約系を避ける
    return () => this.socket.off("app:error", h);
  }

  onConnectionChange(cb: (status: ConnectionStatus) => void): Unsubscribe {
    const onConnect = () => cb("connected");
    const onDisconnect = () => cb("disconnected");
    const onErr = () => cb("error");
    this.s.on("connect", onConnect);
    this.s.on("disconnect", onDisconnect);
    this.s.on("connect_error", onErr);
    return () => {
      this.socket.off("connect", onConnect);
      this.socket.off("disconnect", onDisconnect);
      this.socket.off("connect_error", onErr);
    };
  }

  onDissolved(cb: () => void): Unsubscribe {
    const h = () => cb();
    this.s.on("room:dissolved", h);
    return () => this.socket.off("room:dissolved", h);
  }
}
