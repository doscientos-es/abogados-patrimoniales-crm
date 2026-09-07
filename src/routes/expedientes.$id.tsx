import { createFileRoute } from '@tanstack/react-router'

import { PendingPanel } from '@/components/common'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useMiembrosDespacho } from '@/features/crm'
import {
  CaseEditForm,
  CaseRelatedForms,
  PersistentCaseDetail,
  useActuacionesPersistentes,
  useActualizarExpediente,
  useCrearActuacion,
  useCrearLinea,
  useCrearParticipante,
  useEventosExpediente,
  useExpedientePersistente,
  useLineasPersistentes,
  useParticipantesPersistentes,
} from '@/features/expedientes'

export const Route = createFileRoute('/expedientes/$id')({
  head: ({ params }) => ({
    meta: [
      { title: `Expediente ${params.id} — LEX` },
      { name: 'description', content: 'Ficha persistente y trazabilidad del expediente.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: FichaExpedientePersistente,
})

function FichaExpedientePersistente() {
  const { id } = Route.useParams()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const caseQuery = useExpedientePersistente(firmId, id)
  const workstreams = useLineasPersistentes(firmId, id)
  const activities = useActuacionesPersistentes(firmId, id)
  const participants = useParticipantesPersistentes(firmId, id)
  const events = useEventosExpediente(firmId, id)
  const contacts = useContactos(firmId)
  const members = useMiembrosDespacho(firmId)
  const updateCase = useActualizarExpediente(firmId)
  const createParticipant = useCrearParticipante(firmId)
  const createWorkstream = useCrearLinea(firmId)
  const createActivity = useCrearActuacion(firmId)
  const queries = [caseQuery, workstreams, activities, participants, events, contacts, members]

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando expediente" description="Consultando tu despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Expediente no disponible"
        description="Necesitas una sesión y una membresía activa."
      />
    )
  if (queries.some((query) => query.isPending))
    return <PendingPanel title="Cargando expediente" description="Consultando datos operativos…" />
  if (queries.some((query) => query.isError))
    return (
      <PendingPanel
        title="No se pudo cargar el expediente"
        description="Reintenta en unos instantes."
      />
    )
  if (!caseQuery.data)
    return (
      <PendingPanel
        title="Expediente no encontrado"
        description="No existe o no pertenece a tu despacho."
      />
    )

  return (
    <PersistentCaseDetail
      expediente={caseQuery.data}
      lineas={workstreams.data ?? []}
      actuaciones={activities.data ?? []}
      participantes={participants.data ?? []}
      eventos={events.data ?? []}
      editor={
        <CaseEditForm
          expediente={caseQuery.data}
          miembros={members.data ?? []}
          pending={updateCase.isPending}
          onSave={async (input) => {
            await updateCase.mutateAsync(input)
          }}
        />
      }
      relatedForms={
        <CaseRelatedForms
          expedienteId={caseQuery.data.id}
          contactos={contacts.data ?? []}
          miembros={members.data ?? []}
          lineas={workstreams.data ?? []}
          pending={
            createParticipant.isPending || createWorkstream.isPending || createActivity.isPending
          }
          onParticipant={async (input) => {
            await createParticipant.mutateAsync(input)
          }}
          onWorkstream={async (input) => {
            await createWorkstream.mutateAsync(input)
          }}
          onActivity={async (input) => {
            await createActivity.mutateAsync(input)
          }}
        />
      }
    />
  )
}
