// クライアントのサーバー同期状態ストア（Zustand / docs/10）。
// 通信層（SevensAdapter）のイベントを購読してここへ流し込み、UIはこのストアだけを購読する。
// adapter は注入で受ける（具体 LocalAdapter を import しない）＝socket 無しでテスト可能。
// サーバー権威なので楽観適用はしない（game:state 受信で更新する）。
//
// 7並べでは「自分の合法手」は UI 側で isPlayable を都度計算するため、ここでは保持しない。

import { create } from "zustand";
import type { GameState } from "@/lib/sevens/state";
import { clearSession, loadSession, saveSession } from "@/lib/store/session-storage";
import type {
  AdapterError,
  ClientToken,
  ConnectionStatus,
  Passcode,
  PlayerAction,
  PlayerInfo,
  RoomId,
  Seat,
  SevensAdapter,
  StartOptions,
} from "@/lib/adapter/types";

export interface GameStore {
  connection: ConnectionStatus;
  roomId: RoomId | null;
  passcode: Passcode | null; // ホスト作成時のみ
  mySeat: Seat | null;
  myToken: ClientToken | null;
  players: readonly PlayerInfo[];
  gameState: GameState | null;
  lastError: AdapterError | null;

  connect(adapter: SevensAdapter): Promise<void>;
  createRoom(name: string): Promise<void>;
  joinRoom(passcode: Passcode, name: string): Promise<void>;
  start(opts?: StartOptions): Promise<void>;
  send(action: PlayerAction): void;
  /** sessionStorage の保存済みセッションを state に復元する（リロード後の再接続用・#13）。 */
  restoreSession(): boolean;
  disconnect(): void;
  clearError(): void;
}

const INITIAL = {
  connection: "disconnected" as ConnectionStatus,
  roomId: null,
  passcode: null,
  mySeat: null,
  myToken: null,
  players: [] as readonly PlayerInfo[],
  gameState: null,
  lastError: null,
};

// adapter は描画に関係しないのでクロージャ変数に保持（state に入れて再描画を誘発しない）。
let adapterRef: SevensAdapter | null = null;
let unsubscribers: Array<() => void> = [];

const requireAdapter = (): SevensAdapter => {
  if (!adapterRef) throw new Error("gameStore: connect() を先に呼んでください");
  return adapterRef;
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL,

  async connect(adapter) {
    // 既存購読を解除してから差し替え（テスト/再接続で多重登録しない）
    unsubscribers.forEach((u) => u());
    unsubscribers = [];
    adapterRef = adapter;
    unsubscribers.push(
      adapter.onConnectionChange((connection) => {
        set({ connection });
        // 通信断からの復帰時、入室済みならトークンで席を再束縛して状態復元（#13）。
        // 初回接続は roomId=null なので発火しない＝再接続時のみ。
        if (connection === "connected") {
          const { roomId, mySeat, myToken } = get();
          if (roomId && mySeat !== null && myToken) {
            void adapter.reconnect(roomId, mySeat, myToken).catch(() => {
              // 部屋が消えている/サーバー再起動など＝復元不可。セッションを捨てて
              // 「部屋が見つかりません」へ落とす（無限「準備中…」を防ぐ）。
              clearSession();
              set({ roomId: null, mySeat: null, myToken: null });
            });
          }
        }
      }),
      adapter.onPlayers((players) => set({ players })),
      adapter.onState((gameState) => set({ gameState })),
      adapter.onEnd((gameState) => set({ gameState })),
      adapter.onError((lastError) => set({ lastError })),
    );
    await adapter.connect();
  },

  async createRoom(name) {
    try {
      const a = await requireAdapter().createRoom(name);
      set({ roomId: a.roomId, mySeat: a.seat, myToken: a.token, passcode: a.passcode ?? null });
      saveSession({ roomId: a.roomId, seat: a.seat, token: a.token });
    } catch (e) {
      set({ lastError: e as AdapterError });
    }
  },

  async joinRoom(passcode, name) {
    try {
      const a = await requireAdapter().joinRoom(passcode, name);
      set({ roomId: a.roomId, mySeat: a.seat, myToken: a.token });
      saveSession({ roomId: a.roomId, seat: a.seat, token: a.token });
    } catch (e) {
      set({ lastError: e as AdapterError });
    }
  },

  async start(opts) {
    try {
      await requireAdapter().start(opts);
    } catch (e) {
      set({ lastError: e as AdapterError });
    }
  },

  send(action) {
    requireAdapter().send(action);
  },

  restoreSession() {
    const saved = loadSession();
    if (!saved) return false;
    set({ roomId: saved.roomId, mySeat: saved.seat, myToken: saved.token });
    return true;
  },

  disconnect() {
    unsubscribers.forEach((u) => u());
    unsubscribers = [];
    adapterRef?.disconnect();
    adapterRef = null;
    clearSession();
    set({ ...INITIAL });
  },

  clearError() {
    set({ lastError: null });
  },
}));
