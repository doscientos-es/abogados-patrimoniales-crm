import { useQuery } from '@tanstack/react-query'

import { getSupabaseBrowserClient, type NoteRow } from '@/shared/infrastructure/supabase'

export type NotaRemota = NoteRow & {
  contactIds: string[]
  permittedUserIds: string[]
  acknowledgedUserIds: string[]
}

/** Notes are always scoped by firm before ordering for the activity wall. */
export function useNotasRemotas(firmId: string | undefined) {
  return useQuery({
    queryKey: ['crm', 'notes', firmId],
    enabled: Boolean(firmId),
    queryFn: async (): Promise<NotaRemota[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []

      const { data, error } = await client
        .from('crm_notes')
        .select('*')
        .eq('firm_id', firmId)
        .order('highlighted', { ascending: false })
        .order('critical', { ascending: false })
        .order('updated_at', { ascending: false })

      if (error) throw error
      if (!data.length) return []
      const noteIds = data.map((note) => note.id)
      const [contacts, permissions, acknowledgements] = await Promise.all([
        client
          .from('crm_note_contacts')
          .select('note_id, contact_id')
          .eq('firm_id', firmId)
          .in('note_id', noteIds),
        client
          .from('crm_note_permissions')
          .select('note_id, user_id')
          .eq('firm_id', firmId)
          .in('note_id', noteIds),
        client.from('crm_note_acknowledgements').select('note_id, user_id').in('note_id', noteIds),
      ])
      if (contacts.error) throw contacts.error
      if (permissions.error) throw permissions.error
      if (acknowledgements.error) throw acknowledgements.error
      return data.map((note) => ({
        ...note,
        contactIds: contacts.data
          .filter((item) => item.note_id === note.id)
          .map((item) => item.contact_id),
        permittedUserIds: permissions.data
          .filter((item) => item.note_id === note.id)
          .map((item) => item.user_id),
        acknowledgedUserIds: acknowledgements.data
          .filter((item) => item.note_id === note.id)
          .map((item) => item.user_id),
      }))
    },
  })
}
