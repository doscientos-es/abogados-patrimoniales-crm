import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

export default defineConfig(async (env) =>
  mergeConfig(typeof viteConfig === 'function' ? await viteConfig(env) : viteConfig, {
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
)
