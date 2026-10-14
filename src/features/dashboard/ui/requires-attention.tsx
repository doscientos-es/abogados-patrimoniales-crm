import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMiembrosDespacho, type OportunidadResumen } from '@/features/crm'
import type { ExpedientePersistido } from '@/features/expedientes'
import type { TareaPersistida } from '@/features/tareas'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

import {
  MOTIVO_LABEL,
  filtrarIncidencias,
  incidenciasAtencion,
  type DocumentoPendiente,
  type FiltroAtencion,
  type Incidencia,
} from '../application/requires-attention'

const selectClass =
  'border-input bg-background h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

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
    'hover:bg-muted/50 flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors'
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
  const name = (id: string | null) =>
    id
      ? (members.data?.find((member) => member.id === id)?.nombre ?? 'Otro miembro')
      : 'Sin responsable'

  return (
    <Card data-testid="requires-attention">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="text-warning h-4 w-4" aria-hidden="true" /> Requiere atención
          <Badge variant={allIncidents.length ? 'default' : 'outline'}>{allIncidents.length}</Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select
            aria-label="Responsable"
            className={selectClass}
            value={filters.responsableId}
            onChange={(event) => setFilters({ ...filters, responsableId: event.target.value })}
          >
            <option value="all">Todos los responsables</option>
            <option value="none">Sin responsable</option>
            {(members.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.nombre}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={filters.misTareas}
              onChange={(event) => setFilters({ ...filters, misTareas: event.target.checked })}
            />
            Mis tareas
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={filters.siguientesAcciones}
              onChange={(event) =>
                setFilters({ ...filters, siguientesAcciones: event.target.checked })
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
          <p className="text-muted-foreground text-sm">
            {allIncidents.length ? 'Nada con estos filtros.' : 'Todo en orden: no hay incidencias.'}
          </p>
        ) : (
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {incidents.map((incident) => (
              <Destino key={incident.id} incidencia={incident}>
                <span className="min-w-0 space-y-0.5">
                  <span className="text-muted-foreground block text-xs uppercase">
                    {MOTIVO_LABEL[incident.motivo]}
                  </span>
                  <span className="block truncate font-medium">{incident.titulo}</span>
                  <span className="text-muted-foreground block text-xs">
                    {incident.explicacion} · {name(incident.responsableId)}
                  </span>
                </span>
                <ChevronRight
                  className="text-muted-foreground mt-1 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </Destino>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
