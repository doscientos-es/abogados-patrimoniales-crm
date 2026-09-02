import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@doscientos/ui'
import { Link, type LinkProps } from '@tanstack/react-router'
import { AlertTriangle, CalendarClock, Circle, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

import { PendingBadge } from '@/components/common'
import type { HistorialItem, Prioridad, Tono } from '@/data/crm'
import { cn } from '@/lib/utils'
import * as Kanban from '@/shared/ui/kanban'

export const toneClass: Record<Tono, string> = {
  neutro: 'border-border bg-muted text-muted-foreground',
  exito: 'border-success/40 bg-success/10 text-success',
  aviso: 'border-warning/50 bg-warning/15 text-warning-foreground',
  riesgo: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-primary/30 bg-primary/10 text-primary',
}

export function ToneBadge({ tono, children }: { tono: Tono; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        toneClass[tono],
      )}
    >
      {children}
    </span>
  )
}

const prioridadTono: Record<Prioridad, Tono> = { Alta: 'riesgo', Media: 'aviso', Baja: 'neutro' }

export function PriorityBadge({ value }: { value: Prioridad }) {
  return <ToneBadge tono={prioridadTono[value]}>{value}</ToneBadge>
}

export function AlertPills({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-muted-foreground text-xs">Sin alertas</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((a) => (
        <span
          key={a}
          className="border-destructive/30 bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
        >
          <AlertTriangle className="h-3 w-3" />
          {a}
        </span>
      ))}
    </span>
  )
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
      <div className="text-foreground mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  )
}

export function EntityHeader({
  eyebrow,
  title,
  meta,
  alerts,
  actions,
  backTo,
  backLabel,
}: {
  eyebrow: string
  title: string
  meta: { label: string; value: ReactNode }[]
  alerts?: string[]
  actions?: ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backTo?: any
  backLabel?: string
}) {
  return (
    <div className="border-border bg-card mb-5 rounded-lg border p-4 sm:p-5">
      {backTo ? (
        <Link to={backTo} className="text-muted-foreground hover:text-foreground text-xs">
          ← {backLabel ?? 'Volver'}
        </Link>
      ) : null}
      <div className="mt-1 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {eyebrow}
          </p>
          <h1 className="text-foreground mt-1 font-serif text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h1>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
        ) : null}
      </div>
      <div className="border-border mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {meta.map((m) => (
          <MetaItem key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
      {alerts ? (
        <div className="mt-3">
          <AlertPills items={alerts} />
        </div>
      ) : null}
    </div>
  )
}

export type KanbanColumn<T> = {
  id: string
  nombre: string
  tono: Tono
  items: T[]
}

export function KanbanBoard<T>({
  columns,
  renderCard,
}: {
  columns: KanbanColumn<T>[]
  renderCard: (item: T) => ReactNode
}) {
  return (
    <Kanban.Viewport>
      {columns.map((col) => (
        <Kanban.Column key={col.id} className="bg-muted/70">
          <Kanban.Header>
            <Kanban.Title>{col.nombre}</Kanban.Title>
            <ToneBadge tono={col.tono}>{col.items.length}</ToneBadge>
          </Kanban.Header>
          <Kanban.Body>
            {col.items.length ? (
              col.items.map((item, i) => <div key={i}>{renderCard(item)}</div>)
            ) : (
              <Kanban.Empty>Sin registros</Kanban.Empty>
            )}
          </Kanban.Body>
        </Kanban.Column>
      ))}
    </Kanban.Viewport>
  )
}

export function FunnelChart({ items }: { items: { etapa: string; total: number }[] }) {
  const max = Math.max(...items.map((i) => i.total), 1)
  return (
    <div className="space-y-2">
      {items.map((i, idx) => (
        <div key={i.etapa} className="flex items-center gap-3">
          <span className="text-muted-foreground w-52 shrink-0 truncate text-sm">{i.etapa}</span>
          <div className="bg-muted h-7 flex-1 overflow-hidden rounded-md">
            <div
              className="bg-primary/85 text-primary-foreground flex h-full items-center justify-end rounded-md px-2 text-xs font-semibold"
              style={{ width: `${Math.max((i.total / max) * 100, 8)}%` }}
            >
              {i.total}
            </div>
          </div>
          <span className="text-muted-foreground w-14 shrink-0 text-right text-xs">
            {idx === 0 ? '—' : `${Math.round((i.total / (items[0]?.total || 1)) * 100)} %`}
          </span>
        </div>
      ))}
    </div>
  )
}

