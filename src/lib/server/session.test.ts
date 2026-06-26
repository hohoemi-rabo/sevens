// RoomStore（サーバー権威セッションコア）の振る舞いテスト（純粋・socket 不要）。
// シードを固定して決定論的に検証する。ゲームロジックの内部実装ではなく、部屋管理・席割り・
// サーバー権威（不正手の拒否・状態不変）・CPU 自動進行・切断/再接続シームの振る舞いを見る。

import { describe, expect, it } from "vitest";
import { RoomStore } from "@/lib/server/session";
import { type GameState } from "@/lib/sevens/state";
import { cardId, SUITS } from "@/lib/sevens/cards";
import { decideWeak } from "@/lib/sevens/cpu";

/** 場＋全手札の総枚数（保存則の検証用）。 */
const totalCards = (state: GameState): number => {
  const onBoard = SUITS.reduce((sum, s) => sum + state.board[s].length, 0);
  const inHands = state.players.reduce((sum, p) => sum + p.hand.length, 0);
  return onBoard + inHands;
};

/** 場＋全手札に現れる全カードIDの集合（重複検出用）。 */
const allCardIds = (state: GameState): string[] => {
  const fromBoard = SUITS.flatMap((s) => state.board[s].map((rank) => cardId({ suit: s, rank })));
  const fromHands = state.players.flatMap((p) => p.hand.map(cardId));
  return [...fromBoard, ...fromHands];
};

const created = (store: RoomStore, name = "ホスト") => {
  const res = store.createRoom(name);
  if (!res.ok) throw new Error(`createRoom failed: ${res.error.code}`);
  return res.value;
};

describe("RoomStore: 部屋作成", () => {
  it("ホストは席0・4桁passcode・isHost で作られる", () => {
    const store = new RoomStore();
    const { roomId, passcode, seat } = created(store);
    expect(seat).toBe(0);
    expect(passcode).toMatch(/^\d{4}$/);
    const players = store.getPlayers(roomId);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({ seat: 0, isHost: true, isCpu: false, connected: true });
  });

  it("空の名前は NAME_REQUIRED", () => {
    const store = new RoomStore();
    const res = store.createRoom("   ");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NAME_REQUIRED");
  });

  it("複数部屋で passcode は一意", () => {
    const store = new RoomStore();
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) codes.add(created(store, `h${i}`).passcode);
    expect(codes.size).toBe(50);
  });

  it("passcode は getPlayers / getState に漏れない", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    store.fillWithCpu(roomId);
    store.startGame(roomId, { seed: 1 });
    for (const p of store.getPlayers(roomId)) expect(p).not.toHaveProperty("passcode");
    expect(store.getState(roomId)).not.toHaveProperty("passcode");
  });
});

describe("RoomStore: 入室・席割り", () => {
  it("席は 0→1→2→3 の順で割り当てられ、5人目は ROOM_FULL", () => {
    const store = new RoomStore();
    const { passcode } = created(store);
    expect(store.joinRoom(passcode, "B")).toMatchObject({ ok: true, value: { seat: 1 } });
    expect(store.joinRoom(passcode, "C")).toMatchObject({ ok: true, value: { seat: 2 } });
    expect(store.joinRoom(passcode, "D")).toMatchObject({ ok: true, value: { seat: 3 } });
    const full = store.joinRoom(passcode, "E");
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.error.code).toBe("ROOM_FULL");
  });

  it("誤った/未存在の passcode は WRONG_PASSCODE", () => {
    const store = new RoomStore();
    created(store);
    const res = store.joinRoom("9999", "B");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("WRONG_PASSCODE");
  });

  it("開始後の入室は GAME_ALREADY_STARTED", () => {
    const store = new RoomStore();
    const { roomId, passcode } = created(store);
    store.startGame(roomId, { seed: 1 });
    const res = store.joinRoom(passcode, "B");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("GAME_ALREADY_STARTED");
  });

  it("token は席ごとに一意", () => {
    const store = new RoomStore();
    const a = created(store);
    const b = store.joinRoom(a.passcode, "B");
    expect(b.ok && b.value.token).not.toBe(a.token);
  });
});

