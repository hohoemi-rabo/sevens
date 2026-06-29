// 音量・ミュート設定の sessionStorage 永続化（docs/14）。
// CLAUDE.md の「sessionStorage は唯一の永続化例外」に整合する付加機能。
// 端末ごとの音量はリロードで生存し、タブを閉じれば破棄される（個人情報・ゲーム記録は残さない）。
// SSR / 非ブラウザ（vitest node）では sessionStorage が無いので no-op。

export interface AudioSettings {
  /** 効果音・読み上げの音量。0..1。デフォルト中音量 = 0.5。 */
  volume: number;
  muted: boolean;
  /** BGM の ON/OFF（端末ごと・既定OFF＝全端末重なり/自動再生制限の回避）。 */
  bgmEnabled: boolean;
  /** BGM 音量。0..1。効果音とは別系統で控えめ既定（= 0.3）。 */
  bgmVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  volume: 0.5,
  muted: false,
  bgmEnabled: false,
  bgmVolume: 0.3,
};

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
      const o = v as Partial<AudioSettings>;
      const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
      // BGM 項目は後付けのため、無い/不正な保存値はデフォルトに倒す（後方互換）。
      return {
        volume: clamp01(o.volume as number),
        muted: o.muted as boolean,
        bgmEnabled:
          typeof o.bgmEnabled === "boolean" ? o.bgmEnabled : DEFAULT_AUDIO_SETTINGS.bgmEnabled,
        bgmVolume:
          typeof o.bgmVolume === "number" ? clamp01(o.bgmVolume) : DEFAULT_AUDIO_SETTINGS.bgmVolume,
      };
    }
    return DEFAULT_AUDIO_SETTINGS;
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}
