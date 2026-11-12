import { Pin, StickyNote } from 'lucide-react'

import type { NotaInterna } from '@/features/notas/application/note-types'

const scopeLabels: Record<NotaInterna['ambito'], string> = {
  persona: 'Contacto',
  expediente: 'Expediente',
  oportunidad: 'Lead',
  ejecucion: 'Ejecución',
  presupuesto: 'Presupuesto',
}

export function InternalNoteSticker({ note }: { note: NotaInterna }) {
  return (
    <article
      className={`nota-sticker nota-tono-${note.ambito} flex min-h-40 w-full flex-col rounded-sm border p-4 shadow-md ${note.critica ? 'nota-sticker-critica ring-destructive/70 ring-2' : note.destacada ? 'nota-sticker-destacada' : ''}`}
      aria-label={`${scopeLabels[note.ambito]}${note.titulo ? `: ${note.titulo}` : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <StickyNote className="size-4" aria-hidden="true" />
          {scopeLabels[note.ambito]}
        </span>
        {note.destacada ? <Pin className="size-4 shrink-0" aria-label="Destacada" /> : null}
      </header>
      <h3 className="mt-2 text-base leading-snug font-semibold">{note.titulo || 'Nota interna'}</h3>
      <p className="mt-2 flex-1 text-base leading-relaxed whitespace-pre-wrap">{note.contenido}</p>
      <p className="mt-3 text-sm opacity-70">{note.autor} · {note.creada}</p>
    </article>
  )
}