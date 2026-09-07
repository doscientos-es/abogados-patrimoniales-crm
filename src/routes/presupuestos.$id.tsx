import { createFileRoute } from '@tanstack/react-router'

import { DatabaseModuleUnavailable } from '@/shared/ui/database-module-unavailable'

export const Route = createFileRoute('/presupuestos/$id')({
  component: () => (
    <DatabaseModuleUnavailable
      title="Presupuestos"
      description="El presupuesto independiente no dispone todavía de persistencia remota; usa el flujo de Leads."
    />
  ),
})
