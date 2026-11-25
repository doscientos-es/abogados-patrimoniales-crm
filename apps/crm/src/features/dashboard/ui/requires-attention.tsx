import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  FileCheck,
  FileSearch,
  Hourglass,
  Route,
  Send,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMiembrosDespacho, type OportunidadResumen } from '@/features/crm'
import type { ExpedientePersistido } from '@/features/expedientes'
import type { TareaPersistida } from '@/features/tareas'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

import {
  filtrarIncidencias,
  incidenciasAtencion,
  type DocumentoPendiente,
  type FiltroAtencion,
  type Incidencia,
  type MotivoAtencion,
} from '../application/requires-attention'

const PAGE_SIZE = 8

const MOTIVO_STYLE: Record<MotivoAtencion, { icon: LucideIcon; tone: string; short: string }> = {
  tarea_vencida: { icon: Clock, tone: 'bg-destructive/10 text-destructive', short: 'Vencida' },
  espera_vencida: { icon: Hourglass, tone: 'bg-amber-100 text-amber-700', short: 'Espera vencida' },
  tarea_sin_responsable: {
    icon: UserX,
    tone: 'bg-amber-100 text-amber-700',
    short: 'Sin responsable',
  },
  sin_siguiente_accion: {
    icon: Route,
    tone: 'bg-blue-100 text-blue-700',
    short: 'Sin siguiente acción',
  },
  revision_presupuesto: {
    icon: FileCheck,
    tone: 'bg-violet-100 text-violet-700',
    short: 'Revisar presupuesto',
  },
  presupuesto_sin_seguimiento: {
    icon: Send,
    tone: 'bg-violet-100 text-violet-700',
    short: 'Presupuesto sin seguimiento',
  },
  documento_por_comprobar: {
    icon: FileSearch,
    tone: 'bg-slate-100 text-slate-700',
    short: 'Documento por comprobar',
  },
}

const selectClass =
  'border-input bg-background focus-visible:ring-ring h-9 max-w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2'

/** Documentos recibidos en bandeja, sin leer su contenido ni saltarse las políticas del cliente. */
function useDocumentosPorComprobar(firmId: string) {
  return useQuery({
    queryKey: ['dashboard', 'documents-to-check', firmId],
    queryFn: async (): Promise<DocumentoPendiente[]> => {
      const client = getSupabaseBrowserClient()
      if (!client) return []
      const { data, error } = await client
        .from('crm_case_documents')
        .select('id, original_name, case_id')
        .eq('firm_id', firmId)
        .eq('workflow_status', 'inbox')
        .eq('is_current', true)
        .is('archived_at', null)
        .limit(500)
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        nombre: row.original_name,
        expedienteId: row.case_id,
        asignadoId: null,
      }))
    },
  })
}

function Destino({ incidencia, children }: { incidencia: Incidencia; children: ReactNode }) {
  const className =
    'hover:bg-muted/50 focus-visible:ring-ring group flex items-start gap-3 rounded-lg px-2 py-3 text-sm transition-colors outline-none focus-visible:ring-2 sm:px-3'
  const destination = incidencia.destino
  if (destination.tipo === 'tarea')
    return (
      <Link to="/tareas/$taskId" params={{ taskId: destination.id }} className={className}>
        {children}
      </Link>
    )
  if (destination.tipo === 'expediente')
    return (
      <Link to="/expedientes/$id" params={{ id: destination.id }} className={className}>
        {children}
      </Link>
    )
  if (destination.tipo === 'lead')
    return (
      <Link
        to="/oportunidades/$id"
        params={{ id: destination.id }}
        search={{ tab: 'sent' }}
        className={className}
      >
        {children}
      </Link>
    )
  return (
    <Link to="/documentos" className={className}>
      {children}
    </Link>
  )
}

