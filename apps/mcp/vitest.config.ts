import { defineConfig } from 'vitest/config'

// Standalone tests: no CRM, SSR/Nitro plugins or real credentials.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    testTimeout: 5000,
  },
})
