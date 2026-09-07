import { createFileRoute } from '@tanstack/react-router'

import { PendingPanel } from '@/components/common'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useMiembrosDespacho } from '@/features/crm'
import {
  CaseCreateDialog,
  PersistentCasesPage,
  useCrearExpediente,
  useExpedientesPersistentes,
} from '@/features/expedientes'

export const Route = createFileRoute('/expedientes/')({
  head: () => ({
    meta: [
      { title: 'Control de expedientes — LEX' },
      { name: 'description', content: 'Expedientes persistentes compartidos por el despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: ExpedientesPersistentesRoute,
})

function ExpedientesPersistentesRoute() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const cases = useExpedientesPersistentes(firmId)
  const contacts = useContactos(firmId)
  const members = useMiembrosDespacho(firmId)
  const createCase = useCrearExpediente(firmId)

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando expedientes" description="Consultando tu despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Expedientes no disponibles"
        description="Necesitas una sesión y una membresía activa."
      />
    )
  if (cases.isPending || contacts.isPending || members.isPending)
    return (
      <PendingPanel title="Cargando expedientes" description="Consultando datos compartidos…" />
    )
  if (cases.isError || contacts.isError || members.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar los expedientes"
        description="Reintenta en unos instantes."
      />
    )

  return (
    <PersistentCasesPage
      expedientes={cases.data ?? []}
      contactos={contacts.data ?? []}
      actions={
        <CaseCreateDialog
          contactos={contacts.data ?? []}
          miembros={members.data ?? []}
          pending={createCase.isPending}
          onCreate={(input) => createCase.mutateAsync(input)}
        />
      }
    />
  )
}
