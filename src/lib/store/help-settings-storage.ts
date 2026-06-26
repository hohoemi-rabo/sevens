// お助けモードのON/OFF設定の sessionStorage 永続化（docs/15）。
// CLAUDE.md の「sessionStorage は唯一の永続化例外」に整合する付加機能（端末ごとに保持）。
// リロードで生存し、タブを閉じれば破棄される。SSR / 非ブラウザ（vitest node）では no-op。

export interface HelpSettings {
  /** お助けモード（出せる札ハイライト・無駄パス警告等）。デフォルト ON。 */
  helpMode: boolean;
}

export const DEFAULT_HELP_SETTINGS: HelpSettings = { helpMode: true };

const KEY = "sevens:help";

const storage = (): Storage | null =>
  typeof globalThis !== "undefined" && "sessionStorage" in globalThis
    ? (globalThis as { sessionStorage: Storage }).sessionStorage
    : null;

/** 設定を保存する（失敗は握りつぶす＝永続化は付加機能）。 */
export function saveHelpSettings(s: HelpSettings): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(s));
  } catch {
    // QuotaExceeded やプライベートモード等は無視（メモリ上の設定で続行できる）。
  }
}

/** 保存済み設定を返す（無い・壊れている・形が違うならデフォルト）。 */
export function loadHelpSettings(): HelpSettings {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return DEFAULT_HELP_SETTINGS;
    const v = JSON.parse(raw) as unknown;
    if (typeof v === "object" && v !== null && typeof (v as HelpSettings).helpMode === "boolean") {
      return { helpMode: (v as HelpSettings).helpMode };
    }
    return DEFAULT_HELP_SETTINGS;
  } catch {
    return DEFAULT_HELP_SETTINGS;
  }
}
