// 対局UIの細かな設定（出す前確認など）の sessionStorage 永続化（docs/16）。
// CLAUDE.md の「sessionStorage は唯一の永続化例外」に整合する付加機能（端末ごとに保持）。
// リロードで生存し、タブを閉じれば破棄される。SSR / 非ブラウザ（vitest node）では no-op。

export interface UiSettings {
  /** カードを出す前に「このカードを出しますか？」と確認する。デフォルト ON（誤操作リカバリ・3.7）。 */
  confirmBeforePlay: boolean;
}

export const DEFAULT_UI_SETTINGS: UiSettings = { confirmBeforePlay: true };

const KEY = "sevens:ui";

const storage = (): Storage | null =>
  typeof globalThis !== "undefined" && "sessionStorage" in globalThis
    ? (globalThis as { sessionStorage: Storage }).sessionStorage
    : null;

/** 設定を保存する（失敗は握りつぶす＝永続化は付加機能）。 */
export function saveUiSettings(s: UiSettings): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(s));
  } catch {
    // QuotaExceeded やプライベートモード等は無視（メモリ上の設定で続行できる）。
  }
}

/** 保存済み設定を返す（無い・壊れている・形が違うならデフォルト）。 */
export function loadUiSettings(): UiSettings {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return DEFAULT_UI_SETTINGS;
    const v = JSON.parse(raw) as unknown;
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as UiSettings).confirmBeforePlay === "boolean"
    ) {
      return { confirmBeforePlay: (v as UiSettings).confirmBeforePlay };
    }
    return DEFAULT_UI_SETTINGS;
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
}
