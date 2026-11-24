import { Check, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Lista de textos breves: no descarta el borrador si falla el guardado. */
export function ShortTextList({
  label,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  disabled = false,
  placeholder = 'Escribe una nota breve…',
}: {
  label: string
  items: string[]
  draft: string
  onDraftChange: (value: string) => void
  onAdd: (value: string) => boolean | Promise<boolean>
  onRemove: (index: number) => void | Promise<void>
  disabled?: boolean
  placeholder?: string
}) {
  const [busy, setBusy] = useState(false)
  const add = async () => {
    const value = draft.trim()
    if (!value || busy || disabled) return
    setBusy(true)
    try {
      if (await onAdd(value)) onDraftChange('')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (index: number) => {
    if (busy || disabled) return
    setBusy(true)
    try {
      await onRemove(index)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-3">
      {items.length ? (
        <ol className="space-y-2" aria-label={label}>
          {items.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="bg-background flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 break-words whitespace-pre-wrap">{item}</span>
              {!disabled ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive text-xs"
                  disabled={busy}
                  aria-label={`Quitar nota ${index + 1}`}
                  onClick={() => void remove(index)}
                >
                  Quitar
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {!disabled ? (
        <div className="flex gap-2">
          <Input
            aria-label={`Añadir ${label.toLocaleLowerCase('es')}`}
            value={draft}
            maxLength={500}
            placeholder={placeholder}
            disabled={busy}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void add()
              }
            }}
          />
          <Button type="button" disabled={busy || !draft.trim()} onClick={() => void add()}>
            <Plus className="size-4" aria-hidden="true" /> Añadir
          </Button>
        </div>
      ) : null}
    </div>
  )
}
