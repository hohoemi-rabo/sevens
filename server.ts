// カスタムサーバー: Next.js（App Router）と Socket.io を同居させる（docs/10 / REQUIREMENTS §6.2, §7.1）。
// 純粋セッションコア（src/lib/server/session.ts）の薄いグルー。ルールは持たない。
// 起動: tsx server.ts（npm run dev / start）。状態はメモリのみ（DB無し）。
//
// 7並べはアクションが play/pass の2種だけ。CPU の思考遅延（演出）と切断時の代行を driveAutoTimed が担う。

import { createServer } from "node:http";
import os from "node:os";
import next from "next";
import { Server, type Socket } from "socket.io";
import { type GameState } from "@/lib/sevens/state";
import { type Card } from "@/lib/sevens/cards";
import { type Action } from "@/lib/sevens/cpu";
import { RoomStore } from "@/lib/server/session";
import type { ClientToken, RoomId, Seat, StartOptions } from "@/lib/adapter/types";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
// LAN内の他端末から繋げるよう全インターフェースで待受（既定 0.0.0.0。HOST で上書き可）。
const host = process.env.HOST ?? "0.0.0.0";
const app = next({ dev, turbopack: dev });
const handle = app.getRequestHandler();

/** 非内部 IPv4（LANアドレス）の一覧。QR/URL 表示の手がかりにログ出力する。 */
const lanIPv4 = (): string[] =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((n): n is os.NetworkInterfaceInfo => !!n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);

const store = new RoomStore();

