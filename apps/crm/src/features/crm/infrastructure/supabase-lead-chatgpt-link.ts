import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { normalizeChatgptLink } from '@/features/crm/application/lead-chatgpt-link'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

export type LeadChatgptScope = { firmId: string; leadId: string; userId: string }

const linkKey = ({ firmId, leadId, userId }: LeadChatgptScope) =>
  ['crm', 'lead-chatgpt-link', firmId, leadId, userId] as const

function requireClient() {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('No se pudo conectar con el despacho.')
  return client
}

export function useLeadChatgptLink(scope: LeadChatgptScope) {
  return useQuery({
    queryKey: linkKey(scope),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await requireClient()
        .from('crm_lead_chatgpt_links')
        .select('conversation_url')
        .eq('opportunity_id', scope.leadId)
        .eq('user_id', scope.userId)
        .maybeSingle()
      if (error) throw new Error('No se pudo cargar tu enlace de ChatGPT. Vuelve a intentarlo.')
      return data ? normalizeChatgptLink(data.conversation_url) : null
    },
  })
}

export function useSaveLeadChatgptLink(scope: LeadChatgptScope) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: async (input: string | null): Promise<string | null> => {
      const client = requireClient()
      const url = input === null ? null : normalizeChatgptLink(input)
      if (url === null) {
        const { error } = await client
          .from('crm_lead_chatgpt_links')
          .delete()
          .eq('opportunity_id', scope.leadId)
          .eq('user_id', scope.userId)
        if (error) throw new Error('No se pudo desvincular tu chat. Vuelve a intentarlo.')
      } else {
        const { data, error } = await client
          .from('crm_lead_chatgpt_links')
          .upsert(
            { opportunity_id: scope.leadId, user_id: scope.userId, conversation_url: url },
            { onConflict: 'opportunity_id,user_id' },
          )
          .select('conversation_url')
          .single()
        if (error || !data) throw new Error('No se pudo guardar tu enlace. Vuelve a intentarlo.')
        return normalizeChatgptLink(data.conversation_url)
      }
      return null
    },
    onSuccess: (url) => {
      cache.setQueryData(linkKey(scope), url)
      void cache.invalidateQueries({ queryKey: linkKey(scope), exact: true })
    },
  })
}
