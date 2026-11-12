import { useQuery } from '@tanstack/react-query'

import { DEFAULT_LEAD_ROLES } from '@/features/crm/application/lead-roles'
import { participantRoleOptions } from '@/features/expedientes/application/participant-groups'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export function useParticipantRoles(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'participant-roles', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.from('crm_lead_roles').select('name,archived').eq('firm_id', firmId).order('name')
      if (error) throw error
      const rows = data ?? []
      return participantRoleOptions(rows.length ? rows : DEFAULT_LEAD_ROLES.map((name) => ({ name, archived: false })))
    },
  })
}