import { Link } from '@tanstack/react-router'
import { AlertTriangle, Star } from 'lucide-react'
import { toast } from 'sonner'

import { useGuardarNota, useNotasRemotas } from '@/features/notas'
import { DraftNote } from '@/shared/ui/internal-note-draft'

/**
 * Internal notes of the budget: general notes system, linked to the Lead and marked as
 * «presupuesto». They never form part of the document or the client portal.
 */
export function QuoteInternalNotes({
  firmId,
  opportunityId,
  label,
  contactId,
}: {
  firmId: string
  opportunityId: string
  label: string
  contactId: string
}) {
  const notes = useNotasRemotas(firmId)
  const save = useGuardarNota(firmId)
  const linked = (notes.data ?? []).filter((note) => {
    const details = note.details
    return (
      note.opportunity_id === opportunityId &&
      details &&
      typeof details === 'object' &&
      !Array.isArray(details) &&
      details['area'] === 'presupuesto'
    )
  })

  return (
    <section className="space-y-3" data-testid="quote-internal-notes">
      <header>
        <h3 className="text-sm font-bold tracking-wide uppercase">Notas internas</h3>
        <p className="text-muted-foreground text-sm">
          Contexto privado para el equipo. No forma parte del presupuesto, de las comunicaciones con
          el cliente ni del portal.
        </p>
      </header>
      <div className="flex flex-wrap items-start gap-4">
        {linked.map((note) => (
          <article
            key={note.id}
            className="w-full max-w-xs space-y-1.5 rounded-sm border border-amber-300 bg-amber-100 p-4 text-sm text-amber-950 shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif font-semibold">{note.title || 'Nota interna'}</p>
              <span className="flex gap-1">
                {note.highlighted ? <Star className="h-4 w-4" aria-label="Destacada" /> : null}
                {note.critical ? (
                  <AlertTriangle className="text-destructive h-4 w-4" aria-label="Crítica" />
                ) : null}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{note.content}</p>
            <p className="text-xs text-amber-950/70">
              {note.created_by ? (note.actorNames[note.created_by] ?? 'Equipo') : 'Sistema'} ·{' '}
              {new Date(note.created_at).toLocaleString('es-ES', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </article>
        ))}
        <DraftNote
          onAdd={(note) =>
            void save
              .mutateAsync({
                scope: 'opportunity',
                originId: opportunityId,
                originLabel: label,
                opportunityId,
                title: note.title,
                content: note.content,
                contactIds: contactId ? [contactId] : [],
                highlighted: note.highlighted,
                critical: note.critical,
                requiresAcknowledgement: false,
                validity: 'permanent',
                reviewOn: null,
                expiresOn: null,
                expiryAction: 'confirm',
                triggers: [],
                visibility: 'team',
                permittedUserIds: [],
                extraDetails: { area: 'presupuesto' },
              })
              .then(() => toast.success('Nota interna añadida.'))
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : 'No se pudo guardar la nota.'),
              )
          }
        />
      </div>
      <Link to="/notas" className="text-primary text-xs hover:underline">
        Ver todas las notas
      </Link>
    </section>
  )
}