import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export type DraftNoteInput = {
  title: string
  content: string
  highlighted: boolean
  critical: boolean
}

export function DraftNote({
  onAdd,
  onError,
  disabled = false,
}: {
  onAdd: (note: DraftNoteInput) => void | Promise<unknown>
  onError?: (error: unknown) => void
  disabled?: boolean
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [highlighted, setHighlighted] = useState(false)
  const [critical, setCritical] = useState(false)
  const [saving, setSaving] = useState(false)

  const addNote = async () => {
    if (!content.trim() || disabled || saving) return
    setSaving(true)
    try {
      await onAdd({ title: title.trim(), content: content.trim(), highlighted, critical })
      setTitle('')
      setContent('')
      setHighlighted(false)
      setCritical(false)
    } catch (error) {
      onError?.(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full max-w-xs rotate-1 rounded-sm border border-amber-300 bg-amber-100 p-4 text-amber-950 shadow-md">
      <Input
        aria-label="Título de nota interna"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Título de la nota (opcional)"
        disabled={disabled || saving}
        className="mb-2 h-8 border-0 border-b border-amber-300/70 bg-transparent px-0 font-serif text-base font-semibold text-amber-950 shadow-none placeholder:text-amber-950/60 focus-visible:ring-0"
      />
      <Textarea
        aria-label="Contenido de nota interna"
        rows={5}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Escribe aquí la anotación…"
        disabled={disabled || saving}
        className="resize-none border-0 bg-transparent px-0 text-sm text-amber-950 shadow-none placeholder:text-amber-950/60 focus-visible:ring-0"
      />
      <label className="mt-2 flex items-center gap-2 text-xs text-amber-950/80">
        <input
          type="checkbox"
          className="accent-amber-700"
          checked={highlighted}
          onChange={(event) => setHighlighted(event.target.checked)}
          disabled={disabled || saving}
        />
        Destacada
      </label>
      <label className="mt-1 flex items-center gap-2 text-xs text-amber-950/80">
        <input
          type="checkbox"
          className="accent-amber-700"
          checked={critical}
          onChange={(event) => setCritical(event.target.checked)}
          disabled={disabled || saving}
        />
        Advertencia crítica
      </label>
      <Button
        size="sm"
        type="button"
        className="mt-3 w-full"
        disabled={!content.trim() || disabled || saving}
        onClick={() => void addNote()}
      >
        {saving ? 'Guardando…' : 'Añadir nota'}
      </Button>
    </div>
  )
}