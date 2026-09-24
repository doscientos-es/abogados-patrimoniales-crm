import { Badge } from '@/components/ui/badge'
import type { Json } from '@/shared/infrastructure/supabase'

type LeadCommunicationEvent = {
  id: string
  tipo: string
  datos: Json
  creadoEn: string
  autorId: string | null
}

const COMMUNICATION_TYPES = {
  email_draft: 'Borrador de email',
  phone_call: 'Llamada',
  meeting: 'Reunión',
} as const

export function LeadCommunicationsTimeline({
  events,
  loading,
  error,
  memberNames,
}: {
  events: LeadCommunicationEvent[]
  loading: boolean
  error: boolean
  memberNames: ReadonlyMap<string, string>
}) {
  const communications = events.flatMap((event) => {
    if (event.tipo !== 'communication_logged') return []
    const content = communicationContent(event.datos)
    return content ? [{ event, ...content }] : []
  })

  return (
    <section aria-labelledby="lead-communications-history-heading" className="space-y-3">
      <div className="border-border border-t pt-4">
        <h3 id="lead-communications-history-heading" className="text-sm font-medium">
          Seguimiento registrado
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Registro interno del Lead. Desde aquí no se envían emails ni mensajes.
        </p>
      </div>
      {loading ? (
        <p className="text-muted-foreground py-6 text-center text-sm">Cargando comunicaciones…</p>
      ) : error ? (
        <p role="alert" className="text-destructive py-6 text-center text-sm">
          No se pudo cargar el seguimiento. Inténtalo de nuevo.
        </p>
      ) : communications.length ? (
        <ol aria-label="Comunicaciones registradas" className="divide-y rounded-xl border">
          {communications.map(({ event, label, summary }) => (
            <li key={event.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline">{label}</Badge>
                <time dateTime={event.creadoEn} className="text-muted-foreground text-xs">
                  {formatEventDate(event.creadoEn)}
                </time>
              </div>
              <p className="text-sm whitespace-pre-wrap">{summary}</p>
              <p className="text-muted-foreground text-xs">
                {event.autorId
                  ? (memberNames.get(event.autorId) ?? 'Usuario del despacho')
                  : 'Sistema'}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground border-border border-y border-dashed py-8 text-center text-sm">
          Todavía no hay comunicaciones registradas en este Lead.
        </p>
      )}
    </section>
  )
}

function communicationContent(value: Json) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const type = value['type']
  const summary = value['summary']
  if (
    (type !== 'email_draft' && type !== 'phone_call' && type !== 'meeting') ||
    typeof summary !== 'string' ||
    !summary.trim()
  ) {
    return null
  }
  return { label: COMMUNICATION_TYPES[type], summary }
}

function formatEventDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
