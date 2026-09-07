import { createFileRoute } from '@tanstack/react-router'

import { DatabaseModuleUnavailable } from '@/shared/ui/database-module-unavailable'

export const Route = createFileRoute('/alertas')({
  component: () => (
    <DatabaseModuleUnavailable
      title="Alertas globales"
      description="Los plazos persistentes y su validación están disponibles en Fechas y plazos."
    />
  ),
})
