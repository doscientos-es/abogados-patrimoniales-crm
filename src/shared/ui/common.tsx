import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function SectionHeader({
  title,
  subtitle,
  actions,
  meta,
  logo = false,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  meta?: ReactNode
  logo?: boolean
}) {
  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {logo ? (
            <img src="/logo-lex.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
          ) : null}
          <h1 className="text-foreground min-w-0 truncate font-serif text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
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

const statTonoBorder: Record<string, string> = {
  neutro: 'border-l-border',
  info: 'border-l-primary',
  exito: 'border-l-success',
  aviso: 'border-l-warning',
  riesgo: 'border-l-destructive',
}

/** Indicador numérico homogéneo para todas las pantallas. */
export function StatTile({
  label,
  value,
  hint,
  tono = 'neutro',
  compact = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tono?: 'neutro' | 'info' | 'exito' | 'aviso' | 'riesgo'
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'border-border bg-card rounded-lg border',
        compact
          ? cn(
              'flex min-h-20 items-center justify-between gap-3 border-l-[3px] px-3.5 py-3 shadow-sm',
              statTonoBorder[tono],
            )
          : 'p-4',
      )}
    >
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {label}
        </p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </div>
      <p
        className={cn(
          compact ? 'shrink-0 text-right text-xl sm:text-2xl' : 'mt-1.5 text-2xl',
          'font-serif font-semibold tabular-nums',
          statTono[tono],
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function PendingPanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-border bg-muted/40 rounded-lg border border-dashed p-6 text-center">
      <p className="text-foreground font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1 max-w-xl text-sm">{description}</p>
      ) : null}
    </div>
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

export function ViewSwitch({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="border-border bg-card inline-flex rounded-md border p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
