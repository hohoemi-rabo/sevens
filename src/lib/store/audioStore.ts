// 端末ごとの音量・ミュート設定ストア（Zustand / docs/14）。
// UI（AudioControls）と再生フック（useAudioEffects）が共有する。
// 初期値はデフォルト（中音量）にしておき、マウント後に hydrate() で sessionStorage から
// 復元する（SSR と初期描画を一致させ、ハイドレーション不整合を避ける）。

import { create } from "zustand";
import {
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
} from "@/lib/store/audio-settings-storage";

export interface AudioStore {
  volume: number; // 0..1
  muted: boolean;
  bgmEnabled: boolean; // BGM ON/OFF（端末ごと・既定OFF）
  bgmVolume: number; // 0..1（効果音とは別系統）
  hydrated: boolean;
  /** マウント後に sessionStorage から復元する（クライアントで1度）。 */
  hydrate(): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  toggleBgm(): void;
  setBgmVolume(volume: number): void;
  /** 実効音量（ミュート時は 0）。SFX/読み上げに渡す。 */
  effectiveVolume(): number;
  /** BGM の実効音量（ミュート時は 0）。 */
  effectiveBgmVolume(): number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const useAudioStore = create<AudioStore>((set, get) => {
  // 変更のたびに全設定を sessionStorage へ保存する（端末ごと・タブ生存）。
  const persist = () => {
    const { volume, muted, bgmEnabled, bgmVolume } = get();
    saveAudioSettings({ volume, muted, bgmEnabled, bgmVolume });
  };

  return {
    volume: DEFAULT_AUDIO_SETTINGS.volume,
    muted: DEFAULT_AUDIO_SETTINGS.muted,
    bgmEnabled: DEFAULT_AUDIO_SETTINGS.bgmEnabled,
    bgmVolume: DEFAULT_AUDIO_SETTINGS.bgmVolume,
    hydrated: false,

    hydrate() {
      if (get().hydrated) return;
      const saved = loadAudioSettings();
      set({
        volume: saved.volume,
        muted: saved.muted,
        bgmEnabled: saved.bgmEnabled,
        bgmVolume: saved.bgmVolume,
        hydrated: true,
      });
    },

    setVolume(volume) {
      set({ volume: clamp01(volume) });
      persist();
    },

    toggleMute() {
      set({ muted: !get().muted });
      persist();
    },

    toggleBgm() {
      set({ bgmEnabled: !get().bgmEnabled });
      persist();
    },

    setBgmVolume(volume) {
      set({ bgmVolume: clamp01(volume) });
      persist();
    },

    effectiveVolume() {
      const { volume, muted } = get();
      return muted ? 0 : volume;
    },

    effectiveBgmVolume() {
      const { bgmVolume, muted } = get();
      return muted ? 0 : bgmVolume;
    },
  };
});