/** Escritorio: incidencias que explican el motivo y llevan al registro que las origina. */
export function RequiresAttention({
  firmId,
  userId,
  tasks,
  cases,
  opportunities,
  now,
}: {
  firmId: string
  userId: string | null
  tasks: TareaPersistida[]
  cases: ExpedientePersistido[]
  opportunities: OportunidadResumen[]
  now: number
}) {
  const documents = useDocumentosPorComprobar(firmId)
  const members = useMiembrosDespacho(firmId)
  const [filters, setFilters] = useState<FiltroAtencion>({
    responsableId: 'all',
    misTareas: false,
    siguientesAcciones: false,
  })
  const allIncidents = incidenciasAtencion(
    { tasks, cases, opportunities, documents: documents.data ?? [] },
    now,
  )
  const incidents = filtrarIncidencias(allIncidents, filters, userId)
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(incidents.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = incidents.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const updateFilters = (next: FiltroAtencion) => {
    setFilters(next)
    setPage(0)
  }
  const name = (id: string | null) =>
    id
      ? (members.data?.find((member) => member.id === id)?.nombre ?? 'Otro miembro')
      : 'Sin responsable'

  return (
    <Card data-testid="requires-attention" className="border-border/70 gap-0 rounded-2xl shadow-sm">
      <CardHeader className="gap-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-warning/15 text-warning-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
              <AlertTriangle className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base">Requiere atención</CardTitle>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                Cuenta incidencias de tareas, expedientes, Leads y documentos; un mismo registro
                puede tener varias.
              </p>
            </div>
          </div>
          <Badge variant={allIncidents.length ? 'default' : 'outline'} className="shrink-0">
            {allIncidents.length} en total
          </Badge>
        </div>
        <div
          aria-label="Filtros de incidencias"
          className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-xl p-2 text-sm"
        >
          <select
            aria-label="Responsable"
            className={selectClass}
            value={filters.responsableId}
            onChange={(event) => updateFilters({ ...filters, responsableId: event.target.value })}
          >
            <option value="all">Todos los responsables</option>
            <option value="none">Sin responsable</option>
            {(members.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.nombre}
              </option>
            ))}
          </select>
          <label className="hover:bg-background/80 flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-medium sm:text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={filters.misTareas}
              onChange={(event) => updateFilters({ ...filters, misTareas: event.target.checked })}
            />
            Mis tareas
          </label>
          <label className="hover:bg-background/80 flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-medium sm:text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={filters.siguientesAcciones}
              onChange={(event) =>
                updateFilters({ ...filters, siguientesAcciones: event.target.checked })
              }
            />
            Siguientes acciones
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.isError ? (
          <p className="text-muted-foreground text-xs">
            No se pudo consultar la documentación pendiente de comprobar.
          </p>
        ) : null}
        {incidents.length === 0 ? (
          <p className="text-muted-foreground py-3 text-sm">
            {allIncidents.length ? 'Nada con estos filtros.' : 'Todo en orden: no hay incidencias.'}
          </p>
        ) : (
          <ul className="divide-border/70 divide-y">
            {visible.map((incident) => {
              const { icon: Icon, tone, short } = MOTIVO_STYLE[incident.motivo]
              return (
                <li key={incident.id}>
                  <Destino incidencia={incident}>
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold break-words">
                        {incident.titulo}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs leading-relaxed break-words">
                        <span className="text-foreground font-medium">{short}</span>
                        {' · '}
                        {name(incident.responsableId)}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs leading-relaxed break-words">
                        {incident.explicacion}
                      </span>
                    </span>
                    <ChevronRight
                      className="text-muted-foreground group-hover:text-foreground mt-2 size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Destino>
                </li>
              )
            })}
          </ul>
        )}
        {incidents.length > PAGE_SIZE ? (
          <nav
            aria-label="Paginación de incidencias"
            className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm"
          >
            <span className="text-muted-foreground text-xs">
              {currentPage * PAGE_SIZE + 1}–{currentPage * PAGE_SIZE + visible.length} de{' '}
              {incidents.length}
            </span>
            <span className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                {currentPage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </span>
          </nav>
        ) : null}
      </CardContent>
    </Card>
  )
}
