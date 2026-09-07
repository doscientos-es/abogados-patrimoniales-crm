import { createFileRoute } from '@tanstack/react-router'

import { DatabaseModuleUnavailable } from '@/shared/ui/database-module-unavailable'

export const Route = createFileRoute('/comunicaciones')({
  component: () => (
    <DatabaseModuleUnavailable
      title="Comunicaciones"
      description="El registro multicanal aún no dispone de un repositorio remoto autorizado."
    />
  ),
})
