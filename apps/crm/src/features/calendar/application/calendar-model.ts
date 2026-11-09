import type { TareaPersistida } from '@/features/tareas'

export type CalendarEntry = {
  task: TareaPersistida
  date: Date
  dayKey: string
}

export type CalendarEntryFilters = {
  tipo: 'all' | TareaPersistida['tipo']
  expedienteId: string
  desde: string
  hasta: string
  busqueda: string
  soloPrioritarias: boolean
}

export const EMPTY_CALENDAR_FILTERS: CalendarEntryFilters = {
  tipo: 'all',
  expedienteId: '',
  desde: '',
  hasta: '',
  busqueda: '',
  soloPrioritarias: false,
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

function dateBoundary(value: string) {
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null
  const [year, month, day] = parts
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null
  return date.getTime()
}

function searchable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
}

/** Applies the calendar's composable filters to persisted task entries only. */
export function filterCalendarEntries(
  entries: CalendarEntry[],
  filters: CalendarEntryFilters,
  caseNames: ReadonlyMap<string, string> = new Map(),
) {
  const from = filters.desde ? dateBoundary(filters.desde) : null
  const to = filters.hasta ? dateBoundary(filters.hasta) : null
  const query = searchable(filters.busqueda.trim())

  return entries.filter(({ task, date }) => {
    if (filters.tipo !== 'all' && task.tipo !== filters.tipo) return false
    if (filters.expedienteId && task.expedienteId !== filters.expedienteId) return false
    if (filters.soloPrioritarias && !task.critico && task.tipo !== 'Plazo') return false

    const calendarDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    if (from !== null && calendarDay < from) return false
    if (to !== null && calendarDay > to) return false

    if (query) {
      const caseName = caseNames.get(task.expedienteId ?? '') ?? ''
      const text = searchable(`${task.titulo} ${task.descripcion} ${task.tipo} ${caseName}`)
      if (!text.includes(query)) return false
    }

    return true
  })
}
