import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { PersistentDocuments } from '@/components/documentos/persistent-documents'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { useMiembrosDespacho } from '@/features/crm'
import { CaseCreateDialog, useCrearExpediente } from '@/features/expedientes'
import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

type DocumentsSearch = { doc?: string; case?: string; folder?: string }

export const Route = createFileRoute('/documentos')({
  validateSearch: parseDocumentsSearch,
  head: () => ({
    meta: [
      { title: 'Documentos — LEX' },
      { name: 'description', content: 'Gestión documental persistente del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: PersistentDocumentsRoute,
})

function parseDocumentsSearch(search: Record<string, unknown>): DocumentsSearch {
  const read = (key: string) => {
    const value = search[key]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
  const doc = read('doc')
  const caseId = read('case')
  const folder = read('folder')
  return {
    ...(doc ? { doc } : {}),
    ...(caseId ? { case: caseId } : {}),
    ...(folder ? { folder } : {}),
  }
}

function PersistentDocumentsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const contacts = useContactos(firmId)
  const members = useMiembrosDespacho(firmId)
  const createCase = useCrearExpediente(firmId)
  const practiceAreas = useQuery({
    queryKey: ['crm', 'practice-areas', firmId],
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_practice_areas')
        .select('name')
        .eq('firm_id', firmId)
        .eq('archived', false)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return data.map((item) => item.name)
    },
  })

  const updateLocation = (location: { caseId: string | null; folderId: string | null }) => {
    void navigate({
      search: (previous) => ({
        ...(previous.doc ? { doc: previous.doc } : {}),
        ...(location.caseId ? { case: location.caseId } : {}),
        ...(location.folderId ? { folder: location.folderId } : {}),
      }),
    })
  }
  const canCreateCase =
    session.status === 'signed-in' &&
    Boolean(firmId) &&
    !contacts.isPending &&
    !contacts.isError &&
    !members.isPending &&
    !members.isError

  return (
    <PersistentDocuments
      location={{ caseId: search.case ?? null, folderId: search.folder ?? null }}
      onLocationChange={updateLocation}
      rootActions={
        canCreateCase ? (
          <CaseCreateDialog
            contactos={contacts.data ?? []}
            miembros={members.data ?? []}
            practiceAreas={practiceAreas.data ?? []}
            pending={createCase.isPending}
            onCreate={(input) => createCase.mutateAsync(input)}
            onCreated={(caseId) => updateLocation({ caseId, folderId: null })}
          />
        ) : null
      }
    />
  )
}
