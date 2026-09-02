import { useQuery } from '@tanstack/react-query'

import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export type ActiveMembership = { firmId: string; role: 'owner' | 'admin' | 'lawyer' | 'paralegal' }

export function useActiveMembership(userId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'active-membership', userId],
    enabled: Boolean(userId && getSupabaseBrowserClient()),
    queryFn: async (): Promise<ActiveMembership | null> => {
      const client = getSupabaseBrowserClient()
      if (!client || !userId) return null
      const { data, error } = await client
        .from('crm_firm_members')
        .select('firm_id, role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      if (error) throw error
      return data ? { firmId: data.firm_id, role: data.role } : null
    },
  })
}

export async function bootstrapFirm(name: string) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase no está configurado en este entorno.')
  const { data, error } = await client.rpc('crm_bootstrap_firm', { firm_name: name })
  if (error || !data) throw error ?? new Error('No se pudo crear el despacho.')
  return data
}