export function BarList({ items }: { items: { label: string; total: number }[] }) {
  const max = Math.max(...items.map((i) => i.total), 1)
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3">
          <span className="text-foreground w-44 shrink-0 truncate text-sm">{i.label}</span>
          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-chart-2 h-full rounded-full"
              style={{ width: `${(i.total / max) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground w-8 shrink-0 text-right text-xs">{i.total}</span>
        </li>
      ))}
    </ul>
  )
}

export function TimelineFeed({ items }: { items: HistorialItem[] }) {
  if (!items.length)
    return <p className="text-muted-foreground text-sm">Sin movimientos registrados.</p>
  return (
    <ol className="border-border relative ml-2 border-l pl-6">
      {items.map((it, i) => (
        <li key={i} className="relative pb-5 last:pb-0">
          <span className="absolute top-1 -left-[1.9rem] flex h-3 w-3 items-center justify-center">
            <Circle className="fill-primary text-primary h-3 w-3" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-sm font-medium">{it.tipo}</span>
            <span className="text-muted-foreground text-xs">
              {it.fecha} · {it.usuario}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">{it.descripcion}</p>
          {it.resultado || it.proxima || it.relacionado ? (
            <p className="text-muted-foreground mt-1 flex flex-wrap gap-3 text-xs">
              {it.relacionado ? <span>Relacionado: {it.relacionado}</span> : null}
              {it.resultado ? <span>Resultado: {it.resultado}</span> : null}
              {it.proxima ? <span>Próxima actuación: {it.proxima}</span> : null}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

export function RelationList({
  title,
  items,
  empty = 'Sin elementos relacionados.',
}: {
  title: string
  items: {
    label: string
    sub?: string | undefined
    badge?: ReactNode
    to?: LinkProps['to']
    params?: LinkProps['params']
  }[]
  empty?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="divide-border divide-y">
            {items.map((it, i) => {
              const body = (
                <span className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="text-foreground block truncate text-sm font-medium">
                      {it.label}
                    </span>
                    {it.sub ? (
                      <span className="text-muted-foreground block truncate text-xs">{it.sub}</span>
                    ) : null}
                  </span>
                  {it.badge}
                </span>
              )
              return (
                <li key={i}>
                  {it.to ? (
                    <Link
                      to={it.to}
                      {...(it.params === undefined ? {} : { params: it.params })}
                      className="hover:bg-accent/60 block"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{empty}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function ViewSwitch({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="border-border bg-card inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded px-3 py-1.5 text-xs font-medium transition-colors',
            value === o.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs tracking-wide uppercase">{label}</Label>
      {children}
    </div>
  )
}

export function MockDialog({
  trigger,
  title,
  description,
  children,
  confirmLabel = 'Guardar',
}: {
  trigger: ReactNode
  title: string
  description?: string
  children: ReactNode
  confirmLabel?: string
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        <DialogFooter className="mt-2 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <PendingBadge label="Guardado pendiente de desarrollo" />
          <Button disabled>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function QuickTaskDialog({ trigger }: { trigger?: ReactNode }) {
  return (
    <MockDialog
      trigger={
        trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Crear tarea
          </Button>
        )
      }
      title="Nueva tarea"
      description="Puede vincularse a un contacto, oportunidad, presupuesto, expediente, documento, comunicación, factura, actividad o evento."
      confirmLabel="Crear tarea"
    >
      <div className="sm:col-span-2">
        <Field label="Título">
          <Input placeholder="Título de la tarea" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Descripción">
          <Textarea rows={3} placeholder="Descripción de la tarea" />
        </Field>
      </div>
      <Field label="Responsable">
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="ib">Igor Belmonte</SelectItem>
            <SelectItem id="at">Ana Torregrosa</SelectItem>
            <SelectItem id="lf">Luis Ferrán</SelectItem>
            <SelectItem id="ms">Marta Solé</SelectItem>
            <SelectItem id="nc">Nuria Casals</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Colaboradores">
        <Input placeholder="Añadir colaboradores" />
      </Field>
      <Field label="Fecha de inicio">
        <Input placeholder="dd/mm/aaaa" />
      </Field>
      <Field label="Fecha límite">
        <Input placeholder="dd/mm/aaaa" />
      </Field>
      <Field label="Prioridad">
        <Select defaultSelectedKey="media">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="alta">Alta</SelectItem>
            <SelectItem id="media">Media</SelectItem>
            <SelectItem id="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Estado">
        <Select defaultSelectedKey="pendiente">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="pendiente">Pendiente</SelectItem>
            <SelectItem id="curso">En curso</SelectItem>
            <SelectItem id="revision">En revisión</SelectItem>
            <SelectItem id="completada">Completada</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Elemento relacionado">
        <Select>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem id="contacto">Contacto</SelectItem>
            <SelectItem id="oportunidad">Oportunidad</SelectItem>
            <SelectItem id="presupuesto">Presupuesto</SelectItem>
            <SelectItem id="expediente">Expediente</SelectItem>
            <SelectItem id="documento">Documento</SelectItem>
            <SelectItem id="comunicacion">Comunicación</SelectItem>
            <SelectItem id="factura">Factura</SelectItem>
            <SelectItem id="actividad">Actividad</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Archivos">
        <Input type="file" disabled />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Lista de comprobación">
          <Textarea rows={2} placeholder="Un punto por línea" />
        </Field>
      </div>
    </MockDialog>
  )
}

export function GoogleCalendarNote() {
  return (
    <p className="border-border bg-muted/40 text-muted-foreground flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
      <CalendarClock className="h-4 w-4 shrink-0" />
      Preparado para sincronizar con Google Calendar en una fase posterior. Los eventos mostrados
      son ficticios.
    </p>
  )
}
