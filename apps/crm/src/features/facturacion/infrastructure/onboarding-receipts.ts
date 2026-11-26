import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export function useOnboardingReceipts(firmId: string | undefined) {
  return useQuery({
    queryKey: ['onboarding-receipts', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client.from('crm_onboarding_receipts').select('*').eq('firm_id', firmId)
      if (error) throw error
      return data
    },
  })
}

export function useApplyOnboardingReceipt(firmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { receiptId: string; invoiceId: string; paymentId: string | null }) => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) throw new Error('No hay un despacho activo.')
      const { error } = await client.rpc('crm_apply_onboarding_receipt', {
        target_receipt_id: input.receiptId,
        target_invoice_id: input.invoiceId,
        existing_payment_id: input.paymentId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding-receipts', firmId] })
      void queryClient.invalidateQueries({ queryKey: ['crm', 'facturas', firmId] })
      void queryClient.invalidateQueries({ queryKey: ['onboarding-events', firmId] })
    },
  })
}