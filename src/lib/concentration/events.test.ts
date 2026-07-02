import { describe, it, expect } from "vitest";
import type { FaceCard } from "@/lib/concentration/cards";
import type { ConcentrationView, ViewSlot } from "@/lib/concentration/module";
import type { Pending } from "@/lib/concentration/state";
import { diffConcentrationView } from "@/lib/concentration/events";

const trumpFace = (rank: number): FaceCard => ({ type: "trump", card: { suit: "h", rank: rank as never } });
const specialFace = (kind: "shuffle" | "swap" | "peek"): FaceCard => ({
  type: "special",
  special: { kind, id: `${kind}0` },
});

const slot = (pos: number, status: ViewSlot["status"], face?: FaceCard): ViewSlot => ({ pos, status, face });

/** 4マスの view を組む。overrides で revealed/pending/phase/currentSeat を差し込む。 */
function mkView(slots: ViewSlot[], overrides: Partial<ConcentrationView> = {}): ConcentrationView {
  return {
    slots,
    players: [
      { seat: 0, name: "A", pairs: 0, score: 0 },
      { seat: 1, name: "B", pairs: 0, score: 0 },
    ],
    currentSeat: 0,
    phase: "playing",
    pending: null,
    revealed: [],
    ...overrides,
  };
}

const allFacedown = (): ViewSlot[] => [0, 1, 2, 3].map((p) => slot(p, "facedown"));

describe("diffConcentrationView", () => {
  it("prev=null かつ配り直後は deal のみ（それ以外は無音＝再接続の一斉再生防止）", () => {
    expect(diffConcentrationView(null, mkView(allFacedown()))).toEqual([{ kind: "deal" }]);
    // 途中復帰（めくり中）はベースライン扱い＝無音
    expect(diffConcentrationView(null, mkView([slot(0, "facedown", trumpFace(2)), slot(1, "facedown"), slot(2, "facedown"), slot(3, "facedown")], { revealed: [0] }))).toEqual([]);
  });

  it("終局→配り直しは deal（再戦）", () => {
    const prev = mkView(allFacedown(), { phase: "ended" });
    expect(diffConcentrationView(prev, mkView(allFacedown()))).toEqual([{ kind: "deal" }]);
  });

  it("めくり: revealed が増えた位置に flip", () => {
    const prev = mkView(allFacedown());
    const next = mkView([slot(0, "facedown"), slot(1, "facedown"), slot(2, "facedown", trumpFace(5)), slot(3, "facedown")], { revealed: [2] });
    expect(diffConcentrationView(prev, next)).toEqual([{ kind: "flip", pos: 2 }]);
    // 2枚目
    const next2 = mkView([slot(0, "facedown", trumpFace(3)), slot(1, "facedown"), slot(2, "facedown", trumpFace(5)), slot(3, "facedown")], { revealed: [2, 0], pending: { type: "resolve" } as Pending });
    expect(diffConcentrationView(next, next2)).toEqual([{ kind: "flip", pos: 0 }]);
  });

  it("成立: collected が増えたら match（席は prev.currentSeat）", () => {
    const prev = mkView([slot(0, "facedown", trumpFace(3)), slot(1, "facedown"), slot(2, "facedown", trumpFace(3)), slot(3, "facedown")], {
      revealed: [0, 2],
      pending: { type: "resolve" } as Pending,
      currentSeat: 1,
    });
    const next = mkView([slot(0, "collected"), slot(1, "facedown"), slot(2, "collected"), slot(3, "facedown")], { currentSeat: 1 });
    expect(diffConcentrationView(prev, next)).toEqual([{ kind: "match", seat: 1 }]);
  });

  it("お手つき: resolve 待ち→revealed 空・非成立で miss", () => {
    const prev = mkView([slot(0, "facedown", trumpFace(3)), slot(1, "facedown"), slot(2, "facedown", trumpFace(5)), slot(3, "facedown")], {
      revealed: [0, 2],
      pending: { type: "resolve" } as Pending,
    });
    const next = mkView(allFacedown(), { currentSeat: 1 });
    expect(diffConcentrationView(prev, next)).toEqual([{ kind: "miss" }]);
  });

  it("特殊カード発動: used になった種別で special（shuffle/swap/peek）", () => {
    for (const kind of ["shuffle", "swap", "peek"] as const) {
      const prev = mkView(allFacedown());
      const next = mkView([slot(0, "used", specialFace(kind)), slot(1, "facedown"), slot(2, "facedown"), slot(3, "facedown")]);
      expect(diffConcentrationView(prev, next)).toEqual([{ kind: "special", special: kind }]);
    }
  });

  it("覗き見の私的リビール: facedown・非revealed の slot が face を得たら peek", () => {
    const prev = mkView(allFacedown());
    const next = mkView([slot(0, "facedown"), slot(1, "facedown", trumpFace(9)), slot(2, "facedown"), slot(3, "facedown")]);
    expect(diffConcentrationView(prev, next)).toEqual([{ kind: "peek" }]);
  });

  it("終局: phase playing→ended で end", () => {
    const prev = mkView(allFacedown());
    const next = mkView(allFacedown(), { phase: "ended" });
    expect(diffConcentrationView(prev, next).some((e) => e.kind === "end")).toBe(true);
  });
});
