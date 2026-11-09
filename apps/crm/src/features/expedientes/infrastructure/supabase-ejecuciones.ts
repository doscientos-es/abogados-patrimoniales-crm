import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getSupabaseBrowserClient,
  type ExecutionInsert,
  type ExecutionRow,
} from '@/shared/infrastructure/supabase'

export function useEjecucionesDespacho(firmId: string | undefined) {
  return useQuery({
    queryKey: ['executions', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_executions')
        .select('*')
        .eq('firm_id', firmId)
        .order('next_review_on', { nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCrearEjecucion(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<ExecutionInsert, 'firm_id'>) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (!input.title.trim()) throw new Error('El título de la ejecución es obligatorio.')
      if (
        input.claimed_amount < 0 ||
        input.recovered_amount < 0 ||
        input.recovered_amount > input.claimed_amount
      )
        throw new Error('Revisa los importes reclamados y recuperados.')
      const { data, error } = await client
        .from('crm_executions')
        .insert({ ...input, firm_id: firmId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executions', firmId] }),
  })
}

export function useActualizarEjecucion(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      execution,
      patch,
    }: {
      execution: ExecutionRow
      patch: Partial<ExecutionRow>
    }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      if (
        patch.claimed_amount !== undefined &&
        patch.recovered_amount !== undefined &&
        patch.recovered_amount > patch.claimed_amount
      )
        throw new Error('El importe recuperado no puede superar el reclamado.')
      const { data, error } = await client
        .from('crm_executions')
        .update(patch)
        .eq('firm_id', firmId)
        .eq('id', execution.id)
        .eq('version', execution.version)
        .select()
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('La ejecución cambió en otra sesión. Recarga antes de guardar.')
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executions', firmId] }),
  })
}

export function useDerivarEjecucionJudicial(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (execution: ExecutionRow) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_derive_execution', {
        target_execution_id: execution.id,
        target_expected_version: execution.version,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executions', firmId] }),
  })
}
