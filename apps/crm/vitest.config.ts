import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default defineConfig(async (env) =>
  mergeConfig(typeof viteConfig === 'function' ? await viteConfig(env) : viteConfig, {
    test: {
      environment: 'jsdom',
      // Aísla los entornos JSDOM entre archivos y acota el consumo de memoria en CI.
      pool: 'forks',
      maxWorkers: 2,
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
)
