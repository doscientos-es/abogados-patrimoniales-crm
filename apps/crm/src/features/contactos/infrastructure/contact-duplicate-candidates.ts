import { useQuery } from '@tanstack/react-query'

import type { DuplicateContactCandidate } from '@/features/contactos/application/contact-duplicates'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

const PAGE_SIZE = 500

export function useContactDuplicateCandidates(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'contact-duplicate-candidates', firmId],
    enabled: Boolean(firmId),
    refetchOnMount: 'always',
    queryFn: async (): Promise<DuplicateContactCandidate[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No se pudieron comprobar los contactos existentes.')

      const contacts: DuplicateContactCandidate[] = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await client
          .from('crm_contacts')
          .select('id, display_name, tax_id, email, phone, details')
          .eq('firm_id', firmId)
          .order('id')
          .range(offset, offset + PAGE_SIZE - 1)
        if (error) throw error

        for (const row of data) {
          const details =
            row.details && typeof row.details === 'object' && !Array.isArray(row.details)
              ? row.details
              : {}
          contacts.push({
            id: row.id,
            name: row.display_name,
            taxId: row.tax_id,
            email: row.email,
            alternateEmail: typeof details['email2'] === 'string' ? details['email2'] : null,
            phone: row.phone,
            alternatePhone: typeof details['telefono2'] === 'string' ? details['telefono2'] : null,
          })
        }

        if (data.length < PAGE_SIZE) return contacts
      }
    },
  })
}
