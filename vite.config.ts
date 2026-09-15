import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: 'error',
        client: { files: ['**/server/**'], specifiers: ['server-only'] },
      },
      server: { entry: 'server' },
    }),
    nitro({ defaultPreset: 'cloudflare-module' }),
    react(),
  ],
  resolve: {
    alias: [
      {
        find: '@/components/common',
        replacement: resolve(import.meta.dirname, 'src/shared/ui/common.tsx'),
      },
      {
        find: '@/components/app-sidebar',
        replacement: resolve(import.meta.dirname, 'src/app/ui/app-sidebar.tsx'),
      },
      { find: '@', replacement: resolve(import.meta.dirname, 'src') },
    ],
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@tanstack/react-query',
      '@tanstack/query-core',
    ],
    tsconfigPaths: true,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
    ignoreOutdatedRequests: true,
  },
  server: { host: '::', port: 8080 },
})
