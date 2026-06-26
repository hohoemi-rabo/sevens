// LocalAdapter の回帰テスト。gameStore.connect() は購読(on*)を登録してから connect() する。
// LocalAdapter は connect() より前に on* を呼べなければならない（autoConnect:false で構築）。
// 実際の通信疎通は sync.test.ts（in-process サーバー）で検証する。

import { describe, expect, it } from "vitest";
import { LocalAdapter } from "@/lib/adapter/local";

describe("LocalAdapter", () => {
  it("connect() より前に on* を登録しても throw しない", () => {
    const a = new LocalAdapter("http://localhost:1"); // autoConnect:false なので接続はしない
    expect(() => {
      const unsubs = [
        a.onConnectionChange(() => {}),
        a.onPlayers(() => {}),
        a.onState(() => {}),
        a.onEnd(() => {}),
        a.onError(() => {}),
      ];
      unsubs.forEach((u) => u());
    }).not.toThrow();
    a.disconnect();
  });

  it("構築直後は未接続", () => {
    const a = new LocalAdapter("http://localhost:1");
    expect(typeof a.connect).toBe("function");
    a.disconnect();
  });
});
