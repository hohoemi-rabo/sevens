import { describe, it, expect } from "vitest";
import { sevensModule, type SevensConfig } from "@/lib/sevens/module";
import type { PlayerRef } from "@/lib/platform/gameModule";
import type { GameState } from "@/lib/sevens/state";

// 7並べを GameModule として載せたときの契約テスト。ロジック本体（state.ts 等）は別途テスト済みで、
// ここでは「ラッパが既存挙動を正しく橋渡しするか」だけを検証する。

const players: PlayerRef[] = [
  { id: "p0", name: "A" },
  { id: "p1", name: "B" },
  { id: "p2", name: "C" },
  { id: "p3", name: "D" },
];
const cfg: SevensConfig = { maxPass: 3, startMode: "all7", wrapAround: false };

describe("sevensModule メタ情報", () => {
  it("4人固定・CPU補完あり・全公開", () => {
    expect(sevensModule.id).toBe("sevens");
    expect(sevensModule.minPlayers).toBe(4);
    expect(sevensModule.maxPlayers).toBe(4);
    expect(sevensModule.cpuFill).toBe(true);
    expect(sevensModule.viewIsPublic).toBe(true);
  });
});

describe("createInitialState", () => {
  it("同じ seed なら決定論的に同一状態", () => {
    expect(sevensModule.createInitialState(players, cfg, 7)).toEqual(
      sevensModule.createInitialState(players, cfg, 7),
    );
  });

  it("config がゲーム状態に反映される", () => {
    const st = sevensModule.createInitialState(players, { maxPass: 0, startMode: "all7", wrapAround: true }, 1);
    expect(st.maxPass).toBe(0); // 無制限
    expect(st.startMode).toBe("all7");
    expect(st.wrapAround).toBe(true);
    expect(st.players).toHaveLength(4);
  });
});

describe("getView（恒等）", () => {
  it("全公開なので状態そのものを返す", () => {
    const st = sevensModule.createInitialState(players, cfg, 3);
    expect(sevensModule.getView(st, 0)).toBe(st);
    expect(sevensModule.getView(st, 2)).toBe(st);
  });
});

describe("isFinished / currentSeat", () => {
  it("開始直後は継続中・手番は state.currentSeat", () => {
    const st = sevensModule.createInitialState(players, cfg, 5);
    expect(sevensModule.isFinished(st)).toBe(false);
    expect(sevensModule.currentSeat(st)).toBe(st.currentSeat);
  });

  it("終局状態は isFinished=true・currentSeat=null", () => {
    const st = sevensModule.createInitialState(players, cfg, 5);
    const ended: GameState = { ...st, phase: "ended" };
    expect(sevensModule.isFinished(ended)).toBe(true);
    expect(sevensModule.currentSeat(ended)).toBeNull();
  });
});

describe("handleAction / decideAuto", () => {
  it("自動手を適用すると新しい状態が返る（不変・非破壊）", () => {
    const st = sevensModule.createInitialState(players, cfg, 1);
    const seat = sevensModule.currentSeat(st)!;
    const pid = st.players[seat].id;
    const action = sevensModule.decideAuto(st, pid, "weak");
    const next = sevensModule.handleAction(st, pid, action);
    expect(next).not.toBe(st); // 元状態は変更しない
    expect(["play", "pass"]).toContain(action.type);
  });

  it("他人の札を出そうとすると throw（不正手）", () => {
    const st = sevensModule.createInitialState(players, cfg, 1);
    const seat = sevensModule.currentSeat(st)!;
    const pid = st.players[seat].id;
    const otherSeat = (seat + 1) % 4;
    const notMine = st.players[otherSeat].hand[0];
    expect(() => sevensModule.handleAction(st, pid, { type: "play", card: notMine })).toThrow();
  });
});

describe("transitions（演出用の差分検出）", () => {
  const base = sevensModule.createInitialState(players, cfg, 9);

  it("上がりを finish として検出する", () => {
    const before = structuredClone(base);
    const after = structuredClone(base);
    after.players[0].status = "finished";
    after.players[0].rank = 1;
    expect(sevensModule.transitions(before, after)).toEqual([{ type: "finish", seat: 0, rank: 1 }]);
  });

  it("脱落を eliminated として検出する", () => {
    const before = structuredClone(base);
    const after = structuredClone(base);
    after.players[2].status = "eliminated";
    after.players[2].eliminatedOrder = 1;
    expect(sevensModule.transitions(before, after)).toEqual([{ type: "eliminated", seat: 2, order: 1 }]);
  });

  it("変化なしなら空配列", () => {
    expect(sevensModule.transitions(base, base)).toEqual([]);
  });
});
