import { useQuery } from '@tanstack/react-query'

import { DEFAULT_LEAD_ROLES } from '@/features/crm/application/lead-roles'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export function useLeadRoles(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'lead-roles', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return [...DEFAULT_LEAD_ROLES]
      const { data, error } = await client
        .from('crm_lead_roles')
        .select('name')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .order('name')
      if (error) throw error
      const roles = (data ?? []).map((row) => row.name)
      return roles.length ? roles : [...DEFAULT_LEAD_ROLES]
    },
  })
}