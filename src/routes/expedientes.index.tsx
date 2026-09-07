import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useMiembrosDespacho } from '@/features/crm'
import {
  CaseCreateDialog,
  PersistentCasesPage,
  useActuacionesDespacho,
  useActualizarExpediente,
  useCrearExpediente,
  useExpedientesPersistentes,
} from '@/features/expedientes'
import { useTareasPersistentes } from '@/features/tareas'

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
  const navigate = useNavigate()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const cases = useExpedientesPersistentes(firmId)
  const contacts = useContactos(firmId)
  const members = useMiembrosDespacho(firmId)
  const createCase = useCrearExpediente(firmId)
  const updateCase = useActualizarExpediente(firmId)
  const tasks = useTareasPersistentes(firmId)
  const activities = useActuacionesDespacho(firmId)

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando expedientes" description="Consultando tu despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Expedientes no disponibles"
        description="Necesitas una sesión y una membresía activa."
      />
    )
  if (
    cases.isPending ||
    contacts.isPending ||
    members.isPending ||
    tasks.isPending ||
    activities.isPending
  )
    return (
      <PendingPanel title="Cargando expedientes" description="Consultando datos compartidos…" />
    )
  if (cases.isError || contacts.isError || members.isError || tasks.isError || activities.isError)
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
      miembros={members.data ?? []}
      tareas={tasks.data ?? []}
      actuaciones={activities.data ?? []}
      usuarioId={session.user.id}
      moving={updateCase.isPending}
      onMove={async (expediente, fase) => {
        await updateCase.mutateAsync({
          id: expediente.id,
          versionEsperada: expediente.version,
          titulo: expediente.titulo,
          area: expediente.area,
          tipoAsunto: expediente.tipoAsunto,
          naturaleza: expediente.naturaleza,
          prioridad: expediente.prioridad,
          asignadoId: expediente.asignadoId,
          fechaApertura: expediente.fechaApertura,
          fechaCierre: expediente.fechaCierre,
          proximaAccion: expediente.proximaAccion,
          dondeEstamos: expediente.dondeEstamos,
          estadoGeneral: expediente.estadoGeneral,
          fase,
          estadoOperativo: expediente.estadoOperativo,
        })
        toast.success('Expediente movido a la fase seleccionada.')
      }}
      actions={
        <CaseCreateDialog
          contactos={contacts.data ?? []}
          miembros={members.data ?? []}
          pending={createCase.isPending}
          onCreate={(input) => createCase.mutateAsync(input)}
          onCreated={(id) => navigate({ to: '/expedientes/$id', params: { id } })}
        />
      }
    />
  )
}
