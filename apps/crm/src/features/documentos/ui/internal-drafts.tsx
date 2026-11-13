import { useQuery } from '@tanstack/react-query'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { looseClient } from '@/features/documentos/loose-supabase'

type Draft = { id: string; title: string; content: string; created_at: string }

/** Text only: no generated HTML is interpreted and no draft is sent to a client. */
export function InternalDrafts({ firmId, targetId, targetType }: {
  firmId: string | undefined
  targetId: string
  targetType: 'case' | 'lead'
}) {
  const drafts = useQuery({
    queryKey: ['internal-document-drafts', firmId, targetType, targetId],
    enabled: Boolean(firmId && targetId),
    queryFn: async () => {
      const db = looseClient()
      if (!db) throw new Error('Sin conexión.')
      const { data, error } = await db.from('crm_internal_document_drafts')
        .select('id,title,content,created_at')
        .eq('firm_id', firmId)
        .eq(targetType === 'case' ? 'case_id' : 'opportunity_id', targetId)
        .order('created_at', { ascending: false })
      if (error) throw new Error('No se pudieron cargar los borradores.')
      return data as Draft[]
    },
  })
  if (!firmId) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Borradores para revisión interna</CardTitle>
        <p className="text-muted-foreground text-sm">Contenido generado pendiente de revisión; no se ha enviado al cliente.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.isPending ? <p className="text-muted-foreground text-sm">Cargando borradores…</p> : null}
        {drafts.isError ? <p role="alert" className="text-destructive text-sm">No se pudieron cargar los borradores.</p> : null}
        {drafts.data?.length === 0 ? <p className="text-muted-foreground text-sm">No hay borradores.</p> : null}
        {drafts.data?.map((draft) => (
          <details key={draft.id} className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">{draft.title}</summary>
            <p className="text-muted-foreground mt-2 text-xs">Pendiente de revisión · {new Date(draft.created_at).toLocaleDateString('es-ES')}</p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm">{draft.content}</p>
          </details>
        ))}
      </CardContent>
    </Card>
  )
}