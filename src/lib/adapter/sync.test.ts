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
  const adapters: LocalAdapter[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    io = new IOServer(httpServer);
    wireServer(io, new RoomStore());
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
});
