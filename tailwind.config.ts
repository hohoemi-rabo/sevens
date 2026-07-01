import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // 高さ用ブレークポイント。短い画面（15型ノート等）では場・相手を自動で小さくし
      // スクロールを減らす＝出す演出が画面外へ飛ばないようにする（既定=短い、tall:=大きい）。
      screens: {
        tall: { raw: "(min-height: 800px)" },
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // セマンティック色（高コントラスト固定hex／白文字でWCAG AA）。操作色は予測可能に固定する。
        primary: {
          DEFAULT: "#0284c7", // 主要アクション・「対局開始」等（sky）
          dark: "#0369a1", // hover
        },
        danger: {
          DEFAULT: "#e11d48", // 取消・警告（rose）
          dark: "#be123c", // hover
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
      // タップ領域 60×60px（REQUIREMENTS §3.7）。min-h-tap / min-w-tap で使う。
      spacing: {
        tap: "60px",
      },
      minHeight: {
        tap: "60px",
      },
      minWidth: {
        tap: "60px",
      },
    },
  },
  plugins: [],
};

export default config;
