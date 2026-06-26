// RemoteAdapter: 将来のクラウド対戦用スタブ（docs/10）。SevensAdapter が通信非依存で
// あることを示すための骨組み。実装は将来チケットで（現状は全メソッドが未実装エラー）。

import type { GameState } from "@/lib/sevens/state";
import type {
  AdapterError,
  ClientToken,
  ConnectionStatus,
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

const NOT_IMPLEMENTED = "RemoteAdapter is not implemented yet";

export class RemoteAdapter implements SevensAdapter {
  connect(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  disconnect(): void {
    throw new Error(NOT_IMPLEMENTED);
  }
  createRoom(_hostName: string): Promise<SeatAssignment> {
    throw new Error(NOT_IMPLEMENTED);
  }
  joinRoom(_passcode: Passcode, _name: string): Promise<SeatAssignment> {
    throw new Error(NOT_IMPLEMENTED);
  }
  reconnect(_roomId: RoomId, _seat: Seat, _token: ClientToken): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  start(_opts?: StartOptions): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
  send(_action: PlayerAction): void {
    throw new Error(NOT_IMPLEMENTED);
  }
  onPlayers(_cb: (players: readonly PlayerInfo[]) => void): Unsubscribe {
    throw new Error(NOT_IMPLEMENTED);
  }
  onState(_cb: (state: GameState) => void): Unsubscribe {
    throw new Error(NOT_IMPLEMENTED);
  }
  onEnd(_cb: (state: GameState) => void): Unsubscribe {
    throw new Error(NOT_IMPLEMENTED);
  }
  onError(_cb: (err: AdapterError) => void): Unsubscribe {
    throw new Error(NOT_IMPLEMENTED);
  }
  onConnectionChange(_cb: (status: ConnectionStatus) => void): Unsubscribe {
    throw new Error(NOT_IMPLEMENTED);
  }
}
