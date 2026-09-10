import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import type {
  ActualizarOportunidadInput,
  ActualizarDetallesOportunidadInput,
  ArchivarOportunidadInput,
  EventoOportunidad,
  MiembroDespacho,
  OportunidadPersistida,
  OportunidadResumen,
  TransicionarOportunidadInput,
} from '@/features/crm/application'
import {
  getSupabaseBrowserClient,
  type Json,
  type OpportunityEventRow,
  type OpportunityInsert,
  type OpportunityRow,
} from '@/shared/infrastructure/supabase'

const createInputSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  area: z.string().trim().max(160).optional(),
  source: z.string().trim().max(160).optional(),
  description: z.string().trim().max(20_000).optional(),
  details: z.unknown(),
})

const updateInputSchema = z.object({
  id: z.string().uuid(),
  versionEsperada: z.number().int().positive(),
  titulo: z.string().trim().min(1).max(300),
  area: z.string().trim().max(160),
  prioridad: z.enum(['Alta', 'Media', 'Baja']),
  estadoOperativo: z.string().trim().min(1).max(160),
  origen: z.string().trim().max(160),
  descripcion: z.string().max(20_000),
  asignadoId: z.string().uuid().nullable(),
  valorEstimado: z.number().nonnegative().nullable(),
})

const updateDetailsInputSchema = z.object({
  id: z.string().uuid(),
  versionEsperada: z.number().int().positive(),
  detalles: z.record(z.unknown()),
})

export type CrearOportunidadInput = z.infer<typeof createInputSchema>

const priorityFromDatabase = { low: 'Baja', medium: 'Media', high: 'Alta' } as const
const priorityToDatabase = { Baja: 'low', Media: 'medium', Alta: 'high' } as const

function resumenFromRow(row: OpportunityRow): OportunidadResumen {
  return {
    id: row.id,
    referencia: row.reference,
    contactoId: row.contact_id,
    titulo: row.title,
    area: row.area,
    fase: row.stage,
    subestado: row.substage,
    prioridad: priorityFromDatabase[row.priority],
    estadoOperativo: row.operational_status,
    origen: row.source,
    creada: row.created_at,
    actualizada: row.updated_at,
    asignadoId: row.assigned_to,
  }
}

export function oportunidadFromRow(row: OpportunityRow): OportunidadPersistida {
  const detalle =
    row.details && typeof row.details === 'object' && !Array.isArray(row.details) ? row.details : {}
  const fechaObjetivo = detalle['fechaObjetivo']
  const probabilidad = detalle['probabilidad']
  return {
    ...resumenFromRow(row),
    descripcion: row.description,
    valorEstimado: row.estimated_amount,
    probabilidad: typeof probabilidad === 'number' ? probabilidad : 0,
    fechaObjetivo: typeof fechaObjetivo === 'string' && fechaObjetivo ? fechaObjetivo : null,
    asignadoId: row.assigned_to,
    archivadoEn: row.archived_at,
    motivoArchivo: row.archive_reason,
    detalles: detalle,
    version: row.version,
  }
}

function eventFromRow(row: OpportunityEventRow): EventoOportunidad {
  return {
    id: row.id,
    tipo: row.event_type,
    datos: row.payload,
    autorId: row.actor_id,
    creadoEn: row.created_at,
  }
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

function toInsert(firmId: string, input: CrearOportunidadInput): OpportunityInsert {
  return {
    firm_id: firmId,
    contact_id: input.contactId,
    title: input.title,
    area: input.area ?? '',
    stage: 'entry',
    substage: 'Sin revisar',
    priority: 'medium',
    operational_status: 'Debemos trabajo',
    source: input.source ?? '',
    description: input.description ?? '',
    details: asJson(input.details),
  }
}

export function useOportunidades(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'oportunidades', firmId],
    enabled: Boolean(firmId),
    queryFn: async (): Promise<OportunidadResumen[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_opportunities')
        .select('*')
        .eq('firm_id', firmId)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(resumenFromRow)
    },
  })
}

export function useOportunidad(firmId: string | undefined, id: string) {
  return useQuery({
    queryKey: ['crm', 'oportunidades', firmId, id],
    enabled: Boolean(firmId && id),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client
        .from('crm_opportunities')
        .select('*')
        .eq('id', id)
        .eq('firm_id', firmId)
        .maybeSingle()
      if (error) throw error
      return data ? oportunidadFromRow(data) : null
    },
  })
}

export function useEventosOportunidad(firmId: string | undefined, opportunityId: string) {
  return useQuery({
    queryKey: ['crm', 'opportunity-events', firmId, opportunityId],
    enabled: Boolean(firmId && opportunityId),
    queryFn: async (): Promise<EventoOportunidad[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_opportunity_events')
        .select('*')
        .eq('firm_id', firmId)
        .eq('opportunity_id', opportunityId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(eventFromRow)
    },
  })
}

export function useMiembrosDespacho(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'firm-members', firmId],
    enabled: Boolean(firmId),
    queryFn: async (): Promise<MiembroDespacho[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const membersResult = await client
        .from('crm_firm_members')
        .select('user_id, role')
        .eq('firm_id', firmId)
        .eq('status', 'active')
        .order('created_at')
      if (membersResult.error) throw membersResult.error
      const members = membersResult.data ?? []
      if (!members.length) return []
      const profilesResult = await client
        .from('crm_profiles')
        .select('id, display_name')
        .in(
          'id',
          members.map((member) => member.user_id),
        )
      if (profilesResult.error) throw profilesResult.error
      const names = new Map(
        (profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]),
      )
      return members.map((member) => ({
        id: member.user_id,
        nombre: names.get(member.user_id) || 'Usuario sin nombre visible',
        rol: member.role,
      }))
    },
  })
}

