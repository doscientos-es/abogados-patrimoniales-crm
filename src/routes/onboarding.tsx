import { createFileRoute } from '@tanstack/react-router'

import { DatabaseModuleUnavailable } from '@/shared/ui/database-module-unavailable'

export const Route = createFileRoute('/onboarding')({
  component: () => (
    <DatabaseModuleUnavailable
      title="Onboarding"
      description="La máquina de estados transaccional aún no dispone de persistencia remota."
    />
  ),
})
