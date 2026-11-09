import { describe, expect, it } from 'vitest'

import {
  buildMonthGrid,
  calendarEntries,
  dayKey,
  EMPTY_CALENDAR_FILTERS,
  filterCalendarEntries,
} from './calendar-model'

const task = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'task-1',
    titulo: 'Revisar expediente',
    estado: 'Pendiente',
    venceEn: '2026-09-14T10:00:00',
    critico: false,
    ...overrides,
  }) as never

describe('buildMonthGrid', () => {
  it('starts on Monday and always returns six complete weeks', () => {
    const days = buildMonthGrid(new Date(2026, 8, 1))
    const firstDay = days[0]
    if (!firstDay) throw new Error('El calendario debe contener días')

    expect(days).toHaveLength(42)
    expect(firstDay.getDay()).toBe(1)
    expect(dayKey(firstDay)).toBe('2026-7-31')
  })
})

describe('calendarEntries', () => {
  it('excludes cancelled and invalid items, ordering critical items first at the same time', () => {
    const entries = calendarEntries([
      task({ id: 'cancelled', estado: 'Cancelada' }),
      task({ id: 'invalid', venceEn: 'not-a-date' }),
      task({ id: 'normal' }),
      task({ id: 'critical', critico: true }),
    ])

    expect(entries.map((entry) => entry.task.id)).toEqual(['critical', 'normal'])
  })
})

describe('filterCalendarEntries', () => {
  it('combines type, case, date range, and accent-insensitive search filters', () => {
    const entries = calendarEntries([
      task({
        id: 'meeting',
        titulo: 'Reunión de sucesión',
        tipo: 'Evento',
        descripcion: 'Preparar documentación',
        expedienteId: 'case-1',
        venceEn: '2026-09-15T08:00:00',
      }),
      task({
        id: 'other-case',
        titulo: 'Reunión de sucesión',
        tipo: 'Evento',
        expedienteId: 'case-2',
        venceEn: '2026-09-15T09:00:00',
      }),
      task({
        id: 'outside-range',
        titulo: 'Reunión de sucesión',
        tipo: 'Evento',
        expedienteId: 'case-1',
        venceEn: '2026-09-16T09:00:00',
      }),
    ])

    const filtered = filterCalendarEntries(
      entries,
      {
        ...EMPTY_CALENDAR_FILTERS,
        tipo: 'Evento',
        expedienteId: 'case-1',
        desde: '2026-09-15',
        hasta: '2026-09-15',
        busqueda: 'reunion',
      },
      new Map([['case-1', 'EXP-001 · Sucesión']]),
    )

    expect(filtered.map((entry) => entry.task.id)).toEqual(['meeting'])
  })

  it('treats legal deadlines as priority entries even when they are not manually marked critical', () => {
    const entries = calendarEntries([
      task({ id: 'task', tipo: 'Tarea', critico: false }),
      task({ id: 'deadline', tipo: 'Plazo', critico: false }),
      task({ id: 'critical-event', tipo: 'Evento', critico: true }),
    ])

    const filtered = filterCalendarEntries(entries, {
      ...EMPTY_CALENDAR_FILTERS,
      soloPrioritarias: true,
    })

    expect(filtered.map((entry) => entry.task.id)).toEqual(['critical-event', 'deadline'])
  })
})
