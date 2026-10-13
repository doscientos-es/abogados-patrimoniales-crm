import { AlertTriangle, Star } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useGuardarNota, useNotasRemotas } from '@/features/notas'

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
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [highlighted, setHighlighted] = useState(false)
  const [critical, setCritical] = useState(false)
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await save.mutateAsync({
        scope: 'opportunity',
        originId: opportunityId,
        originLabel: label,
        opportunityId,
        title,
        content,
        contactIds: contactId ? [contactId] : [],
        highlighted,
        critical,
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
      setTitle('')
      setContent('')
      setHighlighted(false)
      setCritical(false)
      toast.success('Nota interna del presupuesto guardada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la nota.')
    }
  }

  return (
    <Card data-testid="quote-internal-notes">
      <CardHeader>
        <CardTitle className="text-base">Notas internas del presupuesto</CardTitle>
        <p className="text-muted-foreground text-sm">
          Contexto privado para el equipo. No forma parte del presupuesto, de las comunicaciones con
          el cliente ni del portal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {linked.map((note) => (
          <article
            key={note.id}
            className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"
          >
            <div className="flex items-center gap-2 font-medium">
              {note.title || 'Nota interna'}
              {note.highlighted ? <Star className="size-4" aria-label="Destacada" /> : null}
              {note.critical ? (
                <AlertTriangle className="text-destructive size-4" aria-label="Crítica" />
              ) : null}
            </div>
            <p className="whitespace-pre-wrap">{note.content}</p>
            <p className="text-muted-foreground text-xs">
              {note.created_by ? (note.actorNames[note.created_by] ?? note.created_by) : 'Sistema'} ·{' '}
              {new Date(note.created_at).toLocaleString('es-ES', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </article>
        ))}
        {!linked.length && !notes.isPending ? (
          <p className="text-muted-foreground text-sm">
            Aún no hay notas internas específicas para el presupuesto.
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1">
            <Label htmlFor="quote-note-title">Título (opcional)</Label>
            <Input
              id="quote-note-title"
              value={title}
              maxLength={300}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="quote-note-content">Nota privada</Label>
            <Textarea
              id="quote-note-content"
              value={content}
              maxLength={20_000}
              required
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={highlighted}
                onChange={(event) => setHighlighted(event.target.checked)}
              />{' '}
              Destacar
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={critical}
                onChange={(event) => setCritical(event.target.checked)}
              />{' '}
              Crítica
            </label>
          </div>
          <Button type="submit" size="sm" disabled={save.isPending || !content.trim()}>
            {save.isPending ? 'Guardando…' : 'Guardar nota privada'}
          </Button>
        </form>
        <Link to="/notas" className="text-primary text-xs hover:underline">
          Ver todas las notas
        </Link>
      </CardContent>
    </Card>
  )
}
