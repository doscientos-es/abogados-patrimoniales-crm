import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getSupabaseBrowserClient,
  type ContactBankAccountRow,
  type Json,
} from '@/shared/infrastructure/supabase'

export type ContactBankAccountInput = {
  holder: string
  tax_id: string
  iban: string
  bank_name: string
  bic: string
  sepa_mandate: boolean
  sepa_signed_on: string | null
  mandate_status: ContactBankAccountRow['mandate_status']
  observations: string
}

export function useContactBankAccounts(
  firmId: string | undefined,
  contactId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['crm', 'contact-bank-accounts', firmId, contactId],
    enabled: Boolean(firmId && contactId && enabled),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_contact_bank_accounts')
        .select('*')
        .eq('firm_id', firmId)
        .eq('contact_id', contactId)
        .order('valid_from', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useReplaceContactBankAccount(firmId: string | undefined, contactId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (bankData: ContactBankAccountInput) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { data, error } = await client.rpc('crm_replace_contact_bank_account', {
        target_firm_id: firmId,
        target_contact_id: contactId,
        bank_data: bankData as unknown as Json,
      })
      if (error) throw error
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['crm', 'contact-bank-accounts', firmId, contactId],
      }),
  })
}
