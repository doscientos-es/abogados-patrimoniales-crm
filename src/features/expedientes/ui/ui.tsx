// Componentes compartidos del núcleo operativo: kanban con arrastre,
// distintivos de tipología documental y utilidades de presentación.
import { Clock, FileCheck2, Gavel, ShieldAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import type { ColumnaKanban } from '@/data/expedientes-model'
import { ToneBadge } from '@/features/crm/ui/ui'
import { cn } from '@/lib/utils'
import * as Kanban from '@/shared/ui/kanban'

export function DndKanban<T>({
  columns,
  items,
  columnOf,
  idOf,
  onDrop,
  renderCard,
  vacio = 'Sin elementos',
}: {
  columns: ColumnaKanban[]
  items: T[]
  columnOf: (item: T) => string
  idOf: (item: T) => string
  onDrop: (id: string, columna: string) => void
  renderCard: (item: T) => ReactNode
  vacio?: string
}) {
  const [sobre, setSobre] = useState<string | null>(null)

  return (
    <Kanban.Viewport>
      {columns.map((c) => {
        const lista = items.filter((i) => columnOf(i) === c.id)
        return (
          <Kanban.Column
            key={c.id}
            onDragOver={(e) => {
              e.preventDefault()
              setSobre(c.id)
            }}
            onDragLeave={() => setSobre((s) => (s === c.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              setSobre(null)
              const id = e.dataTransfer.getData('text/plain')
              if (id) onDrop(id, c.id)
            }}
            className={cn(
              'bg-muted/70 transition-colors',
              sobre === c.id && 'bg-primary/10 ring-1 ring-primary/40',
            )}
          >
            <Kanban.Header>
              <Kanban.Title>{c.nombre}</Kanban.Title>
              <ToneBadge tono={c.tono}>{lista.length}</ToneBadge>
            </Kanban.Header>
            <Kanban.Body>
              {lista.length ? (
                lista.map((i) => (
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
      })}
    </Kanban.Viewport>
  )
}

export function TipoDocBadges({
  judicial,
  entregable,
  plazo,
}: {
  judicial?: boolean
  entregable?: boolean
  plazo?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {judicial ? (
        <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          <Gavel className="h-3 w-3" /> Judicial
        </span>
      ) : null}
      {entregable ? (
        <span className="border-success/30 bg-success/10 text-success inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          <FileCheck2 className="h-3 w-3" /> Entregable
        </span>
      ) : null}
      {plazo === 'Posible plazo pendiente de validar' ? (
        <span className="border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          <ShieldAlert className="h-3 w-3" /> Plazo sin validar
        </span>
      ) : null}
      {plazo === 'Plazo validado' ? (
        <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          <Clock className="h-3 w-3" /> Plazo validado
        </span>
      ) : null}
    </div>
  )
}

export function DatoLinea({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-border/60 flex flex-wrap items-baseline justify-between gap-2 border-b py-1.5 last:border-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground text-right text-sm">{value || '—'}</dd>
    </div>
  )
}

export function Bloque({
  titulo,
  acciones,
  children,
}: {
  titulo: string
  acciones?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-foreground text-sm font-semibold">{titulo}</h3>
          {acciones}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-8 text-center text-xs">
      {texto}
    </p>
  )
}

export const euros = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
