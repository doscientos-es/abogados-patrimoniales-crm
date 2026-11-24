import { useQuery } from '@tanstack/react-query'

import type { ContactAppointmentOrigins } from '@/features/crm/application/contact-appointment-history'
import { leerTodasLasPaginas } from '@/features/tareas/application/task-scopes'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export function useContactAppointmentOrigins(firmId: string, contactId: string) {
  return useQuery({
    queryKey: ['crm', 'contact-appointment-origins', firmId, contactId],
    enabled: Boolean(firmId && contactId),
    queryFn: async (): Promise<ContactAppointmentOrigins> => {
      const client = getSupabaseBrowserClient()
      if (!client) throw new Error('No hay un despacho activo.')
      const [leads, cases] = await Promise.all([
        leerTodasLasPaginas(async (from, to) =>
          client
            .from('crm_opportunities')
            .select('id,reference')
            .eq('firm_id', firmId)
            .eq('contact_id', contactId)
            .order('id')
            .range(from, to),
        ),
        leerTodasLasPaginas(async (from, to) =>
          client
            .from('crm_cases')
            .select('id,reference')
            .eq('firm_id', firmId)
            .eq('primary_contact_id', contactId)
            .order('id')
            .range(from, to),
        ),
      ])
      return { leads, cases }
    },
  })
}
