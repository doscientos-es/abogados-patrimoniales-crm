import { Link } from '@tanstack/react-router'
import { Check, Circle, Construction } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type Prioridad } from '@/data/crm'
import { cn } from '@/lib/utils'

export function SectionHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="border-border mb-6 grid gap-4 border-b pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-foreground min-w-0 truncate font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {meta ? (
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {meta}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  )
}

const statTono: Record<string, string> = {
  neutro: 'text-foreground',
  info: 'text-primary',
  exito: 'text-success',
  aviso: 'text-warning-foreground',
  riesgo: 'text-destructive',
}

/** Indicador numérico homogéneo para todas las pantallas. */
export function StatTile({
  label,
  value,
  hint,
  tono = 'neutro',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tono?: 'neutro' | 'info' | 'exito' | 'aviso' | 'riesgo'
}) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className={cn('mt-1.5 font-serif text-2xl font-semibold tabular-nums', statTono[tono])}>
        {value}
      </p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  )
}

export function PendingBadge({ label = 'Pendiente de desarrollo' }: { label?: string }) {
  return (
    <span className="border-warning/60 bg-warning/10 text-warning-foreground inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium">
      <Construction className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export function PendingPanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-border bg-muted/40 rounded-lg border border-dashed p-6 text-center">
      <p className="text-foreground font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1 max-w-xl text-sm">{description}</p>
      ) : null}
      <div className="mt-3 flex justify-center">
        <PendingBadge />
      </div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  to,
  params,
}: {
  label: string
  value: string
  hint?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any
}) {
  return (
    <Link
      to={to}
      params={params}
      className="group border-border bg-card hover:border-primary/40 hover:bg-accent block rounded-lg border p-4 transition-colors"
    >
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-foreground mt-2 font-serif text-3xl font-semibold">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </Link>
  )
}

const prioridadClass: Record<Prioridad, string> = {
  Alta: 'bg-destructive/10 text-destructive border-destructive/30',
  Media: 'bg-warning/15 text-warning-foreground border-warning/40',
  Baja: 'bg-muted text-muted-foreground border-border',
}

export function PriorityBadge({ value }: { value: Prioridad }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
        prioridadClass[value],
      )}
    >
      {value}
    </span>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const bloqueado = /bloque/i.test(value)
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
        bloqueado
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-border bg-secondary text-secondary-foreground',
      )}
    >
      {value}
    </span>
  )
}

export function Timeline({ items }: { items: { fecha: string; hito: string; fase: string }[] }) {
  return (
    <ol className="border-border relative ml-2 border-l pl-6">
      {items.map((it, i) => (
        <li key={i} className="relative pb-5 last:pb-0">
          <span className="absolute top-1 left-[-1.9rem] flex h-3 w-3 items-center justify-center">
            <Circle className="fill-primary text-primary h-3 w-3" />
          </span>
          <p className="text-foreground text-sm font-medium">{it.hito}</p>
          <p className="text-muted-foreground text-xs">
            {it.fecha} · {it.fase}
          </p>
        </li>
      ))}
    </ol>
  )
}

export function Checklist({ items, done = 0 }: { items: string[]; done?: number }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={item}
          className="border-border bg-card flex items-start gap-3 rounded-md border px-3 py-2.5"
        >
          <span
            className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
              i < done ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
            )}
          >
            {i < done ? <Check className="h-3 w-3" /> : null}
          </span>
          <span
            className={cn(
              'text-sm',
              i < done ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function FieldList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">{k}</dt>
          <dd className="text-foreground mt-0.5 text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
