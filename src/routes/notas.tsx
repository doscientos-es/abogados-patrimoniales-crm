import { createFileRoute } from '@tanstack/react-router'

import { PendingPanel, SectionHeader, StatTile } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useNotasRemotas } from '@/features/notas'

export const Route = createFileRoute('/notas')({
  head: () => ({
    meta: [
      { title: 'Notas internas — LEX' },
      { name: 'description', content: 'Notas internas persistentes del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: NotesPage,
})

function NotesPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const notes = useNotasRemotas(firmId)

  if (session.status === 'loading' || membership.isPending || notes.isPending)
    return <PendingPanel title="Cargando notas" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Notas no disponibles"
        description="Necesitas una sesión y una membresía activa."
      />
    )
  if (notes.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar las notas"
        description="Reintenta en unos instantes."
      />
    )

  const list = notes.data ?? []
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <SectionHeader
        title="Notas internas"
        subtitle="Información persistente visible según los permisos del despacho."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Activas" value={list.filter((note) => note.status === 'active').length} />
        <StatTile
          label="Destacadas"
          value={list.filter((note) => note.status === 'active' && note.highlighted).length}
          tono="info"
        />
        <StatTile
          label="Críticas"
          value={list.filter((note) => note.status === 'active' && note.critical).length}
          tono="riesgo"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Muro de notas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((note) => (
            <article key={note.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{note.title || 'Nota interna'}</p>
                  <p className="text-muted-foreground text-xs">{note.origin_label}</p>
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline">{statusLabel(note.status)}</Badge>
                  {note.highlighted ? <Badge>Destacada</Badge> : null}
                  {note.critical ? <Badge variant="destructive">Crítica</Badge> : null}
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap">{note.content}</p>
              <p className="text-muted-foreground mt-3 text-xs">
                Actualizada {new Date(note.updated_at).toLocaleString('es-ES')}
              </p>
            </article>
          ))}
          {!list.length ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No hay notas persistentes visibles.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}

function statusLabel(status: string) {
  return status === 'active' ? 'Activa' : status === 'resolved' ? 'Resuelta' : 'Archivada'
}
