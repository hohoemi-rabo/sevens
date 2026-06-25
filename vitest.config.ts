import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// ゲームロジックは純粋TS（DOM非依存）なので node 環境で実行する。
// tsconfig の `@/*` → `./src/*` エイリアスを Vitest にも通す。
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
