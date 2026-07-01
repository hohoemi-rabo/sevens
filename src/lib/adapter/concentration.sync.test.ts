// in-process Socket.io 結合テスト（神経衰弱・フェーズ3の完了条件の自動保証）。
// 実サーバー（http + socket.io + RoomStore）を立て、LocalAdapter を2つ繋ぎ、
// 「中身が席ごとに秘匿される（getView）／覗き見は発動者だけに届く／CPU補完で全局が完走する」を機械保証する。
// 進行は決定論のため、駆動側はサーバー権威状態を覗いて確実にペアを揃える（クライアント view は秘匿されている）。

import { createServer, type Server as HttpServer } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Server as IOServer } from "socket.io";
import { LocalAdapter } from "@/lib/adapter/local";
import { RoomStore } from "@/lib/server/session";
import type { ConcentrationState } from "@/lib/concentration/state";
import type { ConcentrationView } from "@/lib/concentration/module";

/** ゲーム非依存の socket グルー（sync.test.ts と同等・CPU/自動resolve は即時に進める）。 */
function wireServer(io: IOServer, store: RoomStore): void {
  const broadcast = (roomId: string): void => {
    if (store.getState(roomId) == null) return;
    if (store.viewIsPublic(roomId)) {
      io.to(roomId).emit("game:state", store.viewFor(roomId, 0));
    } else {
      for (const { seat, socketId } of store.seatSockets(roomId)) {
        io.to(socketId).emit("game:state", store.viewFor(roomId, seat));
      }
    }
    if (store.isFinished(roomId)) io.to(roomId).emit("game:end", store.viewFor(roomId, 0));
  };
  const driveAndBroadcast = (roomId: string): void => {
    if (store.advanceAuto(roomId)) broadcast(roomId);
  };

  io.on("connection", (socket) => {
    const data = socket.data as { roomId?: string; seat?: number };

    socket.on("room:create", ({ name, gameId }: { name: string; gameId?: string }, ack?: (r: unknown) => void) => {
      const res = store.createRoom(name, gameId);
      if (!res.ok) return ack?.(res.error);
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      store.bindSocket(res.value.roomId, res.value.seat, socket.id);
      socket.join(res.value.roomId);
      ack?.(res.value);
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on("room:join", ({ passcode, name }: { passcode: string; name: string }, ack?: (r: unknown) => void) => {
      const res = store.joinRoom(passcode, name);
      if (!res.ok) return ack?.(res.error);
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      store.bindSocket(res.value.roomId, res.value.seat, socket.id);
      socket.join(res.value.roomId);
      ack?.(res.value);
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on("game:start", ({ opts }: { opts?: unknown }, ack?: (r: unknown) => void) => {
      if (data.roomId === undefined || data.seat !== 0) return ack?.({ code: "NOT_HOST", message: "ホスト限定" });
      const res = store.startGame(data.roomId, opts as never);
      if (!res.ok) return ack?.(res.error);
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAndBroadcast(data.roomId);
    });

    const onAction = (action: unknown) => {
      if (data.roomId === undefined || data.seat === undefined) return;
      const res = store.applyPlayerAction(data.roomId, data.seat, action);
      if (!res.ok) return socket.emit("app:error", res.error);
      broadcast(data.roomId);
      driveAndBroadcast(data.roomId);
    };
    socket.on("player:action", ({ action }: { action: unknown }) => onAction(action));

    socket.on("disconnect", () => {
      const loc = store.markDisconnected(socket.id);
      if (loc) {
        io.to(loc.roomId).emit("room:players", store.getPlayers(loc.roomId));
        driveAndBroadcast(loc.roomId);
      }
    });
  });
}

const until = async (pred: () => boolean, timeout = 4000, interval = 5): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("until: timed out");
};

describe("神経衰弱: in-process 同期・秘匿", () => {
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

  /** サーバー権威の全状態（駆動側だけが読む＝クライアント view は秘匿されている）。 */
  const auth = (roomId: string) => store.getState(roomId) as ConcentrationState;
  /** 伏せトランプの中で同ランク2枚の位置（＝確実に揃うペア）。 */
  const facedownPair = (s: ConcentrationState): [number, number] | null => {
    const byRank = new Map<number, number[]>();
    for (const sl of s.slots) {
      if (sl.status === "facedown" && sl.face.type === "trump") {
        const r = sl.face.card.rank;
        const arr = byRank.get(r) ?? [];
        arr.push(sl.pos);
        byRank.set(r, arr);
      }
    }
    for (const arr of byRank.values()) if (arr.length >= 2) return [arr[0], arr[1]];
    return null;
  };

  it("伏せ札の中身は各端末に届かない（めくった札だけ全員に見える）", async () => {
    const a = await connect();
    const b = await connect();
    let lastA: ConcentrationView | null = null;
    let lastB: ConcentrationView | null = null;
    a.onState((v) => (lastA = v as ConcentrationView));
    b.onState((v) => (lastB = v as ConcentrationView));

    const ca = await a.createRoom("A", "concentration");
    await b.joinRoom(ca.passcode!, "B");
    await a.start({ concentration: { pairCount: 6, specialRatio: 0 }, seed: 1 });
    await until(() => !!lastA && !!lastB);

    // 開始直後は全ての伏せ札の中身が届かない（両端末とも）。
    expect(lastA!.slots.every((s) => s.face === undefined)).toBe(true);
    expect(lastB!.slots.every((s) => s.face === undefined)).toBe(true);

    // A（席0）が1枚めくると、その1枚だけが相手（B）にも見える。残りは依然として秘匿。
    const pos = auth(ca.roomId).slots.find((sl) => sl.status === "facedown" && sl.face.type === "trump")!.pos;
    a.send({ type: "flip", pos });
    await until(() => !!lastB && lastB!.slots[pos].face !== undefined);
    expect(lastB!.slots.filter((s) => s.face !== undefined)).toHaveLength(1);
  });

  it("覗き見は発動者の端末にだけ中身が届く", async () => {
    const a = await connect();
    const b = await connect();
    let lastA: ConcentrationView | null = null;
    let lastB: ConcentrationView | null = null;
    a.onState((v) => (lastA = v as ConcentrationView));
    b.onState((v) => (lastB = v as ConcentrationView));

    const ca = await a.createRoom("A", "concentration");
    await b.joinRoom(ca.passcode!, "B");
    await a.start({ concentration: { pairCount: 13, specialRatio: 0.3 }, seed: 11 });
    await until(() => !!lastA && !!lastB);

    // A が覗き見カードをめくり、伏せ札1枚を覗く。
    const peekPos = auth(ca.roomId).slots.find(
      (sl) => sl.status === "facedown" && sl.face.type === "special" && sl.face.special.kind === "peek",
    )!.pos;
    a.send({ type: "flip", pos: peekPos });
    await until(() => auth(ca.roomId).pending?.type === "choose-peek");
    const target = auth(ca.roomId).slots.find((sl) => sl.status === "facedown" && sl.face.type === "trump")!.pos;
    a.send({ type: "peek", pos: target });
    await until(() => auth(ca.roomId).peek?.pos === target);

    // 発動者 A の view には対象の中身が載り、相手 B には届かない。
    await until(() => !!lastA && lastA!.slots[target].face !== undefined);
    expect(lastA!.slots[target].face).toBeDefined();
    expect(lastB!.slots[target].face).toBeUndefined();
  });

  it("2人＋CPU補完で全局が完走し、得点が全ペア点数に一致する", async () => {
    const a = await connect();
    const b = await connect();
    let lastA: ConcentrationView | null = null;
    a.onState((v) => (lastA = v as ConcentrationView));

    const ca = await a.createRoom("A", "concentration");
    await b.joinRoom(ca.passcode!, "B");
    await a.start({ concentration: { pairCount: 6, specialRatio: 0 }, seed: 3 });
    await until(() => !!lastA);

    // A（席0）が権威状態を頼りに確実にペアを揃え続ける（揃えば連続手番なので A が取り切る）。
    let guard = 0;
    while (auth(ca.roomId).phase !== "ended" && guard++ < 200) {
      const s = auth(ca.roomId);
      if (s.currentSeat !== 0) {
        await until(() => auth(ca.roomId).currentSeat === 0 || auth(ca.roomId).phase === "ended");
        continue;
      }
      const pair = facedownPair(s);
      if (!pair) break;
      const [p1, p2] = pair;
      a.send({ type: "flip", pos: p1 });
      await until(() => auth(ca.roomId).revealed.includes(p1));
      a.send({ type: "flip", pos: p2 });
      await until(() => auth(ca.roomId).slots[p1].status === "collected" || auth(ca.roomId).phase === "ended");
    }

    expect(auth(ca.roomId).phase).toBe("ended");
    const finalState = auth(ca.roomId);
    const totalPoints = Object.values(finalState.pointByRank).reduce((x, v) => x + v, 0);
    await until(() => !!lastA && lastA!.phase === "ended");
    const scored = lastA!.players.reduce((x, p) => x + p.score, 0);
    expect(scored).toBe(totalPoints);
  });
});
