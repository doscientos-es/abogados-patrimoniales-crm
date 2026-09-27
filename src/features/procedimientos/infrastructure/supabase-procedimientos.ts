import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Json } from '@/shared/infrastructure/supabase'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

import type { SaveProcedureInput } from '../application/types'

const proceduresKey = (firmId: string | undefined) => ['crm', 'procedures', firmId] as const
const runsKey = (firmId: string | undefined) => ['crm', 'procedure-runs', firmId] as const

export function useProcedures(firmId: string | undefined) {
  return useQuery({
    queryKey: proceduresKey(firmId),
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_procedures')
        .select('*')
        .eq('firm_id', firmId)
        .order('phase')
        .order('title')
      if (error) throw error
      return data
    },
  })
}

export function useProcedureRuns(firmId: string | undefined, procedureId?: string) {
  return useQuery({
    queryKey: [...runsKey(firmId), procedureId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      let query = client.from('crm_procedure_runs').select('*').eq('firm_id', firmId)
      if (procedureId) query = query.eq('procedure_id', procedureId)
      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useProcedureEvents(firmId: string | undefined, procedureId: string) {
  return useQuery({
    queryKey: ['crm', 'procedure-events', firmId, procedureId],
    enabled: Boolean(firmId && procedureId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_procedure_events')
        .select('*')
        .eq('firm_id', firmId)
        .eq('procedure_id', procedureId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSaveProcedure(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveProcedureInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_save_procedure', {
        target_firm_id: firmId,
        target_procedure_id: input.id,
        target_expected_version: input.id ? input.version : null,
        new_slug: input.slug,
        new_title: input.title,
        new_phase: input.phase,
        new_description: input.description,
        new_sections: input.sections as unknown as Json,
        new_status: input.status,
      })
      if (error?.code === '40001')
        throw new Error(
          'Otra persona ha editado este procedimiento. Recarga para ver la última versión.',
        )
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: proceduresKey(firmId) })
      void queryClient.invalidateQueries({ queryKey: ['crm', 'procedure-events', firmId] })
    },
  })
}

export function useStartProcedureRun(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      procedureId: string
      caseId: string | null
      opportunityId: string | null
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_start_procedure_run', {
        target_firm_id: firmId,
        target_procedure_id: input.procedureId,
        target_case_id: input.caseId,
        target_opportunity_id: input.opportunityId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: runsKey(firmId) })
      void queryClient.invalidateQueries({ queryKey: ['crm', 'procedure-events', firmId] })
    },
  })
}

export function useUpdateProcedureRun(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      version: number
      checklist: Json
      notes: string
      status: 'in_progress' | 'completed' | 'cancelled'
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_update_procedure_run', {
        target_firm_id: firmId,
        target_run_id: input.id,
        target_expected_version: input.version,
        new_checklist: input.checklist,
        new_notes: input.notes,
        new_status: input.status,
      })
      if (error?.code === '40001')
        throw new Error('Otra persona ha actualizado esta ejecución. Recarga antes de guardar.')
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: runsKey(firmId) })
      void queryClient.invalidateQueries({ queryKey: ['crm', 'procedure-events', firmId] })
    },
  })
}
