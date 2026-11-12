import { useQuery } from '@tanstack/react-query'

import { participantRoleOptions } from '@/features/expedientes/application/participant-groups'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export function useParticipantRoles(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'participant-roles', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client
        .from('crm_lead_roles')
        .select('name,archived')
        .eq('firm_id', firmId)
        .order('name')
      if (error) throw error
      return participantRoleOptions(data ?? [])
    },
  })
}
