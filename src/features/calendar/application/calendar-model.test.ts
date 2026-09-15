import { describe, expect, it } from 'vitest'

import { buildMonthGrid, calendarEntries, dayKey } from './calendar-model'

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
