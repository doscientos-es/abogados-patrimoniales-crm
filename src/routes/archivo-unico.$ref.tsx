import { createFileRoute, Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  ORIGINAL_STATUS_LABEL,
  parseAuReference,
  type OriginalStatus,
} from '@/features/documentos/physical-originals'
import { useOriginalByReference } from '@/features/documentos/physical-originals-data'
import { printAuLabel } from '@/features/documentos/ui/au-label'
import { abrirJustificante } from '@/features/expedientes/infrastructure/case-economic-documents'

export const Route = createFileRoute('/archivo-unico/$ref')({
  head: () => ({
    meta: [
      { title: 'Archivo único — LEX' },
      { name: 'description', content: 'Ficha de un original físico del Archivo único.' },
      { name: 'robots', content: 'noindex, nofollow, noarchive' },
    ],
  }),
  component: AuRecordPage,
})

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' })
const label = (status: string | null) =>
  status ? (ORIGINAL_STATUS_LABEL[status as OriginalStatus] ?? status) : '—'
const EVENT_LABEL: Record<string, string> = {
  reserved: 'Número reservado',
  document_linked: 'Escaneo vinculado',
  status_changed: 'Cambio de estado',
}

function AuRecordPage() {
  const { ref } = Route.useParams()
  const reference = parseAuReference(ref)
  const query = useOriginalByReference(reference)

  if (!reference) return <p className="p-6">Referencia no válida.</p>
  if (query.isPending) return <p className="text-muted-foreground p-6">Cargando…</p>
  if (!query.data?.available)
    return <p className="p-6">No se pudo leer el Archivo único. Inténtalo de nuevo más tarde.</p>
  if (!query.data.original)
    return <p className="p-6">No existe {reference} o no tienes acceso a su expediente.</p>
  const { original, events, caseRow, document } = query.data

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-6">
      <header>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Abogados Patrimoniales · Archivo único
        </p>
        <h1 className="font-mono text-3xl font-bold">{original.reference}</h1>
        <p className="mt-1">{original.description}</p>
      </header>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Estado</dt>
        <dd className="font-medium">{label(original.status)}</dd>
        <dt className="text-muted-foreground">Expediente</dt>
        <dd>
          {caseRow ? (
            <Link to="/expedientes/$id" params={{ id: caseRow.id }} className="underline">
              {caseRow.reference} · {caseRow.title}
            </Link>
          ) : (
            '—'
          )}
        </dd>
        <dt className="text-muted-foreground">Ubicación</dt>
        <dd>{original.storage_note ?? '—'}</dd>
        <dt className="text-muted-foreground">Escaneo</dt>
        <dd>
          {document ? (
            <button
              type="button"
              className="underline"
              onClick={() =>
                void abrirJustificante({
                  documentId: document.id,
                  nombre: document.original_name,
                  storagePath: document.storage_path,
                })
              }
            >
              {document.original_name}
            </button>
          ) : (
            'Pendiente de adjuntar'
          )}
        </dd>
        <dt className="text-muted-foreground">Reservado</dt>
        <dd>{dateTime.format(new Date(original.created_at))}</dd>
      </dl>
      <Button variant="outline" size="sm" onClick={() => void printAuLabel(original.reference)}>
        Imprimir etiqueta
      </Button>
      <section>
        <h2 className="mb-2 font-serif font-semibold">Historial</h2>
        <ol className="space-y-1 text-sm">
          {events.map((event) => (
            <li key={event.id}>
              <span className="text-muted-foreground">
                {dateTime.format(new Date(event.created_at))}
              </span>{' '}
              · {EVENT_LABEL[event.event_type] ?? event.event_type}
              {event.event_type === 'status_changed'
                ? ` (${label(event.previous_status)} → ${label(event.status)})`
                : ''}
              {event.note ? ` — ${event.note}` : ''}
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
