import { resolve } from 'node:path'

import { defineConfig as defineLovableConfig } from '@lovable.dev/vite-tanstack-config'
import type { ConfigEnv } from 'vite'

const lovableConfig = defineLovableConfig({
  vite: {
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
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: 'server' },
  },
})

export default async (env: ConfigEnv) => {
  const config = await lovableConfig(env)
  return {
    ...config,
    plugins: config.plugins?.filter(
      (plugin) =>
        !(
          plugin &&
          typeof plugin === 'object' &&
          !Array.isArray(plugin) &&
          'name' in plugin &&
          plugin.name === 'vite-tsconfig-paths'
        ),
    ),
    resolve: {
      ...config.resolve,
      // Vite 8 resuelve los alias de tsconfig de forma nativa.
      tsconfigPaths: true,
    },
  }
}
