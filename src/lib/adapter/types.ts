// 通信層の共通インターフェースとワイヤ型（REQUIREMENTS §6.2, §7.1, §7.3 / docs/10）。
// ゲームロジック層から分離した「差し替え可能な通信層」の契約。LocalAdapter（Socket.io）と
// 将来の RemoteAdapter（クラウド）が同じ契約を実装する。ペイロードはすべて JSONシリアライズ可能。
//
// マルチゲーム（フェーズ3）: アクションと配信状態はゲームごとに異なるため union で持つ。
// 7並べ=play/pass・全公開の GameState、神経衰弱=flip/resolve/swap/peek・席ごとに秘匿された ConcentrationView。

import type { Action, CpuStrength } from "@/lib/sevens/cpu/types";
import type { GameState } from "@/lib/sevens/state";
import type { StartMode } from "@/lib/sevens/board";
import type { CAction } from "@/lib/concentration/state";
import type { ConcentrationView } from "@/lib/concentration/module";
import type { ConcentrationConfig } from "@/lib/concentration/board";

export type RoomId = string;
export type Passcode = string; // 4桁数字（"0427" 等）
export type ClientToken = string; // 席ごとの再接続トークン（#13 用シーム）
/** 席番号 0..n-1（n=部屋の capacity・2..4）。state.players[i].seat と一致する。 */
export type Seat = number;

export interface PlayerInfo {
  readonly seat: Seat;
  readonly name: string;
  readonly isCpu: boolean;
  readonly connected: boolean;
  readonly isHost: boolean;
}

/** 入室時にクライアントへ返す「自分は誰か」。passcode はホスト作成時のみ。 */
export interface SeatAssignment {
  readonly roomId: RoomId;
  readonly seat: Seat;
  readonly token: ClientToken;
  readonly passcode?: Passcode;
  readonly capacity?: number; // 部屋の席数（2..4・PlayerList の行数に使う）
}

export type AdapterErrorCode =
  | "ROOM_NOT_FOUND"
  | "WRONG_PASSCODE"
  | "ROOM_FULL"
  | "NAME_REQUIRED"
  | "GAME_ALREADY_STARTED"
  | "GAME_NOT_STARTED"
  | "NOT_HOST"
  | "ILLEGAL_ACTION"
  | "INVALID_OPTIONS"
  | "INTERNAL";

export interface AdapterError {
  readonly code: AdapterErrorCode;
  readonly message: string; // そのまま表示できる日本語
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/** ホストのみが指定する開始オプション。gameId で対象ゲームを切替（既定 sevens）。 */
export interface StartOptions {
  readonly seed?: number;
  readonly fillWithCpu?: boolean;
  readonly cpuStrength?: CpuStrength; // 'weak'|'medium'|'strong'（既定 'weak'）
  // --- 7並べ（sevens）用 ---
  readonly maxPass?: number; // 1..5（既定3）／0=無制限（脱落なし）
  readonly startMode?: StartMode; // 'diamond7' | 'all7'（既定 'all7'）
  readonly wrapAround?: boolean; // A-Kループ（ローカルルール）。既定 false=標準
  // --- 神経衰弱（concentration）用 ---
  readonly concentration?: Partial<ConcentrationConfig>; // pairCount 等（既定 教室モード）
}

/** クライアントが送れるアクション（ゲームごとの union）。7並べ=play/pass、神経衰弱=flip/resolve/swap/peek。 */
export type PlayerAction = Action | CAction;

/** サーバーから配信される可視状態（ゲームごとの union）。神経衰弱は席ごとに秘匿された view。 */
export type GameView = GameState | ConcentrationView;

export type Unsubscribe = () => void;

/** UI/ストアが依存する通信層の契約（Socket.io 等の詳細を隠す）。 */
export interface SevensAdapter {
  connect(): Promise<void>;
  disconnect(): void;

  createRoom(hostName: string, gameId?: string, seatCount?: number): Promise<SeatAssignment>;
  joinRoom(passcode: Passcode, name: string): Promise<SeatAssignment>;
  /** 通信断後の再接続で席を再束縛する（トークンで本人確認・#13）。 */
  reconnect(roomId: RoomId, seat: Seat, token: ClientToken): Promise<void>;
  start(opts?: StartOptions): Promise<void>;
  /** 同じ部屋・同設定で再戦する（ホスト限定・終局後・#17）。 */
  rematch(): Promise<void>;
  /** 部屋を解散する（ホスト限定・#17）。全員に onDissolved が届く。 */
  dissolve(): Promise<void>;

  /** プレイヤーアクション（ゲームごとの union）。エラーは onError 経由（fire-and-forget）。 */
  send(action: PlayerAction): void;

  onPlayers(cb: (players: readonly PlayerInfo[]) => void): Unsubscribe;
  onState(cb: (state: GameView) => void): Unsubscribe;
  onEnd(cb: (state: GameView) => void): Unsubscribe;
  onError(cb: (err: AdapterError) => void): Unsubscribe;
  onConnectionChange(cb: (status: ConnectionStatus) => void): Unsubscribe;
  /** 部屋が解散されたとき（ホストの dissolve）に全員へ通知（#17）。 */
  onDissolved(cb: () => void): Unsubscribe;
}
