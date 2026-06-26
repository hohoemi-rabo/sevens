// 音量・ミュート設定の sessionStorage 永続化（docs/14）。
// CLAUDE.md の「sessionStorage は唯一の永続化例外」に整合する付加機能。
// 端末ごとの音量はリロードで生存し、タブを閉じれば破棄される（個人情報・ゲーム記録は残さない）。
// SSR / 非ブラウザ（vitest node）では sessionStorage が無いので no-op。

export interface AudioSettings {
  /** 0..1。デフォルト中音量 = 0.5。 */
  volume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { volume: 0.5, muted: false };

const KEY = "sevens:audio";

const storage = (): Storage | null =>
  typeof globalThis !== "undefined" && "sessionStorage" in globalThis
    ? (globalThis as { sessionStorage: Storage }).sessionStorage
    : null;

/** 設定を保存する（失敗は握りつぶす＝永続化は付加機能）。 */
export function saveAudioSettings(s: AudioSettings): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(s));
  } catch {
    // QuotaExceeded やプライベートモード等は無視（メモリ上の設定で続行できる）。
  }
}

/** 保存済み設定を返す（無い・壊れている・形が違うならデフォルト）。 */
export function loadAudioSettings(): AudioSettings {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    const v = JSON.parse(raw) as unknown;
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as AudioSettings).volume === "number" &&
      typeof (v as AudioSettings).muted === "boolean"
    ) {
      const volume = Math.min(1, Math.max(0, (v as AudioSettings).volume));
      return { volume, muted: (v as AudioSettings).muted };
    }
    return DEFAULT_AUDIO_SETTINGS;
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}
