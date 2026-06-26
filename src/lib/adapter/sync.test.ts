// in-process Socket.io 結合テスト（チケット10の完了条件の自動保証）。
// 実サーバー（http + socket.io + RoomStore）を立て、LocalAdapter を2つ繋いで
// 「複数クライアントで状態が同期し、操作が反映される」ことを機械的に検証する。
// server.ts の socket グルーと同等の配線をテスト内に最小再現する（Next は使わない）。

import { createServer, type Server as HttpServer } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Server as IOServer } from "socket.io";
import { LocalAdapter } from "@/lib/adapter/local";
import { RoomStore } from "@/lib/server/session";
import { type GameState, currentPlayer, serializeState } from "@/lib/sevens/state";
import { decideWeak } from "@/lib/sevens/cpu";

/** server.ts と同じ責務の socket グルーを RoomStore に配線する（CPU は即時に進める）。 */
function wireServer(io: IOServer, store: RoomStore): void {
  const broadcast = (roomId: string): void => {
    const state = store.getState(roomId);
    if (!state) return;
    io.to(roomId).emit("game:state", state);
    if (state.phase === "ended") io.to(roomId).emit("game:end", state);
  };
  // テストは決定論を優先し、CPU を遅延なしでまとめて進めてから配信する。
  const driveAndBroadcast = (roomId: string): void => {
    if (store.advanceAuto(roomId)) broadcast(roomId);
  };

  io.on("connection", (socket) => {
    const data = socket.data as { roomId?: string; seat?: number };

    socket.on("room:create", ({ name }: { name: string }, ack?: (res: unknown) => void) => {
      const res = store.createRoom(name);
      if (!res.ok) return ack?.(res.error);
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      store.bindSocket(res.value.roomId, res.value.seat, socket.id);
      socket.join(res.value.roomId);
      ack?.(res.value);
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on("room:join", ({ passcode, name }: { passcode: string; name: string }, ack?: (res: unknown) => void) => {
      const res = store.joinRoom(passcode, name);
      if (!res.ok) return ack?.(res.error);
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      store.bindSocket(res.value.roomId, res.value.seat, socket.id);
      socket.join(res.value.roomId);
      ack?.(res.value);
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on("game:start", ({ opts }: { opts?: unknown }, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined || data.seat !== 0) {
        return ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" });
      }
      const res = store.startGame(data.roomId, opts as never);
      if (!res.ok) return ack?.(res.error);
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAndBroadcast(data.roomId);
    });

    // もう一回（ホスト限定・終局後）。#17
    socket.on("game:rematch", (_p: unknown, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined || data.seat !== 0) {
        return ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" });
      }
      const res = store.rematch(data.roomId);
      if (!res.ok) return ack?.(res.error);
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAndBroadcast(data.roomId);
    });

    // 部屋を解散（ホスト限定）。#17
    socket.on("room:dissolve", (_p: unknown, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined || data.seat !== 0) {
        return ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" });
      }
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:dissolved");
      store.removeRoom(data.roomId);
    });

    const onAction = (action: Parameters<RoomStore["applyPlayerAction"]>[2]) => {
      if (data.roomId === undefined || data.seat === undefined) return;
      const res = store.applyPlayerAction(data.roomId, data.seat, action);
      if (!res.ok) {
        socket.emit("app:error", res.error);
        return;
      }
      broadcast(data.roomId);
      driveAndBroadcast(data.roomId);
    };
    socket.on("player:play", ({ card }: { card: never }) => onAction({ type: "play", card }));
    socket.on("player:pass", () => onAction({ type: "pass" }));

    // 再接続（#13）: トークンで席を再束縛し、現状態を再送する。
    socket.on(
      "room:reconnect",
      (
        { roomId, seat, token }: { roomId: string; seat: number; token: string },
        ack?: (res: unknown) => void,
      ) => {
        const res = store.reconnect(roomId, seat, token, socket.id);
        if (!res.ok) return ack?.(res.error);
        data.roomId = roomId;
        data.seat = seat;
        socket.join(roomId);
        ack?.({ ok: true });
        io.to(roomId).emit("room:players", store.getPlayers(roomId));
        broadcast(roomId);
      },
    );

    socket.on("disconnect", () => {
      const loc = store.markDisconnected(socket.id);
      if (loc) {
        io.to(loc.roomId).emit("room:players", store.getPlayers(loc.roomId));
        driveAndBroadcast(loc.roomId);
      }
    });
  });
}

/** 条件が真になるまで待つ（ポーリング）。 */
const until = async (pred: () => boolean, timeout = 4000, interval = 10): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("until: timed out");
};

