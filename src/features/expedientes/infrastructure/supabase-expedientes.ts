import { useQuery } from '@tanstack/react-query'

import type {
  ActuacionPersistida,
  ExpedientePersistido,
  LineaPersistida,
  PrioridadExpediente,
} from '@/features/expedientes/application/case-types'
import {
  getSupabaseBrowserClient,
  type CaseActivityRow,
  type CaseRow,
  type CaseWorkstreamRow,
  type OpportunityPriority,
} from '@/shared/infrastructure/supabase'

const priorityFromDatabase: Record<OpportunityPriority, PrioridadExpediente> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

const expedienteFromRow = (row: CaseRow): ExpedientePersistido => ({
  id: row.id,
  referencia: row.reference,
  contactoPrincipalId: row.primary_contact_id,
  oportunidadId: row.opportunity_id,
  titulo: row.title,
  area: row.area,
  tipoAsunto: row.matter_type,
  naturaleza: row.nature === 'judicial' ? 'Judicial' : 'Extrajudicial',
  estadoGeneral: row.general_status,
  fase: row.phase,
  estadoOperativo: row.operational_status,
  prioridad: priorityFromDatabase[row.priority],
  asignadoId: row.assigned_to,
  fechaApertura: row.opened_on,
  fechaCierre: row.closed_on,
  proximaAccion: row.next_action,
  dondeEstamos: row.current_position,
  version: row.version,
  actualizadoEn: row.updated_at,
})

const lineaFromRow = (row: CaseWorkstreamRow): LineaPersistida => ({
  id: row.id,
  expedienteId: row.case_id,
  parentId: row.parent_id,
  titulo: row.title,
  tipo: row.work_type,
  descripcion: row.description,
  estado: row.status,
  prioridad: priorityFromDatabase[row.priority],
  asignadoId: row.assigned_to,
  fechaInicio: row.starts_on,
  fechaObjetivo: row.target_on,
  fechaResolucion: row.resolved_on,
  fechaCierre: row.closed_on,
  orden: row.sort_order,
  version: row.version,
})

const actuacionFromRow = (row: CaseActivityRow): ActuacionPersistida => ({
  id: row.id,
  expedienteId: row.case_id,
  lineaId: row.workstream_id,
  tipo: row.activity_type,
  titulo: row.title,
  descripcion: row.description,
  ocurridaEn: row.occurred_at,
  asignadoId: row.assigned_to,
  estado: row.status,
  resultado: row.result,
  proximaAccion: row.next_action,
  horas: row.time_spent_hours,
  facturable: row.billable,
  visibleCliente: row.client_visible,
  clienteInformado: row.client_informed,
  version: row.version,
})

export function useExpedientesPersistentes(firmId: string | undefined) {
  return useQuery({
    queryKey: ['expedientes', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_cases')
        .select('*')
        .eq('firm_id', firmId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(expedienteFromRow)
    },
  })
}

export function useExpedientePersistente(firmId: string | undefined, id: string) {
  return useQuery({
    queryKey: ['expedientes', firmId, id],
    enabled: Boolean(firmId && id),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return null
      const { data, error } = await client
        .from('crm_cases')
        .select('*')
        .eq('firm_id', firmId)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data ? expedienteFromRow(data) : null
    },
  })
}

export function useLineasPersistentes(firmId: string | undefined, caseId: string) {
  return useQuery({
    queryKey: ['expedientes', firmId, caseId, 'lineas'],
    enabled: Boolean(firmId && caseId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_case_workstreams')
        .select('*')
        .eq('firm_id', firmId)
        .eq('case_id', caseId)
        .order('sort_order')
      if (error) throw error
      return data.map(lineaFromRow)
    },
  })
}

export function useActuacionesPersistentes(firmId: string | undefined, caseId: string) {
  return useQuery({
    queryKey: ['expedientes', firmId, caseId, 'actuaciones'],
    enabled: Boolean(firmId && caseId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_case_activities')
        .select('*')
        .eq('firm_id', firmId)
        .eq('case_id', caseId)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return data.map(actuacionFromRow)
    },
  })
}
