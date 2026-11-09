import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useMiembrosDespacho } from '@/features/crm'
import {
  CaseCreateDialog,
  CasesPage,
  useActuacionesDespacho,
  useActualizarExpediente,
  useCrearExpediente,
  useExpedientesPersistentes,
} from '@/features/expedientes'
import { useTareasPersistentes } from '@/features/tareas'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export const Route = createFileRoute('/expedientes/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { naturaleza?: 'Judicial' | 'Extrajudicial' | undefined; contacto?: string | undefined } => ({
    naturaleza:
      search['naturaleza'] === 'Judicial' || search['naturaleza'] === 'Extrajudicial'
        ? search['naturaleza']
        : undefined,
    contacto:
      typeof search['contacto'] === 'string' && search['contacto'].trim()
        ? search['contacto'].trim()
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Control de expedientes — LEX' },
      { name: 'description', content: 'Expedientes persistentes compartidos por el despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: CasesRoute,
})

function CasesRoute() {
  const navigate = useNavigate()
  const { naturaleza, contacto } = Route.useSearch()
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
  const practiceAreas = useQuery({
    queryKey: ['crm', 'practice-areas', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_practice_areas')
        .select('name')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data.map((item) => item.name)
    },
  })

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
    <CasesPage
      nature={naturaleza ?? 'all'}
      contactId={contacto}
      onContactClear={() =>
        void navigate({ to: '/expedientes', search: { naturaleza, contacto: undefined } })
      }
      onNatureChange={(value) =>
        void navigate({
          to: '/expedientes',
          search: { naturaleza: value === 'all' ? undefined : value, contacto },
        })
      }
      expedientes={cases.data ?? []}
      contactos={contacts.data ?? []}
      miembros={members.data ?? []}
      tareas={tasks.data ?? []}
      actuaciones={activities.data ?? []}
      moving={updateCase.isPending}
      onMove={async (expediente, fase) => {
        try {
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
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'No se pudo mover el expediente.')
        }
      }}
      actions={
        <CaseCreateDialog
          contactos={contacts.data ?? []}
          miembros={members.data ?? []}
          practiceAreas={practiceAreas.data ?? []}
          pending={createCase.isPending}
          onCreate={(input) => createCase.mutateAsync(input)}
          onCreated={(id) => navigate({ to: '/expedientes/$id', params: { id } })}
        />
      }
    />
  )
}
