import { Avatar, AvatarFallback } from '@doscientos/ui'

import { cn } from '@/lib/utils'

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

/** Who wrote a note, as an avatar with initials plus name and date, for sticker footers. */
export function NoteAuthor({
  name,
  date,
  className,
}: {
  name: string
  date: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 text-xs', className)} data-testid="note-author">
      <Avatar size="sm" aria-hidden="true">
        <AvatarFallback className="bg-current/15 text-[10px] font-semibold text-inherit">
          {initialsOf(name) || '·'}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="block opacity-70">{date}</span>
      </span>
    </div>
  )
}
