// Tailwind クラスの結合ユーティリティ（最小版）。
// 文字列／falsy を受け取り、truthy だけをスペース結合する。条件付きクラスの組み立てに使う。
// （tailwind-merge による競合解決は導入しない＝本プロジェクトの画面は追加的な className のみ）。

export type ClassValue = string | false | null | undefined;

export const cn = (...inputs: ClassValue[]): string => inputs.filter(Boolean).join(" ");
