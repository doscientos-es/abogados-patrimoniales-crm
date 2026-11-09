import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default defineConfig(async (env) =>
  mergeConfig(typeof viteConfig === 'function' ? await viteConfig(env) : viteConfig, {
    test: {
      environment: 'jsdom',
      // Reutiliza JSDOM por worker sin compartir estado entre archivos de prueba.
      pool: 'vmThreads',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
)
