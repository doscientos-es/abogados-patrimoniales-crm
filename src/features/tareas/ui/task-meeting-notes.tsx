import { Link } from '@tanstack/react-router'
import { AlertTriangle, Star } from 'lucide-react'
import { toast } from 'sonner'

import { useGuardarNota, useNotasRemotas } from '@/features/notas'
import type { TareaPersistida } from '@/features/tareas'
import { DraftNote } from '@/shared/ui/internal-note-draft'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

/** Notas internas de la reunión: usan el sistema general de notas y quedan vinculadas a la tarea. */
export function MeetingInternalNotes({
  firmId,
  task,
  caseLabel,
  contactIds,
  canWork,
}: {
  firmId: string | undefined
  task: TareaPersistida
  caseLabel?: string | undefined
  contactIds: string[]
  canWork: boolean
}) {
  const notes = useNotasRemotas(firmId)
  const save = useGuardarNota(firmId)
  const linked = (notes.data ?? [])
    .filter((note) => {
      const details = note.details
      return (
        details &&
        typeof details === 'object' &&
        !Array.isArray(details) &&
        details['taskId'] === task.id
      )
    })
    .sort((a, b) => Number(b.highlighted) - Number(a.highlighted))

  const addNote = async (note: {
    title: string
    content: string
    highlighted: boolean
    critical: boolean
  }) => {
    const primaryContact = contactIds[0]
    if (!task.expedienteId && !primaryContact) {
      toast.error('Vincula la reunión a un expediente o añade un contacto asistente.')
      return
    }
    try {
      await save.mutateAsync({
        scope: task.expedienteId ? 'case' : 'person',
        originId: task.expedienteId ?? primaryContact ?? '',
        originLabel: task.expedienteId ? (caseLabel ?? task.titulo) : task.titulo,
        title: note.title,
        content: note.content,
        contactIds: task.expedienteId ? [] : contactIds.slice(0, 1),
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
        caseId: task.expedienteId ?? null,
        extraDetails: { taskId: task.id },
      })
      toast.success('Nota interna añadida.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la nota.')
    }
  }

  return (
    <section className="space-y-3" data-testid="meeting-internal-notes">
      <header>
        <h3 className="text-sm font-bold tracking-wide uppercase">Notas internas</h3>
        <p className="text-muted-foreground text-sm">
          Contexto privado para el equipo. Nunca forma parte de las comunicaciones con el cliente
          ni del portal.
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
              {note.created_by ? (note.actorNames[note.created_by] ?? '') : 'Sistema'} ·{' '}
              {formatDate(note.created_at)}
            </p>
          </article>
        ))}
        {canWork ? <DraftNote onAdd={(note) => void addNote(note)} /> : null}
        {!canWork && !linked.length ? (
          <p className="text-muted-foreground text-sm">Sin notas internas en esta reunión.</p>
        ) : null}
      </div>
      <Link to="/notas" className="text-primary text-xs hover:underline">
        Ver todas las notas
      </Link>
    </section>
  )
}
