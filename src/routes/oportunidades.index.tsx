import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader, ViewSwitch } from '@/components/common'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos, type ContactoPersistido } from '@/features/contactos'
import {
  OPPORTUNITY_STAGE_LABELS,
  useOportunidades,
  useTransicionarOportunidad,
  type OportunidadResumen,
} from '@/features/crm'
import { PersistentPipelineBoard } from '@/features/crm-presentation'
import type { OpportunityStage } from '@/shared/infrastructure/supabase'

export const Route = createFileRoute('/oportunidades/')({
  validateSearch: (search: Record<string, unknown>) => ({
    vista: typeof search['vista'] === 'string' ? (search['vista'] as string) : 'todas',
    abrir: typeof search['abrir'] === 'string' ? (search['abrir'] as string) : '',
  }),
  head: () => ({
    meta: [
      { title: 'Leads — LEX' },
      {
        name: 'description',
        content:
          'Kanban comercial de ocho fases con gates, subestados, próxima acción, tareas y actividades vinculadas.',
      },
      { property: 'og:title', content: 'Leads — LEX' },
      {
        property: 'og:description',
        content: 'Núcleo del CRM del despacho: del primer contacto a la apertura del expediente.',
      },
    ],
  }),
  component: PersistentLeadsPage,
})

/** El alta se realiza en su propia pantalla central: /oportunidades/nueva */
function NuevaOportunidadBoton() {
  return (
    <Link
      to="/oportunidades/nueva"
      className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}
    >
      <Plus className="h-4 w-4" /> Nuevo Lead
    </Link>
  )
}

function PersistentLeadsPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const oportunidades = useOportunidades(membership.data?.firmId)
  const contactos = useContactos(membership.data?.firmId)

  if (session.status === 'loading') {
    return <PendingPanel title="Cargando Leads" description="Consultando el despacho activo…" />
  }
  if (session.status !== 'signed-in') {
    return (
      <PendingPanel
        title="Leads no disponibles"
        description="Necesitas una sesión y una membresía activa en un despacho. No se cargarán datos demo."
      />
    )
  }
  if (membership.isPending) {
    return <PendingPanel title="Cargando Leads" description="Consultando el despacho activo…" />
  }
  if (!membership.data) {
    return (
      <PendingPanel
        title="Leads no disponibles"
        description="Tu usuario no tiene una membresía activa en un despacho."
      />
    )
  }
  return (
    <LeadsPersistidos
      firmId={membership.data.firmId}
      oportunidades={oportunidades.data ?? []}
      contactos={contactos.data ?? []}
      cargando={oportunidades.isLoading || contactos.isLoading}
      error={oportunidades.isError || contactos.isError}
    />
  )
}

const NOMBRES_FASE: Record<string, string> = {
  entry: 'Entrada',
  qualification: 'Cualificación',
  first_meeting: 'Primera cita',
  quote: 'Solicitud de presupuesto',
  validation: 'Validación',
  engagement: 'Enviado al cliente',
  won: 'Aceptado',
  lost: 'Cerrado / Perdido',
}

function LeadsPersistidos({
  firmId,
  oportunidades,
  contactos,
  cargando,
  error,
}: {
  firmId: string
  oportunidades: OportunidadResumen[]
  contactos: ContactoPersistido[]
  cargando: boolean
  error: boolean
}) {
  const [modo, setModo] = useState('kanban')
  const [query, setQuery] = useState('')
  const transition = useTransicionarOportunidad(firmId)
  const contactosPorId = useMemo(
    () =>
      new Map(
        contactos.map((contacto) => [
          contacto.id,
          contacto.razonSocial || `${contacto.nombre} ${contacto.apellidos ?? ''}`.trim(),
        ]),
      ),
    [contactos],
  )
  const filtradas = oportunidades.filter((oportunidad) => {
    const texto = `${oportunidad.referencia} ${oportunidad.titulo} ${contactosPorId.get(oportunidad.contactoId) ?? ''}`
    return texto.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  })
  const advance = async (oportunidad: OportunidadResumen, target: OpportunityStage) => {
    try {
      await transition.mutateAsync({
        id: oportunidad.id,
        fase: target,
        subestado: 'Sin revisar',
      })
      toast.success(`${oportunidad.referencia} → ${OPPORTUNITY_STAGE_LABELS[target]}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo avanzar el Lead.')
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Leads"
        subtitle="Registros persistentes del despacho con búsqueda y flujo de fases compartido."
        actions={
          <>
            <ViewSwitch
              value={modo}
              onChange={setModo}
              options={[
                { id: 'kanban', label: 'Kanban' },
                { id: 'lista', label: 'Lista' },
              ]}
            />
            <NuevaOportunidadBoton />
          </>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por código, contacto o asunto…"
          className="max-w-md"
        />
        <span className="text-muted-foreground text-xs">{filtradas.length} Leads</span>
      </div>
      {error ? (
        <p className="text-destructive mb-4 text-sm">No se han podido cargar los Leads.</p>
      ) : null}
      {modo === 'kanban' ? (
        <PersistentPipelineBoard
          oportunidades={filtradas}
          contactosPorId={contactosPorId}
          isPending={transition.isPending}
          onAdvance={advance}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Subestado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Actualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      Cargando Leads…
                    </TableCell>
                  </TableRow>
                ) : null}
                {filtradas.map((oportunidad) => (
                  <TableRow key={oportunidad.id}>
                    <TableCell className="font-medium">{oportunidad.referencia}</TableCell>
                    <TableCell>
                      {contactosPorId.get(oportunidad.contactoId) ?? 'Contacto eliminado'}
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate">
                      <Link
                        to="/oportunidades/$id"
                        params={{ id: oportunidad.id }}
                        className="hover:underline"
                      >
                        {oportunidad.titulo}
                      </Link>
                    </TableCell>
                    <TableCell>{NOMBRES_FASE[oportunidad.fase] ?? oportunidad.fase}</TableCell>
                    <TableCell>{oportunidad.subestado}</TableCell>
                    <TableCell>{oportunidad.origen || '—'}</TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat('es-ES').format(new Date(oportunidad.actualizada))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {!cargando && !filtradas.length ? (
        <p className="border-border text-muted-foreground mt-4 rounded-lg border border-dashed p-10 text-center text-sm">
          No hay Leads que cumplan estos criterios. Crea el primero para empezar el pipeline.
        </p>
      ) : null}
    </div>
  )
}
