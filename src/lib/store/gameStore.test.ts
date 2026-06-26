// gameStore の振る舞いテスト（socket 不要・adapter をモック注入）。
// サーバー権威の同期ストアとして、購読イベントが state に反映されること、
// 部屋情報が createRoom/joinRoom で入ること、disconnect で初期化されることを見る。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/lib/store/gameStore";
import { loadSession, saveSession } from "@/lib/store/session-storage";
import type {
  AdapterError,
  ConnectionStatus,
  PlayerInfo,
  SeatAssignment,
  SevensAdapter,
} from "@/lib/adapter/types";
import type { GameState } from "@/lib/sevens/state";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0));

/** イベントを手動発火できるモック adapter。 */
function makeMockAdapter() {
  const cbs: {
    conn?: (s: ConnectionStatus) => void;
    players?: (p: readonly PlayerInfo[]) => void;
    state?: (s: GameState) => void;
    end?: (s: GameState) => void;
    error?: (e: AdapterError) => void;
  } = {};
  const adapter: SevensAdapter = {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    createRoom: vi.fn(
      async (): Promise<SeatAssignment> => ({ roomId: "r1", seat: 0, token: "t0", passcode: "1234" }),
    ),
    joinRoom: vi.fn(async (): Promise<SeatAssignment> => ({ roomId: "r1", seat: 1, token: "t1" })),
    reconnect: vi.fn(async () => {}),
    start: vi.fn(async () => {}),
    send: vi.fn(),
    onConnectionChange: (cb) => {
      cbs.conn = cb;
      return () => {};
    },
    onPlayers: (cb) => {
      cbs.players = cb;
      return () => {};
    },
    onState: (cb) => {
      cbs.state = cb;
      return () => {};
    },
    onEnd: (cb) => {
      cbs.end = cb;
      return () => {};
    },
    onError: (cb) => {
      cbs.error = cb;
      return () => {};
    },
  };
  return { adapter, cbs };
}

describe("gameStore", () => {
  beforeEach(() => {
    useGameStore.getState().disconnect(); // 各テスト前に初期化
  });

  it("connect 後、onState 受信で gameState が更新される", async () => {
    const { adapter, cbs } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);
    expect(adapter.connect).toHaveBeenCalled();

    const fake = { phase: "playing" } as unknown as GameState;
    cbs.state!(fake);
    expect(useGameStore.getState().gameState).toBe(fake);
  });

  it("onPlayers / onConnectionChange / onError が state に反映される", async () => {
    const { adapter, cbs } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);

    cbs.conn!("connected");
    expect(useGameStore.getState().connection).toBe("connected");

    const players = [{ seat: 0, name: "A", isCpu: false, connected: true, isHost: true }];
    cbs.players!(players);
    expect(useGameStore.getState().players).toEqual(players);

    cbs.error!({ code: "ILLEGAL_ACTION", message: "その手は出せません" });
    expect(useGameStore.getState().lastError?.code).toBe("ILLEGAL_ACTION");
  });

  it("createRoom で roomId/mySeat/token/passcode が入る", async () => {
    const { adapter } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);
    await useGameStore.getState().createRoom("ホスト");
    const s = useGameStore.getState();
    expect(s).toMatchObject({ roomId: "r1", mySeat: 0, myToken: "t0", passcode: "1234" });
  });

  it("joinRoom で席1が入り passcode は付かない", async () => {
    const { adapter } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);
    await useGameStore.getState().joinRoom("1234", "B");
    const s = useGameStore.getState();
    expect(s).toMatchObject({ roomId: "r1", mySeat: 1, myToken: "t1", passcode: null });
  });

  it("disconnect で初期状態へ戻る", async () => {
    const { adapter } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);
    await useGameStore.getState().createRoom("ホスト");
    useGameStore.getState().disconnect();
    const s = useGameStore.getState();
    expect(s.roomId).toBeNull();
    expect(s.mySeat).toBeNull();
    expect(s.connection).toBe("disconnected");
    expect(adapter.disconnect).toHaveBeenCalled();
  });
});

describe("gameStore: 再接続セッション（#13）", () => {
  const g = globalThis as { sessionStorage?: Storage };

  beforeEach(() => {
    g.sessionStorage = new MemoryStorage() as unknown as Storage;
    useGameStore.getState().disconnect();
  });
  afterEach(() => {
    delete g.sessionStorage;
  });

  it("createRoom はセッションを sessionStorage に保存する", async () => {
    const { adapter } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);
    await useGameStore.getState().createRoom("ホスト");
    expect(loadSession()).toEqual({ roomId: "r1", seat: 0, token: "t0" });
  });

  it("restoreSession で保存済みセッションを state に復元する", () => {
    saveSession({ roomId: "r9", seat: 2, token: "tk" });
    expect(useGameStore.getState().restoreSession()).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ roomId: "r9", mySeat: 2, myToken: "tk" });
  });

  it("保存が無ければ restoreSession は false で state を変えない", () => {
    expect(useGameStore.getState().restoreSession()).toBe(false);
    expect(useGameStore.getState().roomId).toBeNull();
  });

  it("connected 復帰時、入室済みなら adapter.reconnect が呼ばれる", async () => {
    const { adapter, cbs } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);
    await useGameStore.getState().createRoom("ホスト"); // roomId/seat/token をセット
    cbs.conn!("connected");
    expect(adapter.reconnect).toHaveBeenCalledWith("r1", 0, "t0");
  });

  it("reconnect 失敗でセッションを破棄し ids をリセットする", async () => {
    const { adapter, cbs } = makeMockAdapter();
    adapter.reconnect = vi.fn(async () => {
      throw { code: "ROOM_NOT_FOUND", message: "部屋が見つかりません" } as AdapterError;
    });
    await useGameStore.getState().connect(adapter);
    saveSession({ roomId: "rX", seat: 1, token: "tX" });
    useGameStore.getState().restoreSession();
    cbs.conn!("connected");
    await flush();
    expect(useGameStore.getState().roomId).toBeNull();
    expect(useGameStore.getState().mySeat).toBeNull();
    expect(loadSession()).toBeNull();
  });

  it("disconnect はセッションを破棄する", async () => {
    const { adapter } = makeMockAdapter();
    await useGameStore.getState().connect(adapter);
    await useGameStore.getState().createRoom("ホスト");
    expect(loadSession()).not.toBeNull();
    useGameStore.getState().disconnect();
    expect(loadSession()).toBeNull();
  });
});
