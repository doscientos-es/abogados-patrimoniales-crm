import {
  SATISFACTION_LEVELS,
  type SatisfactionLevel,
} from '@/features/contactos/application/contact-profile'
import { cn } from '@/lib/utils'

const RATED_LEVELS = SATISFACTION_LEVELS.filter((level) => level !== 'Sin valorar')

export function SatisfactionMeter({
  value,
  showLabel = true,
}: {
  value: SatisfactionLevel
  showLabel?: boolean
}) {
  const activeIndex = value === 'Sin valorar' ? -1 : RATED_LEVELS.indexOf(value)

  return (
    <span className="inline-flex items-center gap-2">
      <span role="img" aria-label={`Nivel de satisfacción: ${value}`} className="flex gap-0.5">
        {RATED_LEVELS.map((level, index) => (
          <span
            key={level}
            aria-hidden="true"
            className={cn(
              'h-1.5 w-4 rounded-full',
              index <= activeIndex ? 'bg-primary' : 'bg-muted-foreground/20',
            )}
          />
        ))}
      </span>
      {showLabel ? <span className="text-muted-foreground text-xs">{value}</span> : null}
    </span>
  )
}
