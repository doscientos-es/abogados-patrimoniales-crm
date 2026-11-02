import { describe, expect, it } from 'vitest'

import type { TareaPersistida } from '@/features/tareas'

import { agendaBucket, countdown, datedEntries, daysUntil, nextAgendaItem } from './case-agenda'

const task = (patch: Partial<TareaPersistida>) =>
  ({
    id: 't',
    titulo: 'x',
    tipo: 'Tarea',
    estado: 'Pendiente',
    venceEn: null,
    ...patch,
  }) as TareaPersistida

const now = new Date('2026-11-02T10:00:00')

describe('agenda del expediente', () => {
  it('cuenta días naturales, no horas', () => {
    expect(daysUntil(new Date('2026-11-02T23:59:00'), now)).toBe(0)
    expect(daysUntil(new Date('2026-11-03T00:01:00'), now)).toBe(1)
    expect(daysUntil(new Date('2026-10-30T09:00:00'), now)).toBe(-3)
  })

  it('agrupa en vencidos, hoy, próximos 7 días y más adelante', () => {
    expect([-1, 0, 1, 7, 8].map(agendaBucket)).toEqual([
      'Vencidos',
      'Hoy',
      'Próximos 7 días',
      'Próximos 7 días',
      'Más adelante',
    ])
    expect([-2, 0, 1, 5].map(countdown)).toEqual(['Vencido hace 2 d', 'Hoy', 'Mañana', 'En 5 días'])
  })

  it('el próximo en agenda es un plazo o evento abierto, el más cercano', () => {
    const tasks = [
      task({ id: 'a', tipo: 'Recordatorio', venceEn: '2026-11-01T09:00:00' }),
      task({ id: 'b', tipo: 'Plazo', venceEn: '2026-11-20T09:00:00' }),
      task({ id: 'c', tipo: 'Evento', venceEn: '2026-11-10T09:00:00' }),
      task({ id: 'd', tipo: 'Plazo', venceEn: '2026-11-05T09:00:00', estado: 'Completada' }),
      task({ id: 'e', tipo: 'Plazo', venceEn: 'no-es-fecha' }),
    ]
    expect(nextAgendaItem(tasks)?.task.id).toBe('c')
    expect(datedEntries(tasks).map((entry) => entry.task.id)).toEqual(['a', 'd', 'c', 'b'])
  })
})
