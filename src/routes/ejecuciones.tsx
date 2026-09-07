import { createFileRoute } from '@tanstack/react-router'

import { DatabaseModuleUnavailable } from '@/shared/ui/database-module-unavailable'

export const Route = createFileRoute('/ejecuciones')({
  component: () => (
    <DatabaseModuleUnavailable
      title="Ejecuciones"
      description="El seguimiento de ejecuciones requiere un modelo tenant y RLS propio."
    />
  ),
})
