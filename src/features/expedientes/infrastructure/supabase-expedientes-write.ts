import { useMutation, useQueryClient } from '@tanstack/react-query'

import type {
  ActualizarExpedienteInput,
  ActualizarLineaInput,
  ActualizarParticipanteInput,
  CrearExpedienteInput,
  CrearLineaInput,
  CrearParticipanteInput,
  ExpedientePersistido,
  PrioridadExpediente,
} from '@/features/expedientes/application/case-types'
import {
  getSupabaseBrowserClient,
  type CaseParticipantInsert,
  type CaseWorkstreamInsert,
  type Json,
  type OpportunityPriority,
} from '@/shared/infrastructure/supabase'

import { expedienteFromRow, lineaFromRow } from './supabase-expedientes'

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
        status: input.estado || 'pending',
        assigned_to: input.asignadoId,
        target_on: input.fechaObjetivo,
        details: input.objetivos.trim() ? { objetivo: input.objetivos.trim() } : {},
      }
      const { error } = await client.from('crm_case_workstreams').insert(payload)
      if (error) throw error
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}

export function useActualizarLinea(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ActualizarLineaInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_case_workstream', {
        target_workstream_id: input.id,
        target_expected_version: input.versionEsperada,
        new_parent_id: input.parentId,
        new_title: required(input.titulo, 'El título'),
        new_work_type: input.tipo,
        new_description: input.descripcion,
        new_status: input.estado,
        new_priority: priorityToDatabase[input.prioridad],
        new_assigned_to: input.asignadoId,
        new_starts_on: input.fechaInicio,
        new_target_on: input.fechaObjetivo,
        new_resolved_on: input.fechaResolucion,
        new_closed_on: input.fechaCierre,
        new_details: input.details,
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario modificó la línea. Recarga antes de guardar.')
      if (error) throw error
      return lineaFromRow(data)
    },
    onSuccess: (_, input) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
        queryClient.invalidateQueries({
          queryKey: ['expedientes', firmId, input.expedienteId, 'eventos'],
        }),
      ]).then(() => undefined),
  })
}

export function useReordenarLineas(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { expedienteId: string; ids: string[] }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_reorder_case_workstreams', {
        target_case_id: input.expedienteId,
        ordered_ids: input.ids,
      })
      if (error) throw error
    },
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
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
        details: compact({
          tipo: input.rol,
          ref: input.ref?.trim(),
          descripcion: input.descripcion?.trim(),
          orden: input.orden,
          titularId: input.titularId,
          miembroId: input.miembroId,
        }),
      }
      if (Boolean(input.contactoId) === Boolean(input.miembroId))
        throw new Error('Selecciona una persona del directorio o un profesional del despacho.')
      const { data, error } = await client
        .from('crm_case_participants')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}

function compact(values: Record<string, unknown>): Json {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Json
}

function asObject(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
}

/** Actualiza el papel del contacto en el expediente, sin editar su ficha global. */
export function useActualizarParticipante(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ActualizarParticipanteInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (Boolean(input.contactoId) === Boolean(input.miembroId))
        throw new Error('Selecciona una persona del directorio o un profesional del despacho.')
      const details = asObject(input.detallesActuales)
      details['tipo'] = input.rol
      details['ref'] = input.ref.trim()
      details['descripcion'] = input.descripcion.trim()
      if (input.miembroId) details['miembroId'] = input.miembroId
      else delete details['miembroId']
      const { data, error } = await client
        .from('crm_case_participants')
        .update({
          contact_id: input.contactoId,
          name: required(input.nombre, 'El nombre'),
          role: required(input.rol, 'El tipo'),
          details: details as Json,
        })
        .eq('id', input.id)
        .eq('firm_id', firmId)
        .eq('case_id', input.expedienteId)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('La intervención ya no está disponible en este expediente.')
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}

/** Retira intervenciones y contactos subordinados conservando su histórico. */
export function useQuitarParticipante(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      expedienteId: string
      rows: Array<{ id: string; detalles?: Json | undefined }>
      actorId: string | null
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const retiredAt = new Date().toISOString()
      for (const row of input.rows) {
        const details = asObject(row.detalles)
        details['retiradoEn'] = retiredAt
        if (input.actorId) details['retiradoPor'] = input.actorId
        const { data, error } = await client
          .from('crm_case_participants')
          .update({ details: details as Json })
          .eq('id', row.id)
          .eq('firm_id', firmId)
          .eq('case_id', input.expedienteId)
          .select('id')
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Una intervención ya no está disponible en este expediente.')
      }
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}

/** Persiste el orden manual de intervinientes en el JSONB ya disponible. */
export function useReordenarParticipantes(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      expedienteId: string
      cambios: Array<{ id: string; orden: number; detalles?: Json | undefined }>
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      for (const change of input.cambios) {
        const details = asObject(change.detalles)
        details['orden'] = change.orden
        const { data, error } = await client
          .from('crm_case_participants')
          .update({ details: details as Json })
          .eq('id', change.id)
          .eq('firm_id', firmId)
          .eq('case_id', input.expedienteId)
          .select('id')
          .maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Una intervención ya no está disponible en este expediente.')
      }
    },
    onSettled: (_, __, input) =>
      void queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, input.expedienteId] }),
  })
}
