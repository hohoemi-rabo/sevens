import { describe, it, expect } from "vitest";
import type { GameView } from "@/lib/adapter/types";
import { isConcentrationView } from "@/lib/concentration/view";
import { initGame as initSevens } from "@/lib/sevens/state";
import { concentrationModule } from "@/lib/concentration/module";
import { MODE_CLASSROOM } from "@/lib/concentration/board";

describe("isConcentrationView", () => {
  it("神経衰弱の view（slots を持つ）を真と判定する", () => {
    const state = concentrationModule.createInitialState([{ id: "p0", name: "A" }, { id: "p1", name: "B" }], MODE_CLASSROOM, 1);
    const view = concentrationModule.getView(state, 0) as GameView;
    expect(isConcentrationView(view)).toBe(true);
  });

  it("7並べの GameState（board を持つ）を偽と判定する", () => {
    const sevens = initSevens({
      players: [
        { id: "p0", name: "A" },
        { id: "p1", name: "B" },
        { id: "p2", name: "C" },
        { id: "p3", name: "D" },
      ],
      maxPass: 3,
      startMode: "all7",
    }) as GameView;
    expect(isConcentrationView(sevens)).toBe(false);
  });
});
