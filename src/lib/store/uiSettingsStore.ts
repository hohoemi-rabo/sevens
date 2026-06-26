// 対局UI設定ストア（Zustand / docs/16）。「出す前確認」などのトグルを保持する。
// 初期値はデフォルトにしておき、マウント後に hydrate() で sessionStorage から復元する
// （SSR と初期描画を一致させ、ハイドレーション不整合を避ける＝audioStore/helpStore と同方針）。

import { create } from "zustand";
import {
  DEFAULT_UI_SETTINGS,
  loadUiSettings,
  saveUiSettings,
} from "@/lib/store/ui-settings-storage";

export interface UiSettingsStore {
  confirmBeforePlay: boolean;
  hydrated: boolean;
  /** マウント後に sessionStorage から復元する（クライアントで1度）。 */
  hydrate(): void;
  setConfirmBeforePlay(on: boolean): void;
  toggleConfirmBeforePlay(): void;
}

export const useUiSettingsStore = create<UiSettingsStore>((set, get) => ({
  confirmBeforePlay: DEFAULT_UI_SETTINGS.confirmBeforePlay,
  hydrated: false,

  hydrate() {
    if (get().hydrated) return;
    set({ confirmBeforePlay: loadUiSettings().confirmBeforePlay, hydrated: true });
  },

  setConfirmBeforePlay(on) {
    set({ confirmBeforePlay: on });
    saveUiSettings({ confirmBeforePlay: on });
  },

  toggleConfirmBeforePlay() {
    const confirmBeforePlay = !get().confirmBeforePlay;
    set({ confirmBeforePlay });
    saveUiSettings({ confirmBeforePlay });
  },
}));
