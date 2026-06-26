// session-storage の振る舞いテスト。node 環境には sessionStorage が無いので、
// 各テストで globalThis にメモリ実装のスタブを差し込む。

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession } from "@/lib/store/session-storage";

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

const g = globalThis as { sessionStorage?: Storage };

describe("session-storage（sessionStorage あり）", () => {
  beforeEach(() => {
    g.sessionStorage = new MemoryStorage() as unknown as Storage;
  });
  afterEach(() => {
    delete g.sessionStorage;
  });

  it("save→load で往復できる", () => {
    saveSession({ roomId: "r1", seat: 2, token: "tok" });
    expect(loadSession()).toEqual({ roomId: "r1", seat: 2, token: "tok" });
  });

  it("clear すると null になる", () => {
    saveSession({ roomId: "r1", seat: 0, token: "tok" });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("壊れた JSON は null", () => {
    g.sessionStorage!.setItem("sevens:session", "{not json");
    expect(loadSession()).toBeNull();
  });

  it("形が違う（seat が文字列など）は null", () => {
    g.sessionStorage!.setItem("sevens:session", JSON.stringify({ roomId: "r1", seat: "x", token: "t" }));
    expect(loadSession()).toBeNull();
  });
});

describe("session-storage（sessionStorage なし＝SSR/node）", () => {
  beforeEach(() => {
    delete g.sessionStorage;
  });

  it("save/load/clear は throw せず load は null", () => {
    expect(() => saveSession({ roomId: "r1", seat: 0, token: "t" })).not.toThrow();
    expect(loadSession()).toBeNull();
    expect(() => clearSession()).not.toThrow();
  });
});
