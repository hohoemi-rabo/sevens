// 入室セッション（roomId/seat/token）の sessionStorage 永続化（docs/13）。
// リロード/再読込で Zustand のメモリが失われても、保存した識別子から自動再接続できるようにする。
// sessionStorage はタブ単位・リロード生存・タブを閉じると破棄＝1ゲーム制・教室運用に最適。
// SSR/非ブラウザ（vitest node）では sessionStorage が無いので no-op。

export interface SavedSession {
  roomId: string;
  seat: number;
  token: string;
}

const KEY = "sevens:session";

const storage = (): Storage | null =>
  typeof globalThis !== "undefined" && "sessionStorage" in globalThis
    ? (globalThis as { sessionStorage: Storage }).sessionStorage
    : null;

/** セッションを保存する（失敗は握りつぶす＝永続化は付加機能）。 */
export function saveSession(s: SavedSession): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(s));
  } catch {
    // QuotaExceeded やプライベートモード等は無視（メモリ上の状態で続行できる）。
  }
}

/** 保存済みセッションを返す（無い・壊れている・形が違うなら null）。 */
export function loadSession(): SavedSession | null {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as SavedSession).roomId === "string" &&
      typeof (v as SavedSession).seat === "number" &&
      typeof (v as SavedSession).token === "string"
    ) {
      return v as SavedSession;
    }
    return null;
  } catch {
    return null;
  }
}

/** セッションを破棄する（明示的な離席・もう一回・再接続失敗時）。 */
export function clearSession(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // 無視。
  }
}
