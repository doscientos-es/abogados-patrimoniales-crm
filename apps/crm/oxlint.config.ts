import { createFeatureLayersConfig } from '@doscientos/configs/architecture'
import { reactViteConfig } from '@doscientos/configs/oxlint/react-vite'

export default {
  extends: [reactViteConfig, createFeatureLayersConfig()],
  rules: {
    // TanStack route modules intentionally co-locate route definitions and UI.
    'react/only-export-components': 'off',
    // Dialogs are loaded lazily at their interaction boundary to avoid SSR cycles.
    'import/no-cycle': ['error', { allowUnsafeDynamicCyclicDependency: true }],
  },
}
