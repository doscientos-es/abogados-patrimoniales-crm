import { useQuery } from '@tanstack/react-query'

import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export type GlobalSearchResult = {
  id: string
  entity_type: string
  title: string
  subtitle: string
  href: string
  rank: number
}

export function useGlobalSearch(firmId: string | undefined, searchTerm: string) {
  const term = searchTerm.trim()
  return useQuery({
    queryKey: ['crm', 'global-search', firmId, term],
    enabled: Boolean(firmId && term.length >= 2),
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client.rpc('crm_global_search', {
        target_firm_id: firmId,
        search_term: term,
      })
      if (error) throw error
      return data ?? []
    },
  })
}
