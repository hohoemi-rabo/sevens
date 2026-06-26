// お助けモードのトグル状態ストア（Zustand / docs/15）。
// UI（HelpToggle）と対局画面（GameBoard / HandCards）が共有する。
// 初期値はデフォルト ON にしておき、マウント後に hydrate() で sessionStorage から復元する
// （SSR と初期描画を一致させ、ハイドレーション不整合を避ける＝audioStore と同方針）。

import { create } from "zustand";
import {
  DEFAULT_HELP_SETTINGS,
  loadHelpSettings,
  saveHelpSettings,
} from "@/lib/store/help-settings-storage";

export interface HelpStore {
  helpMode: boolean;
  hydrated: boolean;
  /** マウント後に sessionStorage から復元する（クライアントで1度）。 */
  hydrate(): void;
  toggle(): void;
  setHelpMode(on: boolean): void;
}

export const useHelpStore = create<HelpStore>((set, get) => ({
  helpMode: DEFAULT_HELP_SETTINGS.helpMode,
  hydrated: false,

  hydrate() {
    if (get().hydrated) return;
    set({ helpMode: loadHelpSettings().helpMode, hydrated: true });
  },

  toggle() {
    const helpMode = !get().helpMode;
    set({ helpMode });
    saveHelpSettings({ helpMode });
  },

  setHelpMode(on) {
    set({ helpMode: on });
    saveHelpSettings({ helpMode: on });
  },
}));