export function useActualizarOportunidad(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rawInput: ActualizarOportunidadInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const input = updateInputSchema.parse(rawInput)
      const { data, error } = await client.rpc('crm_update_opportunity', {
        target_opportunity_id: input.id,
        target_expected_version: input.versionEsperada,
        new_title: input.titulo,
        new_area: input.area,
        new_priority: priorityToDatabase[input.prioridad],
        new_operational_status: input.estadoOperativo,
        new_source: input.origen,
        new_description: input.descripcion,
        new_assigned_to: input.asignadoId,
        new_estimated_amount: input.valorEstimado,
      })
      if (error?.code === '40001') {
        throw new Error('Otro usuario ha modificado este Lead. Recarga la ficha antes de guardar.')
      }
      if (error) throw error
      return oportunidadFromRow(data)
    },
    onSuccess: (oportunidad) => {
      queryClient.setQueryData(['crm', 'oportunidades', firmId, oportunidad.id], oportunidad)
      queryClient.setQueryData<OportunidadResumen[]>(['crm', 'oportunidades', firmId], (actuales) =>
        actuales?.map((actual) => (actual.id === oportunidad.id ? oportunidad : actual)),
      )
      void queryClient.invalidateQueries({
        queryKey: ['crm', 'oportunidades', firmId],
        exact: true,
      })
    },
  })
}

export function useActualizarDetallesOportunidad(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rawInput: ActualizarDetallesOportunidadInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const input = updateDetailsInputSchema.parse(rawInput)
      const { data, error } = await client.rpc('crm_update_opportunity_details', {
        target_opportunity_id: input.id,
        target_expected_version: input.versionEsperada,
        new_details: asJson(input.detalles),
      })
      if (error?.code === '40001')
        throw new Error('Otro usuario ha modificado este Lead. Recarga la ficha antes de guardar.')
      if (error) throw error
      return oportunidadFromRow(data)
    },
    onSuccess: (oportunidad) => {
      queryClient.setQueryData(['crm', 'oportunidades', firmId, oportunidad.id], oportunidad)
      void queryClient.invalidateQueries({
        queryKey: ['crm', 'oportunidades', firmId],
        exact: true,
      })
      void queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunity-events', firmId, oportunidad.id],
      })
    },
  })
}

export function useRegistrarComunicacionOportunidad(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      opportunityId: string
      tipo: 'email_draft' | 'phone_call' | 'meeting'
      resumen: string
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.resumen.trim()) throw new Error('Indica el resumen de la comunicación.')
      const { error } = await client.rpc('crm_log_opportunity_communication', {
        target_opportunity_id: input.opportunityId,
        communication_type: input.tipo,
        subject_or_summary: input.resumen.trim(),
      })
      if (error) throw error
    },
    onSuccess: (_, input) =>
      void queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunity-events', firmId, input.opportunityId],
      }),
  })
}

export function useCrearOportunidad(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rawInput: CrearOportunidadInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const input = createInputSchema.parse(rawInput)
      const { data, error } = await client
        .from('crm_opportunities')
        .insert(toInsert(firmId, input))
        .select()
        .single()
      if (error) throw error
      return resumenFromRow(data)
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['crm', 'oportunidades', firmId] }),
  })
}

export function useTransicionarOportunidad(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, fase, subestado, motivo }: TransicionarOportunidadInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_transition_opportunity', {
        target_opportunity_id: id,
        target_stage: fase,
        target_substage: subestado,
        transition_reason: motivo?.trim() || null,
      })
      if (error) throw error
      return oportunidadFromRow(data)
    },
    onSuccess: (oportunidad) => {
      queryClient.setQueryData(['crm', 'oportunidades', firmId, oportunidad.id], oportunidad)
      queryClient.setQueryData<OportunidadResumen[]>(['crm', 'oportunidades', firmId], (actuales) =>
        actuales?.map((actual) => (actual.id === oportunidad.id ? oportunidad : actual)),
      )
      void queryClient.invalidateQueries({
        queryKey: ['crm', 'oportunidades', firmId],
        exact: true,
      })
    },
  })
}

export function useArchivarOportunidad(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, versionEsperada, motivo }: ArchivarOportunidadInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const reason = motivo.trim()
      if (!reason) throw new Error('Indica el motivo del archivo.')
      if (reason.length > 1000) throw new Error('El motivo no puede superar 1.000 caracteres.')
      const { error } = await client.rpc('crm_archive_opportunity', {
        target_opportunity_id: id,
        target_expected_version: versionEsperada,
        archive_reason: reason,
      })
      if (error?.code === '40001') {
        throw new Error(
          'Otro usuario ha modificado este Lead. Recarga la ficha antes de archivarlo.',
        )
      }
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<OportunidadResumen[]>(['crm', 'oportunidades', firmId], (actuales) =>
        actuales?.filter((actual) => actual.id !== id),
      )
      queryClient.removeQueries({ queryKey: ['crm', 'oportunidades', firmId, id], exact: true })
    },
  })
}
