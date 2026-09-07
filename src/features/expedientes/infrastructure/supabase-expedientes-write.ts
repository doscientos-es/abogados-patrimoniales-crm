import { useMutation, useQueryClient } from '@tanstack/react-query'

import type {
  ActualizarExpedienteInput,
  CrearActuacionInput,
  CrearExpedienteInput,
  CrearLineaInput,
  CrearParticipanteInput,
  ExpedientePersistido,
  PrioridadExpediente,
} from '@/features/expedientes/application/case-types'
import {
  getSupabaseBrowserClient,
  type CaseActivityInsert,
  type CaseParticipantInsert,
  type CaseWorkstreamInsert,
  type OpportunityPriority,
} from '@/shared/infrastructure/supabase'

import { expedienteFromRow } from './supabase-expedientes'

const priorityToDatabase: Record<PrioridadExpediente, OpportunityPriority> = {
  Baja: 'low',
  Media: 'medium',
  Alta: 'high',
}
const natureToDatabase = { Judicial: 'judicial', Extrajudicial: 'extrajudicial' } as const
const confidentialityToDatabase = {
  Normal: 'normal',
  Restringida: 'restricted',
  Confidencial: 'confidential',
} as const

function required(value: string, label: string) {
  const clean = value.trim()
  if (!clean) throw new Error(`${label} es obligatorio.`)
  return clean
}

export function useCrearExpediente(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrearExpedienteInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_create_case', {
        target_firm_id: firmId,
        target_contact_id: required(input.contactoPrincipalId, 'El contacto principal'),
        target_opportunity_id: input.oportunidadId ?? null,
        new_title: required(input.titulo, 'El asunto'),
        new_area: input.area.trim(),
        new_matter_type: input.tipoAsunto.trim(),
        new_nature: natureToDatabase[input.naturaleza],
        new_priority: priorityToDatabase[input.prioridad],
        new_assigned_to: input.asignadoId,
        new_opened_on: input.fechaApertura,
        new_next_action: input.proximaAccion.trim(),
        new_current_position: input.dondeEstamos.trim(),
      })
      if (error) throw error
      return expedienteFromRow(data)
    },
    onSuccess: (expediente) => {
      queryClient.setQueryData<ExpedientePersistido[]>(['expedientes', firmId], (actuales) => [
        expediente,
        ...(actuales ?? []),
      ])
    },
  })
}

export function useActualizarExpediente(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ActualizarExpedienteInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_case', {
        target_case_id: input.id,
        target_expected_version: input.versionEsperada,
        new_title: required(input.titulo, 'El asunto'),
        new_area: input.area,
        new_matter_type: input.tipoAsunto,
        new_nature: natureToDatabase[input.naturaleza],
        new_general_status: required(input.estadoGeneral, 'El estado'),
        new_phase: required(input.fase, 'La fase'),
        new_operational_status: required(input.estadoOperativo, 'La situación operativa'),
        new_priority: priorityToDatabase[input.prioridad],
        new_assigned_to: input.asignadoId,
        new_opened_on: input.fechaApertura,
        new_closed_on: input.fechaCierre,
        new_next_action: input.proximaAccion,
        new_current_position: input.dondeEstamos,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó el expediente. Recarga antes de guardar.')
      if (error) throw error
      return expedienteFromRow(data)
    },
    onSuccess: (expediente) => {
      queryClient.setQueryData(['expedientes', firmId, expediente.id], expediente)
      queryClient.setQueryData<ExpedientePersistido[]>(['expedientes', firmId], (actuales) =>
        actuales?.map((actual) => (actual.id === expediente.id ? expediente : actual)),
      )
      void queryClient.invalidateQueries({
        queryKey: ['expedientes', firmId, expediente.id, 'eventos'],
      })
    },
  })
}

export function useCrearLinea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrearLineaInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const payload: CaseWorkstreamInsert = {
        firm_id: firmId,
        case_id: input.expedienteId,
        title: required(input.titulo, 'El título'),
        work_type: input.tipo,
        description: input.descripcion,
        priority: priorityToDatabase[input.prioridad],
        assigned_to: input.asignadoId,
        target_on: input.fechaObjetivo,
      }
      const { error } = await client.from('crm_case_workstreams').insert(payload)
      if (error) throw error
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}

export function useCrearActuacion(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrearActuacionInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const payload: CaseActivityInsert = {
        firm_id: firmId,
        case_id: input.expedienteId,
        workstream_id: input.lineaId,
        activity_type: required(input.tipo, 'El tipo'),
        title: required(input.titulo, 'El título'),
        description: input.descripcion,
        assigned_to: input.asignadoId,
        result: input.resultado,
        next_action: input.proximaAccion,
        time_spent_hours: input.horas,
        billable: input.facturable,
      }
      const { error } = await client.from('crm_case_activities').insert(payload)
      if (error) throw error
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}

export function useCrearParticipante(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrearParticipanteInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const payload: CaseParticipantInsert = {
        firm_id: firmId,
        case_id: input.expedienteId,
        contact_id: input.contactoId,
        name: required(input.nombre, 'El nombre'),
        role: required(input.rol, 'El rol'),
        confidentiality: confidentialityToDatabase[input.confidencialidad],
      }
      const { error } = await client.from('crm_case_participants').insert(payload)
      if (error) throw error
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}
