import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, MessageSquareText } from 'lucide-react'

import { PendingPanel, SectionHeader } from '@/components/common'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useNotasRemotas } from '@/features/notas'

export const Route = createFileRoute('/comunicaciones')({
  head: () => ({
    meta: [
      { title: 'Comunicaciones — LEX' },
      { name: 'description', content: 'Seguimiento persistente de comunicaciones del despacho.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: ComunicacionesPage,
})

function ComunicacionesPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const notes = useNotasRemotas(membership.data?.firmId)

  if (session.status === 'loading' || membership.isPending || notes.isPending)
    return <PendingPanel title="Cargando comunicaciones" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !membership.data)
    return (
      <PendingPanel
        title="Comunicaciones no disponibles"
        description="Necesitas una membresía activa."
      />
    )
  if (notes.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar las comunicaciones"
        description="Reintenta en unos instantes."
      />
    )

  const activity = (notes.data ?? []).filter(
    (note) => note.scope === 'opportunity' || note.scope === 'case' || note.scope === 'person',
  )

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <SectionHeader
        title="Comunicaciones"
        subtitle="Registro de seguimiento vinculado al Lead, onboarding y expediente."
      />
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <p className="font-medium">Registrar una comunicación</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Las llamadas, reuniones y borradores de email se registran desde la ficha del Lead o
              del Onboarding para conservar el contexto.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/oportunidades"
              search={{ vista: 'todas', abrir: '' }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Ir a Leads <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/onboarding" className={buttonVariants({ size: 'sm' })}>
              Ir a Onboarding
            </Link>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" /> Seguimiento reciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activity.slice(0, 30).map((note) => (
            <article key={note.id} className="rounded-md border p-3">
              <p className="text-sm font-medium">{note.title || 'Seguimiento sin título'}</p>
              <p className="text-muted-foreground mt-1 text-xs">{note.origin_label}</p>
              <p className="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
            </article>
          ))}
          {!activity.length ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Todavía no hay comunicaciones registradas.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
