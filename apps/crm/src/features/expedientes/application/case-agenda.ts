import type { TareaPersistida } from '@/features/tareas'

export type AgendaEntry = { task: TareaPersistida; date: Date }

export const AGENDA_BUCKETS = ['Vencidos', 'Hoy', 'Próximos 7 días', 'Más adelante'] as const

export const isOpenTask = (task: TareaPersistida) =>
  !['Completada', 'Cancelada'].includes(task.estado)

/** Whole calendar days from `now` to `date` (negative when it is in the past). */
export function daysUntil(date: Date, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((to - from) / 86_400_000)
}

export function agendaBucket(days: number): (typeof AGENDA_BUCKETS)[number] {
  if (days < 0) return 'Vencidos'
  if (days === 0) return 'Hoy'
  if (days <= 7) return 'Próximos 7 días'
  return 'Más adelante'
}

export function countdown(days: number) {
  if (days < 0) return `Vencido hace ${-days} d`
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  return `En ${days} días`
}

/** Tasks with a due date, oldest first. Invalid dates are left out. */
export function datedEntries(tasks: TareaPersistida[]): AgendaEntry[] {
  return tasks
    .filter((task) => task.venceEn)
    .map((task) => ({ task, date: new Date(task.venceEn as string) }))
    .filter((entry) => !Number.isNaN(entry.date.getTime()))
    .sort((first, second) => first.date.getTime() - second.date.getTime())
}

/** Next open hearing or deadline of the case, for the Summary banner. */
export function nextAgendaItem(tasks: TareaPersistida[]): AgendaEntry | undefined {
  return datedEntries(tasks).find(
    ({ task }) => isOpenTask(task) && (task.tipo === 'Plazo' || task.tipo === 'Evento'),
  )
}
