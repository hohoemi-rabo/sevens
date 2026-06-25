import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// ゲームロジックは純粋TS（DOM非依存）なので node 環境で実行する。
// tsconfig の `@/*` → `./src/*` エイリアスを Vitest にも通す。
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // ゲームロジック層（純粋TS）を計測対象にする。
      include: ['src/lib/sevens/**/*.ts'],
      // テスト・型のみファイル（実行コードを持たない）は除外。
      exclude: ['**/*.test.ts', 'src/lib/sevens/cpu/types.ts'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