describe("in-process Socket.io 同期", () => {
  let httpServer: HttpServer;
  let io: IOServer;
  let url: string;
  let store: RoomStore;
  const adapters: LocalAdapter[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    io = new IOServer(httpServer);
    store = new RoomStore();
    wireServer(io, store);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    for (const a of adapters) a.disconnect();
    adapters.length = 0;
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  const connect = async (): Promise<LocalAdapter> => {
    const a = new LocalAdapter(url);
    adapters.push(a);
    await a.connect();
    return a;
  };

  it("2クライアントが同じ game:state を受信し、操作が双方に反映される", async () => {
    const a = await connect();
    const b = await connect();

    const last: { a: GameState | null; b: GameState | null } = { a: null, b: null };
    a.onState((s) => (last.a = s));
    b.onState((s) => (last.b = s));

    // A がホストで部屋作成、B が参加（席1）。残り2席は CPU 補完。
    const ca = await a.createRoom("Aさん");
    await b.joinRoom(ca.passcode!, "Bさん");
    await a.start({ seed: 7, maxPass: 3, startMode: "diamond7" });

    // 両者が同一の状態を受信している。
    await until(() => !!last.a && !!last.b && serializeState(last.a) === serializeState(last.b));
    expect(serializeState(last.a!)).toBe(serializeState(last.b!));

    if (last.a!.phase === "ended") return; // まれに即終局なら反映テストはスキップ

    // 手番の人間（席0=A or 席1=B）が合法手を出すと、両者の状態が同じく更新される。
    const before = serializeState(last.a!);
    const turnSeat = currentPlayer(last.a!).seat;
    expect([0, 1]).toContain(turnSeat); // CPU 補完後は人間の手番で止まっているはず
    const actor = turnSeat === 0 ? a : b;
    actor.send(decideWeak(last.a!, `p${turnSeat}`));

    await until(
      () => !!last.a && !!last.b && serializeState(last.a) !== before && serializeState(last.a) === serializeState(last.b),
    );
    expect(serializeState(last.a!)).not.toBe(before);
    expect(serializeState(last.a!)).toBe(serializeState(last.b!));
  });

  it("手番外の不正手は app:error(ILLEGAL_ACTION) を返し、状態は変わらない", async () => {
    const a = await connect();
    const b = await connect();

    const last: { a: GameState | null } = { a: null };
    let lastError: string | null = null;
    a.onState((s) => (last.a = s));
    // どちらの人間が誤操作側になっても拾えるよう、両者の onError を監視する。
    a.onError((e) => (lastError = e.code));
    b.onError((e) => (lastError = e.code));

    const ca = await a.createRoom("Aさん");
    await b.joinRoom(ca.passcode!, "Bさん");
    await a.start({ seed: 7, maxPass: 3, startMode: "diamond7" });
    await until(() => !!last.a);
    if (last.a!.phase === "ended") return;

    const turnSeat = currentPlayer(last.a!).seat;
    const before = serializeState(last.a!);
    // 手番でない側の人間から送って弾かせる。
    const offender = turnSeat === 0 ? b : a;
    offender.send({ type: "pass" });

    await until(() => lastError !== null || serializeState(last.a!) !== before);
    expect(lastError).toBe("ILLEGAL_ACTION");
    expect(serializeState(last.a!)).toBe(before); // 状態は不変
  });

  it("切断→トークン再接続で権威状態が復元され、同じ席に戻る", async () => {
    // A(席0,ホスト)＋B(席1)＋CPU2。B が接続を保つので A 切断でも対局は終局しない。
    const a = await connect();
    const b = await connect();
    let bLast: GameState | null = null;
    b.onState((s) => (bLast = s));

    const ca = await a.createRoom("Aさん");
    await b.joinRoom(ca.passcode!, "Bさん");
    await a.start({ seed: 7, maxPass: 3, startMode: "diamond7", fillWithCpu: true });
    await until(() => !!bLast);

    // A が切断（サーバーは席0を !connected にし、CPU 代行で B の手番まで進める）。
    a.disconnect();
    await until(() => store.getPlayers(ca.roomId).some((p) => p.seat === 0 && !p.connected));

    // 新しい端末（A2）がトークンで再接続。現在の権威状態を受信する。
    const a2 = await connect();
    let a2Last: GameState | null = null;
    a2.onState((s) => (a2Last = s));
    await a2.reconnect(ca.roomId, ca.seat, ca.token);

    // A2 の受信状態がサーバーの権威状態（＝B が見ている状態）と一致する。
    await until(() => !!a2Last && serializeState(a2Last) === serializeState(store.getState(ca.roomId)!));
    expect(serializeState(a2Last!)).toBe(serializeState(store.getState(ca.roomId)!));
    expect(serializeState(a2Last!)).toBe(serializeState(bLast!));
    // 席0（A）に戻っている＝CPU 名ではなく "Aさん"。
    expect(a2Last!.players.find((p) => p.seat === 0)!.name).toBe("Aさん");
    expect(store.getPlayers(ca.roomId).find((p) => p.seat === 0)!.connected).toBe(true);
  });

  it("ホストの『もう一回』で全クライアントが新しい対局状態を受信する（#17）", async () => {
    const a = await connect();
    const b = await connect();
    const last: { a: GameState | null; b: GameState | null } = { a: null, b: null };
    a.onState((s) => (last.a = s));
    b.onState((s) => (last.b = s));

    const ca = await a.createRoom("Aさん");
    await b.joinRoom(ca.passcode!, "Bさん");
    await a.start({ seed: 7, maxPass: 3, startMode: "diamond7" });
    await until(() => !!last.a && !!last.b);

    // 人間（席0=A / 席1=B）が合法手を出し続けて終局させる（auto席は server が進める）。
    while (last.a!.phase !== "ended") {
      const seat = currentPlayer(last.a!).seat;
      const actor = seat === 0 ? a : seat === 1 ? b : null;
      if (!actor) {
        await until(() => last.a!.phase === "ended" || [0, 1].includes(currentPlayer(last.a!).seat));
        continue;
      }
      const before = serializeState(last.a!);
      actor.send(decideWeak(last.a!, `p${seat}`));
      await until(() => serializeState(last.a!) !== before);
    }
    expect(last.a!.phase).toBe("ended");

    // ホストが「もう一回」→ 全員が新しい playing 状態を受信し、両者一致。
    await a.rematch();
    await until(
      () => last.a!.phase === "playing" && last.b!.phase === "playing" &&
        serializeState(last.a!) === serializeState(last.b!),
    );
    expect(last.a!.players.every((p) => p.status === "playing")).toBe(true);
    expect(serializeState(last.a!)).toBe(serializeState(last.b!));
  });

  it("ホストの『部屋を解散』で全クライアントに onDissolved が届く（#17）", async () => {
    const a = await connect();
    const b = await connect();
    let aDissolved = false;
    let bDissolved = false;
    a.onDissolved(() => (aDissolved = true));
    b.onDissolved(() => (bDissolved = true));

    const ca = await a.createRoom("Aさん");
    await b.joinRoom(ca.passcode!, "Bさん");
    await a.start({ seed: 7 });

    await a.dissolve();
    await until(() => aDissolved && bDissolved);
    expect(aDissolved && bDissolved).toBe(true);
    expect(store.getState(ca.roomId)).toBeNull(); // 部屋は破棄済み
  });

  it("誤ったトークンの再接続は拒否される", async () => {
    const a = await connect();
    const ca = await a.createRoom("Aさん");
    await a.start({ seed: 7, fillWithCpu: true });

    const a2 = await connect();
    await expect(a2.reconnect(ca.roomId, ca.seat, "wrong-token")).rejects.toMatchObject({
      code: "ROOM_NOT_FOUND",
    });
  });
});
