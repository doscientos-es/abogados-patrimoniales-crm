import { describe, expect, it } from 'vitest'

import type { TareaPersistida } from '@/features/tareas'

import { nextLeadAction } from './lead-next-action'

const task = (overrides: Partial<TareaPersistida> = {}) =>
  ({
    id: 'task-1',
    esSiguienteAccion: false,
    estado: 'Pendiente',
    venceEn: null,
    ...overrides,
  }) as TareaPersistida

describe('nextLeadAction', () => {
  it('returns the earliest active task explicitly marked as the next action', () => {
    const ordinary = task({ id: 'ordinary', venceEn: '2026-10-01T09:00:00Z' })
    const later = task({ id: 'later', esSiguienteAccion: true, venceEn: '2026-10-03T09:00:00Z' })
    const next = task({ id: 'next', esSiguienteAccion: true, venceEn: '2026-10-02T09:00:00Z' })
    const completed = task({ id: 'completed', esSiguienteAccion: true, estado: 'Completada' })

    expect(nextLeadAction([ordinary, later, completed, next])).toBe(next)
  })

  it('returns no next action when no active task is explicitly marked', () => {
    expect(
      nextLeadAction([task(), task({ esSiguienteAccion: true, estado: 'Cancelada' })]),
    ).toBeUndefined()
  })
})
