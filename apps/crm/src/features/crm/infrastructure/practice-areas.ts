import { useQuery } from '@tanstack/react-query'

import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

/** The same top-level catalog is used for Leads and cases. */
export function usePracticeAreas(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'practice-areas', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client
        .from('crm_practice_areas')
        .select('name')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .is('parent_id', null)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data.map((item) => item.name)
    },
  })
}
