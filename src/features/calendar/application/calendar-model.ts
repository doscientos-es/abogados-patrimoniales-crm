import type { TareaPersistida } from '@/features/tareas'

export type CalendarEntry = {
  task: TareaPersistida
  date: Date
  dayKey: string
}

export function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

export function shiftMonth(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

export function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`
}

export function isSameDay(first: Date, second: Date) {
  return dayKey(first) === dayKey(second)
}

export function isSameMonth(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth()
}

/** Builds a Monday-first six-week grid so the calendar does not shift in height between months. */
export function buildMonthGrid(value: Date) {
  const firstDay = startOfMonth(value)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const firstCell = new Date(firstDay)
  firstCell.setDate(firstCell.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell)
    day.setDate(day.getDate() + index)
    return day
  })
}

export function calendarEntries(tasks: TareaPersistida[]): CalendarEntry[] {
  return tasks
    .filter((task) => task.estado !== 'Cancelada' && Boolean(task.venceEn))
    .flatMap((task) => {
      const date = new Date(task.venceEn ?? '')
      return Number.isNaN(date.getTime()) ? [] : [{ task, date, dayKey: dayKey(date) }]
    })
    .sort((first, second) => {
      const dateDifference = first.date.getTime() - second.date.getTime()
      if (dateDifference) return dateDifference
      if (first.task.critico !== second.task.critico) return first.task.critico ? -1 : 1
      return first.task.titulo.localeCompare(second.task.titulo, 'es')
    })
}