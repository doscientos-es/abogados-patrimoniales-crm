import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  buildMonthGrid,
  calendarEntries,
  dayKey,
  isSameDay,
  isSameMonth,
  shiftMonth,
  startOfMonth,
} from '@/features/calendar/application/calendar-model'
import { useTareasPersistentes } from '@/features/tareas'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Mini calendario del despacho: elegir un día y ver qué hay ese día. */
export function MeetingCalendarPanel({
  firmId,
  taskId,
  initialDate,
  onPickDay,
  disabled,
}: {
  firmId: string | undefined
  taskId: string
  initialDate: Date | null
  onPickDay: (day: Date) => void
  disabled: boolean
}) {
  const tasks = useTareasPersistentes(firmId)
  const [selected, setSelected] = useState<Date | null>(initialDate)
  const [month, setMonth] = useState(() => startOfMonth(initialDate ?? new Date()))
  const days = useMemo(() => buildMonthGrid(month), [month])
  const entries = useMemo(
    () => calendarEntries(tasks.data ?? []).filter((entry) => entry.task.id !== taskId),
    [tasks.data, taskId],
  )
  const busyDays = useMemo(() => new Set(entries.map((entry) => entry.dayKey)), [entries])
  const dayEntries = selected ? entries.filter((entry) => entry.dayKey === dayKey(selected)) : []
  const today = new Date()

  return (
    <div className="grid gap-3 md:grid-cols-[auto_1fr]">
      <div className="rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Mes anterior"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm font-medium capitalize">
            {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Mes siguiente"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="text-muted-foreground py-1">
              {weekday}
            </span>
          ))}
          {days.map((day) => {
            const isSelected = selected ? isSameDay(day, selected) : false
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={disabled}
                aria-label={day.toLocaleDateString('es-ES', { dateStyle: 'full' })}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelected(day)
                  onPickDay(day)
                }}
                className={cn(
                  'relative h-8 w-8 rounded-md tabular-nums hover:bg-muted disabled:opacity-50',
                  !isSameMonth(day, month) && 'text-muted-foreground/50',
                  isSameDay(day, today) && 'border-primary border',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                )}
              >
                {day.getDate()}
                {busyDays.has(dayKey(day)) ? (
                  <span className="bg-warning absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Agenda del día{' '}
          {selected ? selected.toLocaleDateString('es-ES', { dateStyle: 'medium' }) : '—'}
        </p>
        {dayEntries.length ? (
          <ul className="space-y-1.5">
            {dayEntries.map((entry) => (
              <li key={entry.task.id} className="rounded-md border p-2 text-sm">
                <span className="text-muted-foreground mr-2 text-xs tabular-nums">
                  {entry.date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {entry.task.titulo}
                <span className="text-muted-foreground ml-2 text-xs">{entry.task.tipo}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            {selected ? 'Sin compromisos ese día: hueco disponible.' : 'Elige un día en el calendario.'}
          </p>
        )}
      </div>
    </div>
  )
}
