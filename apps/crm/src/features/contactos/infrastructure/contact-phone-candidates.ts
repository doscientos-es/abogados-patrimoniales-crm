import { useQuery } from '@tanstack/react-query'

import type { ContactPhoneCandidate } from '@/features/contactos/application/contact-phone-duplicates'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

const PAGE_SIZE = 500

export function useContactPhoneCandidates(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'contact-phone-candidates', firmId],
    enabled: Boolean(firmId),
    refetchOnMount: 'always',
    queryFn: async (): Promise<ContactPhoneCandidate[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No se pudieron comprobar los teléfonos.')
      const contacts: ContactPhoneCandidate[] = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await client.from('crm_contacts')
          .select('id,display_name,phone,details')
          .eq('firm_id', firmId).order('id').range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error
        contacts.push(...data.map((row) => {
          const details = row.details && typeof row.details === 'object' && !Array.isArray(row.details)
            ? row.details : {}
          return {
            id: row.id, name: row.display_name, phone: row.phone,
            alternatePhone: typeof details['telefono2'] === 'string' ? details['telefono2'] : null,
          }
        }))
        if (data.length < PAGE_SIZE) return contacts
      }
    },
  })
}