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
  hydrated: boolean;
  /** マウント後に sessionStorage から復元する（クライアントで1度）。 */
  hydrate(): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  /** 実効音量（ミュート時は 0）。SFX/読み上げに渡す。 */
  effectiveVolume(): number;
}

export const useAudioStore = create<AudioStore>((set, get) => ({
  volume: DEFAULT_AUDIO_SETTINGS.volume,
  muted: DEFAULT_AUDIO_SETTINGS.muted,
  hydrated: false,

  hydrate() {
    if (get().hydrated) return;
    const saved = loadAudioSettings();
    set({ volume: saved.volume, muted: saved.muted, hydrated: true });
  },

  setVolume(volume) {
    const v = Math.min(1, Math.max(0, volume));
    set({ volume: v });
    saveAudioSettings({ volume: v, muted: get().muted });
  },

  toggleMute() {
    const muted = !get().muted;
    set({ muted });
    saveAudioSettings({ volume: get().volume, muted });
  },

  effectiveVolume() {
    const { volume, muted } = get();
    return muted ? 0 : volume;
  },
}));
