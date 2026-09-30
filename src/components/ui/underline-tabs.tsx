import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'

export type UnderlineTabItem<T extends string> = {
  id: T
  label: string
  Icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
  count?: number | undefined
  /** Optional DOM id of the tab button. Defaults to `${idPrefix}-${id}`. */
  domId?: string
  /** Optional id of the controlled panel. Defaults to `${panelIdPrefix}-${id}`. */
  controls?: string
}

type UnderlineTabsProps<T extends string> = {
  items: Array<UnderlineTabItem<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  idPrefix?: string
  panelIdPrefix?: string
  className?: string
}

/** Shared underline-style tab bar used across detail pages and dialogs. */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  panelIdPrefix,
  className,
}: UnderlineTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'border-border/80 flex max-w-full gap-0.5 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map(({ id, label, Icon, count, domId, controls }) => {
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={domId ?? (idPrefix ? `${idPrefix}-${id}` : undefined)}
            aria-controls={controls ?? (panelIdPrefix ? `${panelIdPrefix}-${id}` : undefined)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
              selected
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent',
            )}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            {label}
            {count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] leading-4 tabular-nums',
                  selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
