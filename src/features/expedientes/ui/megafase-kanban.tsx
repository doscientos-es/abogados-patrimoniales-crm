// Kanban de Control de expedientes: columnas operativas agrupadas bajo
// bandas superiores de megafase (F3–F6) y zona separada para situaciones
// especiales (Suspendido / Aparcado).
import { useState, type ReactNode } from 'react'

import {
  bandasDe,
  columnasEspeciales,
  faseVigente,
  megafase,
  type ColumnaKanban,
  type Naturaleza,
} from '@/data/expedientes-model'
import { ToneBadge } from '@/features/crm'
import { cn } from '@/lib/utils'
import * as Kanban from '@/shared/ui/kanban'

export function MegafaseBadge({
  naturaleza,
  fase,
  megafaseId,
}: {
  naturaleza?: Naturaleza
  fase?: string
  megafaseId?: Parameters<typeof megafase>[0]
}) {
  const id =
    megafaseId ??
    (naturaleza && fase
      ? (bandasDe(naturaleza).find((b) =>
          b.columnas.some((c) => c.id === faseVigente(naturaleza, fase)),
        )?.megafase ?? 'especial')
      : 'especial')
  const m = megafase(id)
  return (
    <span
      className={cn(
        'mf-banda inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        m.clase,
      )}
    >
      <span className={cn('mf-punto h-1.5 w-1.5 rounded-full')} />
      {m.codigo === '—' ? m.nombre : `${m.codigo} · ${m.nombre}`}
    </span>
  )
}

function Columna<T>({
  columna,
  clase,
  items,
  idOf,
  renderCard,
  onDrop,
  vacio,
}: {
  columna: ColumnaKanban
  clase: string
  items: T[]
  idOf: (item: T) => string
  renderCard: (item: T) => ReactNode
  onDrop: (id: string, columna: string) => void
  vacio: string
}) {
  const [sobre, setSobre] = useState(false)
  return (
    <Kanban.Column
      onDragOver={(e) => {
        e.preventDefault()
        setSobre(true)
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault()
        setSobre(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDrop(id, columna.id)
      }}
      className={cn(
        'mf-columna bg-muted/70 transition-colors',
        clase,
        sobre && 'bg-primary/10 ring-1 ring-primary/40',
      )}
    >
      <Kanban.Header>
        <Kanban.Title>{columna.nombre}</Kanban.Title>
        <ToneBadge tono={columna.tono}>{items.length}</ToneBadge>
      </Kanban.Header>
      <Kanban.Body>
        {items.length ? (
          items.map((i) => (
            <div
              key={idOf(i)}
              draggable
              className="cursor-grab transition-shadow active:cursor-grabbing active:shadow-lg"
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', idOf(i))
                e.dataTransfer.effectAllowed = 'move'
              }}
            >
              {renderCard(i)}
            </div>
          ))
        ) : (
          <Kanban.Empty>{vacio}</Kanban.Empty>
        )}
      </Kanban.Body>
    </Kanban.Column>
  )
}

export function MegafaseKanban<T>({
  naturaleza,
  items,
  faseOf,
  idOf,
  onDrop,
  renderCard,
  vacio = 'Sin expedientes en esta fase. Arrastra una tarjeta aquí.',
}: {
  naturaleza: Naturaleza
  items: T[]
  faseOf: (item: T) => string
  idOf: (item: T) => string
  onDrop: (id: string, columna: string) => void
  renderCard: (item: T) => ReactNode
  vacio?: string
}) {
  const bandas = bandasDe(naturaleza)
  const especiales = columnasEspeciales(naturaleza)
  const de = (columna: ColumnaKanban) =>
    items.filter((i) => faseVigente(naturaleza, faseOf(i)) === columna.id)

  return (
    <Kanban.Viewport className="gap-4">
      {bandas.map((b) => {
        const m = megafase(b.megafase)
        return (
          <div key={b.megafase} className="shrink-0">
            <div
              className={cn(
                'mf-banda mb-2 flex items-center justify-between gap-3 rounded-md border px-3 py-1.5',
                m.clase,
              )}
            >
              <span className="text-[11px] font-semibold tracking-wider uppercase">
                {m.codigo} · {m.nombre}
              </span>
              <span className="hidden text-[10px] opacity-80 lg:inline">{m.descripcion}</span>
            </div>
            <div className="flex gap-3">
              {b.columnas.map((c) => (
                <Columna
                  key={c.id}
                  columna={c}
                  clase={m.clase}
                  items={de(c)}
                  idOf={idOf}
                  renderCard={renderCard}
                  onDrop={onDrop}
                  vacio={vacio}
                />
              ))}
            </div>
          </div>
        )
      })}

      {especiales.length ? (
        <div className="border-border shrink-0 border-l border-dashed pl-4">
          <div
            className={cn(
              'mf-banda mb-2 flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-1.5',
              megafase('especial').clase,
            )}
          >
            <span className="text-[11px] font-semibold tracking-wider uppercase">
              Situación especial
            </span>
          </div>
          <div className="flex gap-3">
            {especiales.map((c) => (
              <Columna
                key={c.id}
                columna={c}
                clase={megafase('especial').clase}
                items={de(c)}
                idOf={idOf}
                renderCard={renderCard}
                onDrop={onDrop}
                vacio="Sin expedientes suspendidos."
              />
            ))}
          </div>
        </div>
      ) : null}
    </Kanban.Viewport>
  )
}
