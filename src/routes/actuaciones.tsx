import { createFileRoute } from '@tanstack/react-router'

import { DatabaseModuleUnavailable } from '@/shared/ui/database-module-unavailable'

export const Route = createFileRoute('/actuaciones')({
  component: () => (
    <DatabaseModuleUnavailable
      title="Actuaciones globales"
      description="Las actuaciones persistentes se gestionan actualmente dentro de cada expediente."
    />
  ),
})
