import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import {
  getSupabaseBrowserClient,
  type Json,
  type OpportunityInsert,
  type OpportunityRow,
} from '@/shared/infrastructure/supabase'

const createInputSchema = z.object({
  contactId: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  source: z.string().trim().max(160).optional(),
  description: z.string().trim().max(20_000).optional(),
  details: z.unknown(),
})

export type CrearOportunidadInput = z.infer<typeof createInputSchema>

export type OportunidadResumen = {
  id: string
  referencia: string
  contactoId: string
  titulo: string
  area: string
  fase: string
  subestado: string
  prioridad: 'Alta' | 'Media' | 'Baja'
  estadoOperativo: string
  origen: string
  creada: string
  actualizada: string
}

const priorityFromDatabase = { low: 'Baja', medium: 'Media', high: 'Alta' } as const

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
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(resumenFromRow)
    },
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
