import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./test/cloudflareWorkers.ts', import.meta.url)),
    },
  },
  test: {
    include: ['features/**/*.test.ts', 'src/**/*.test.ts', 'bundling/**/*.test.ts'],
  },
})