interface SocketData {
  roomId?: RoomId;
  seat?: Seat;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer);

  /**
   * 適用前後の状態を比較して、新たに上がった/脱落した席を個別イベントで通知する
   * （音声・拍手などの演出フック・#14/#17 用）。状態同期そのものは game:state が担う。
   */
  const emitTransitions = (roomId: RoomId, before: GameState | null, after: GameState): void => {
    if (!before) return;
    for (const p of after.players) {
      const prev = before.players.find((q) => q.seat === p.seat);
      if (!prev) continue;
      if (prev.status !== "finished" && p.status === "finished") {
        io.to(roomId).emit("player:finish", { seat: p.seat, rank: p.rank });
      }
      if (prev.status !== "eliminated" && p.status === "eliminated") {
        io.to(roomId).emit("player:eliminated", { seat: p.seat, eliminatedOrder: p.eliminatedOrder });
      }
    }
  };

  const broadcast = (roomId: RoomId): void => {
    const state = store.getState(roomId);
    if (!state) return;
    io.to(roomId).emit("game:state", state);
    if (state.phase === "ended") io.to(roomId).emit("game:end", state);
  };

  // CPUの思考演出の間（ms）。CPU_DELAY_MS env で上書き（テスト/開発は 0）。既定 0.8〜1.8s（§3.4）。
  const cpuDelay = (): number => {
    const env = Number(process.env.CPU_DELAY_MS);
    return Number.isFinite(env) ? env : 800 + Math.floor(Math.random() * 1000);
  };

  // 自動席（CPU・切断中の人間＝代行）の手を一手ずつ遅延配信する（1room1チェイン・多重起動ガード）。
  const driveTimers = new Map<RoomId, NodeJS.Timeout>();
  const driveAutoTimed = (roomId: RoomId): void => {
    if (driveTimers.has(roomId)) return;
    const tick = (): void => {
      driveTimers.delete(roomId);
      const before = store.getState(roomId);
      const r = store.stepAuto(roomId);
      if (!r.acted || !r.state) return; // 接続中の人間の手番 / 終局 / 該当なしで停止
      emitTransitions(roomId, before, r.state);
      io.to(roomId).emit("game:state", r.state);
      if (r.state.phase === "ended") {
        io.to(roomId).emit("game:end", r.state);
        return;
      }
      driveTimers.set(roomId, setTimeout(tick, cpuDelay()));
    };
    driveTimers.set(roomId, setTimeout(tick, cpuDelay()));
  };

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    const applyAndBroadcast = (action: Action): void => {
      if (data.roomId === undefined || data.seat === undefined) return;
      const before = store.getState(data.roomId);
      const res = store.applyPlayerAction(data.roomId, data.seat, action);
      if (!res.ok) {
        socket.emit("app:error", res.error);
        return;
      }
      emitTransitions(data.roomId, before, res.value);
      broadcast(data.roomId); // 人間の手は即時反映
      if (res.value.phase !== "ended") driveAutoTimed(data.roomId); // CPUは一手ずつ遅延
    };

    socket.on("room:create", ({ name }: { name: string }, ack?: (res: unknown) => void) => {
      const res = store.createRoom(name);
      if (!res.ok) {
        ack?.(res.error);
        return;
      }
      data.roomId = res.value.roomId;
      data.seat = res.value.seat;
      store.bindSocket(res.value.roomId, res.value.seat, socket.id); // 席に socket を束ねる（#13）
      socket.join(res.value.roomId);
      ack?.(res.value); // {roomId, passcode, seat, token}
      io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
    });

    socket.on(
      "room:join",
      ({ passcode, name }: { passcode: string; name: string }, ack?: (res: unknown) => void) => {
        const res = store.joinRoom(passcode, name);
        if (!res.ok) {
          ack?.(res.error);
          return;
        }
        data.roomId = res.value.roomId;
        data.seat = res.value.seat;
        store.bindSocket(res.value.roomId, res.value.seat, socket.id);
        socket.join(res.value.roomId);
        ack?.(res.value);
        io.to(res.value.roomId).emit("room:players", store.getPlayers(res.value.roomId));
      },
    );

    // 通信断からの再接続: トークンで席を再束縛し、現状態を復元配信（#13）。
    socket.on(
      "room:reconnect",
      ({ roomId, seat, token }: { roomId: RoomId; seat: Seat; token: ClientToken }, ack?: (res: unknown) => void) => {
        const res = store.reconnect(roomId, seat, token, socket.id);
        if (!res.ok) {
          ack?.(res.error);
          return;
        }
        data.roomId = roomId;
        data.seat = seat;
        socket.join(roomId);
        ack?.({ ok: true });
        io.to(roomId).emit("room:players", store.getPlayers(roomId));
        broadcast(roomId); // 状態復元（再接続者を含む全員へ再送）
      },
    );

    socket.on("game:start", ({ opts }: { opts?: StartOptions }, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined) {
        ack?.({ code: "ROOM_NOT_FOUND", message: "部屋がありません" });
        return;
      }
      if (data.seat !== 0) {
        ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" });
        return;
      }
      const res = store.startGame(data.roomId, opts);
      if (!res.ok) {
        ack?.(res.error);
        return;
      }
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAutoTimed(data.roomId);
    });

    // もう一回（ホスト限定・終局後）: 同じ部屋/席/設定で配り直して再開（#17）。
    socket.on("game:rematch", (_payload: unknown, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined) {
        ack?.({ code: "ROOM_NOT_FOUND", message: "部屋がありません" });
        return;
      }
      if (data.seat !== 0) {
        ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" });
        return;
      }
      const res = store.rematch(data.roomId);
      if (!res.ok) {
        ack?.(res.error);
        return;
      }
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:players", store.getPlayers(data.roomId));
      broadcast(data.roomId);
      driveAutoTimed(data.roomId);
    });

    // 部屋を解散（ホスト限定）: 全員へ通知してから部屋を破棄（#17）。
    socket.on("room:dissolve", (_payload: unknown, ack?: (res: unknown) => void) => {
      if (data.roomId === undefined) {
        ack?.({ code: "ROOM_NOT_FOUND", message: "部屋がありません" });
        return;
      }
      if (data.seat !== 0) {
        ack?.({ code: "NOT_HOST", message: "ホストのみ操作できます" });
        return;
      }
      ack?.({ ok: true });
      io.to(data.roomId).emit("room:dissolved");
      store.removeRoom(data.roomId);
    });

    // プレイヤーアクション（席はサーバー束縛を使う＝自己申告を信用しない）。
    socket.on("player:play", ({ card }: { card: Card }) => applyAndBroadcast({ type: "play", card }));
    socket.on("player:pass", () => applyAndBroadcast({ type: "pass" }));

    socket.on("disconnect", () => {
      // 切断を反映（席は保持）→ 参加者再配信＋切断席が手番なら CPU 代行で進める（#13）。
      const loc = store.markDisconnected(socket.id);
      if (loc) {
        io.to(loc.roomId).emit("room:players", store.getPlayers(loc.roomId));
        driveAutoTimed(loc.roomId);
      }
    });
  });

  httpServer.listen(port, host, () => {
    console.log(`> sevens server: http://localhost:${port} (${dev ? "dev" : "production"})`);
    for (const ip of lanIPv4()) {
      console.log(`>   LAN: http://${ip}:${port}  （他端末はこのURL/QRで入室）`);
    }
  });
});