describe("RoomStore: CPU補完・開始", () => {
  it("fillWithCpu は空席だけ CPU で埋め、冪等", () => {
    const store = new RoomStore();
    const { roomId, passcode } = created(store);
    store.joinRoom(passcode, "B"); // 席1は人間
    store.fillWithCpu(roomId);
    store.fillWithCpu(roomId); // 2回呼んでも変化しない
    const players = store.getPlayers(roomId);
    expect(players).toHaveLength(4);
    expect(players.filter((p) => p.isCpu)).toHaveLength(2); // 席2,3
    expect(players[1].isCpu).toBe(false); // 席1の人間は維持
  });

  it("CPU強さ指定で開始しても終局まで到達する（当面 weak 挙動）", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    const res = store.startGame(roomId, { seed: 7, cpuStrength: "strong" });
    expect(res.ok).toBe(true);
    // 人間席(0)も機械応答で進め、strategyFor 経由でも終局に至ることを確認。
    let guard = 0;
    while (store.getState(roomId)!.phase !== "ended" && guard++ < 2000) {
      store.advanceAuto(roomId);
      const st = store.getState(roomId)!;
      if (st.phase === "ended") break;
      store.applyPlayerAction(roomId, st.currentSeat, decideWeak(st, `p${st.currentSeat}`));
    }
    expect(store.getState(roomId)!.phase).toBe("ended");
  });

  it("同じ seed なら GameState は決定的", () => {
    const a = new RoomStore();
    const b = new RoomStore();
    const ra = created(a);
    const rb = created(b);
    const sa = a.startGame(ra.roomId, { seed: 42, maxPass: 3 });
    const sb = b.startGame(rb.roomId, { seed: 42, maxPass: 3 });
    expect(sa.ok && sb.ok).toBe(true);
    if (sa.ok && sb.ok) expect(sa.value).toEqual(sb.value);
  });

  it("二重開始は GAME_ALREADY_STARTED", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    store.startGame(roomId, { seed: 1 });
    const res = store.startGame(roomId, { seed: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("GAME_ALREADY_STARTED");
  });

  it("maxPass が範囲外なら INVALID_OPTIONS", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    const res = store.startGame(roomId, { seed: 1, maxPass: 9 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INVALID_OPTIONS");
  });

  it("未存在の部屋の開始は ROOM_NOT_FOUND", () => {
    const store = new RoomStore();
    const res = store.startGame("nope", { seed: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("ROOM_NOT_FOUND");
  });
});

describe("RoomStore: サーバー権威", () => {
  it("未開始の部屋へのアクションは GAME_NOT_STARTED", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    const res = store.applyPlayerAction(roomId, 0, { type: "pass" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("GAME_NOT_STARTED");
  });

  it("手番外の席のアクションは ILLEGAL_ACTION で、状態は不変（参照同一）", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    store.startGame(roomId, { seed: 7 });
    const before = store.getState(roomId)!;
    const wrongSeat = ((before.currentSeat + 1) % 4) as number;
    const res = store.applyPlayerAction(roomId, wrongSeat, { type: "pass" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("ILLEGAL_ACTION");
    expect(store.getState(roomId)).toBe(before); // mutate していない
  });

  it("手番者の合法手は受理され、状態が進む", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    store.startGame(roomId, { seed: 7 });
    const before = store.getState(roomId)!;
    const seat = before.currentSeat;
    const action = decideWeak(before, `p${seat}`);
    const res = store.applyPlayerAction(roomId, seat, action);
    expect(res.ok).toBe(true);
    expect(store.getState(roomId)).not.toBe(before); // 新しい状態に置き換わった
  });
});

describe("RoomStore: ヘッドレス1局", () => {
  // host=人間(席0)＋3CPU。人間席も decideWeak で機械応答し、終局まで到達することと
  // 「場＋全手札＝52枚・重複なし」の保存則を全工程で確認する。
  it.each([1, 2, 3, 7, 99])("seed=%i で終局まで到達し、カード保存則が常に成り立つ", (seed) => {
    const store = new RoomStore();
    const { roomId } = created(store);
    store.startGame(roomId, { seed });

    let guard = 0;
    while (store.getState(roomId)!.phase !== "ended" && guard++ < 2000) {
      // CPU（自動席）を人間の手番 or 終局まで進める。
      store.advanceAuto(roomId);
      let st = store.getState(roomId)!;
      expect(totalCards(st)).toBe(52);
      expect(new Set(allCardIds(st)).size).toBe(52);
      if (st.phase === "ended") break;
      // 接続中の人間席（席0）を機械応答で進める。
      const seat = st.currentSeat;
      const res = store.applyPlayerAction(roomId, seat, decideWeak(st, `p${seat}`));
      expect(res.ok).toBe(true);
      st = store.getState(roomId)!;
      expect(totalCards(st)).toBe(52);
      expect(new Set(allCardIds(st)).size).toBe(52);
    }
    expect(store.getState(roomId)!.phase).toBe("ended");
  });
});

describe("RoomStore: rematch（#17 もう一回）", () => {
  /** 終局まで進める（人間席は decideWeak で機械応答）。 */
  const playToEnd = (store: RoomStore, roomId: string) => {
    let guard = 0;
    while (store.getState(roomId)!.phase !== "ended" && guard++ < 2000) {
      store.advanceAuto(roomId);
      const st = store.getState(roomId)!;
      if (st.phase === "ended") break;
      store.applyPlayerAction(roomId, st.currentSeat, decideWeak(st, `p${st.currentSeat}`));
    }
  };

  it("終局後に再戦すると全員 playing・手札が再配分され、カード保存則が成り立つ", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    store.startGame(roomId, { seed: 1, maxPass: 4, startMode: "all7", cpuStrength: "medium" });
    playToEnd(store, roomId);

    const res = store.rematch(roomId);
    expect(res.ok).toBe(true);
    const st = store.getState(roomId)!;
    expect(st.phase).toBe("playing");
    expect(st.players.every((p) => p.status === "playing")).toBe(true);
    expect(totalCards(st)).toBe(52);
    expect(new Set(allCardIds(st)).size).toBe(52);
    // 設定（maxPass/startMode）は引き継ぐ。
    expect(st.maxPass).toBe(4);
    expect(st.startMode).toBe("all7");
  });

  it("席編成（名前・CPU）は再戦でも保持される", () => {
    const store = new RoomStore();
    const { roomId } = created(store, "せんせい");
    store.startGame(roomId, { seed: 2 });
    playToEnd(store, roomId);
    const before = store.getPlayers(roomId);
    store.rematch(roomId);
    expect(store.getPlayers(roomId)).toEqual(before);
  });

  it("未開始・未終局では GAME_NOT_STARTED で拒否する", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    expect(store.rematch(roomId).ok).toBe(false); // 未開始
    store.startGame(roomId, { seed: 1 });
    const mid = store.rematch(roomId); // 進行中
    expect(mid.ok).toBe(false);
    if (!mid.ok) expect(mid.error.code).toBe("GAME_NOT_STARTED");
  });

  it("存在しない部屋は ROOM_NOT_FOUND", () => {
    const store = new RoomStore();
    const res = store.rematch("nope");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("ROOM_NOT_FOUND");
  });
});

describe("RoomStore: stepAuto", () => {
  it("接続中の人間の手番では停止する（acted:false）", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    // CPU を埋めず人間1人だけ → 開始で席1〜3が CPU 補完される。
    store.startGame(roomId, { seed: 7 });
    // 人間席（席0）が手番になるまで CPU を進める。
    store.advanceAuto(roomId);
    const st = store.getState(roomId)!;
    if (st.phase !== "ended") {
      expect(st.currentSeat).toBe(0); // 人間席で停止
      expect(store.stepAuto(roomId).acted).toBe(false);
    }
  });
});

describe("RoomStore: 切断・再接続（#13シーム）", () => {
  it("bindSocket→markDisconnected→reconnect(token) で席を復元できる", () => {
    const store = new RoomStore();
    const { roomId, token } = created(store);
    store.bindSocket(roomId, 0, "sock-A");
    expect(store.getPlayers(roomId)[0].connected).toBe(true);

    const loc = store.markDisconnected("sock-A");
    expect(loc).toEqual({ roomId, seat: 0 });
    expect(store.getPlayers(roomId)[0].connected).toBe(false);

    const ok = store.reconnect(roomId, 0, token, "sock-B");
    expect(ok.ok).toBe(true);
    expect(store.getPlayers(roomId)[0].connected).toBe(true);
  });

  it("誤った token の再接続は ROOM_NOT_FOUND に丸める", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    const res = store.reconnect(roomId, 0, "bad-token", "sock-X");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("ROOM_NOT_FOUND");
  });

  it("再束縛後、旧 socketId の切断は無視される（競合回避）", () => {
    const store = new RoomStore();
    const { roomId, token } = created(store);
    store.bindSocket(roomId, 0, "sock-A");
    store.markDisconnected("sock-A");
    store.reconnect(roomId, 0, token, "sock-B"); // 別IDに束ね直し
    expect(store.markDisconnected("sock-A")).toBeNull(); // 旧IDの切断は該当なし
    expect(store.getPlayers(roomId)[0].connected).toBe(true);
  });

  it("切断中の人間席は CPU 代行で進む（stepAuto が acted:true）", () => {
    const store = new RoomStore();
    const { roomId } = created(store);
    store.bindSocket(roomId, 0, "sock-A");
    store.startGame(roomId, { seed: 7 });
    store.advanceAuto(roomId); // 人間席(0)の手番で止まる（終局でなければ）
    const st = store.getState(roomId)!;
    if (st.phase !== "ended" && st.currentSeat === 0) {
      store.markDisconnected("sock-A"); // 席0を切断扱いに
      expect(store.stepAuto(roomId).acted).toBe(true); // 代行で一手進む
    }
  });
});
