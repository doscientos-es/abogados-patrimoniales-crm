import { AlertTriangle, Plus, Star, StickyNote } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useGuardarNota, useNotasRemotas } from '@/features/notas/infrastructure/supabase-notas'
import type { TareaPersistida } from '@/features/tareas'

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
  const [open, setOpen] = useState(false)
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (name: string) => {
      const value = data.get(name)
      return typeof value === 'string' ? value : ''
    }
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
        title: text('noteTitle'),
        content: text('noteContent'),
        contactIds: task.expedienteId ? [] : contactIds.slice(0, 1),
        highlighted: data.has('noteHighlighted'),
        critical: data.has('noteCritical'),
        requiresAcknowledgement: data.has('noteAcknowledge'),
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
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la nota.')
    }
  }

  return (
    <section className="space-y-3 border-t pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Notas · sistema general de LEX</h3>
        <Button type="button" size="sm" disabled={!canWork} onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Nueva nota interna
        </Button>
      </header>
      {linked.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {linked.map((note) => (
            <article key={note.id} className="bg-card space-y-1.5 rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{note.title || 'Nota interna'}</p>
                <span className="flex gap-1">
                  {note.highlighted ? (
                    <Star className="text-warning h-4 w-4" aria-label="Destacada" />
                  ) : null}
                  {note.critical ? (
                    <AlertTriangle className="text-destructive h-4 w-4" aria-label="Crítica" />
                  ) : null}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{note.content}</p>
              <p className="text-muted-foreground text-xs">
                {note.created_by ? (note.actorNames[note.created_by] ?? '') : 'Sistema'} ·{' '}
                {formatDate(note.created_at)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
          <StickyNote className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
          Sin notas internas vinculadas a esta reunión.
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Las notas internas nunca forman parte del portal del cliente.{' '}
        <Link to="/notas" className="text-primary hover:underline">
          Ver todas las notas
        </Link>
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva nota interna</DialogTitle>
            <DialogDescription>
              Se guarda en el sistema general de notas y queda vinculada a esta reunión.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void submit(event)}>
            <Label>
              Título
              <Input name="noteTitle" maxLength={160} />
            </Label>
            <Label>
              Contenido
              <Textarea name="noteContent" required rows={5} />
            </Label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="noteHighlighted" /> Destacada
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="noteCritical" /> Advertencia crítica
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="noteAcknowledge" /> Requiere confirmación de lectura
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Guardar nota
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
