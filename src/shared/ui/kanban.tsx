import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Área desplazable común para tableros: las columnas siempre avanzan en horizontal. */
export function KanbanViewport({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="-mx-1 overflow-x-auto pb-3">
      <div className={cn('flex min-w-max items-start gap-3 px-1', className)}>{children}</div>
    </div>
  )
}

const columnSize = {
  compact: 'w-56',
  default: 'w-72',
  wide: 'w-80',
} as const

export function KanbanColumn({
  children,
  className,
  size = 'default',
  ...props
}: ComponentPropsWithoutRef<'section'> & { size?: keyof typeof columnSize }) {
  return (
    <section
      className={cn('shrink-0 rounded-lg border border-border/70 p-2', columnSize[size], className)}
      {...props}
    >
      {children}
    </section>
  )
}

export function KanbanColumnHeader({
  children,
  className,
  density = 'default',
  ...props
}: ComponentPropsWithoutRef<'header'> & { density?: 'compact' | 'default' }) {
  return (
    <header
      className={cn(
        density === 'compact'
          ? 'mb-2 flex items-center justify-between gap-1 px-0.5 py-1'
          : 'mb-2 flex items-center justify-between gap-2 px-1 py-1',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  )
}

export function KanbanColumnTitle({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      className={cn(
        'text-foreground truncate text-[11px] font-semibold tracking-wide uppercase',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function KanbanColumnBody({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('space-y-2', className)} {...props}>
      {children}
    </div>
  )
}

export function KanbanEmpty({
  children,
  className,
  compact = false,
  ...props
}: ComponentPropsWithoutRef<'p'> & { compact?: boolean }) {
  return (
    <p
      className={cn(
        'border-border text-muted-foreground rounded-md border border-dashed py-6 text-center',
        compact ? 'px-2 text-[11px]' : 'px-3 text-xs',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  )
}
