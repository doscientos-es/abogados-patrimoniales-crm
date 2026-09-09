import { describe, expect, it } from 'vitest'

import {
  canMoveTaskInBoard,
  sortTasksForAgenda,
  taskBoardColumn,
  taskStatusForBoardColumn,
} from './persistent-task-workspace'

const task = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'task-1',
    estado: 'Pendiente',
    validacion: 'No aplica',
    ...overrides,
  }) as never

describe('taskBoardColumn', () => {
  it('groups active tasks by status and proposed deadlines as waiting', () => {
    expect(taskBoardColumn(task())).toBe('pending')
    expect(taskBoardColumn(task({ estado: 'En curso' }))).toBe('in-progress')
    expect(taskBoardColumn(task({ validacion: 'Propuesto' }))).toBe('waiting')
  })

  it('keeps completed and cancelled tasks out of the active Kanban', () => {
    expect(taskBoardColumn(task({ estado: 'Completada' }))).toBeNull()
    expect(taskBoardColumn(task({ estado: 'Cancelada' }))).toBeNull()
  })

  it('only permits drag-and-drop between persisted active states', () => {
    expect(taskStatusForBoardColumn('pending')).toBe('Pendiente')
    expect(taskStatusForBoardColumn('in-progress')).toBe('En curso')
    expect(taskStatusForBoardColumn('waiting')).toBeNull()
    expect(canMoveTaskInBoard(task(), 'in-progress')).toBe(true)
    expect(canMoveTaskInBoard(task({ validacion: 'Propuesto' }), 'pending')).toBe(false)
  })
})

describe('sortTasksForAgenda', () => {
  it('orders dated items chronologically and keeps undated items last', () => {
    const ordered = sortTasksForAgenda([
      task({ id: 'undated', titulo: 'Sin fecha', venceEn: null, prioridad: 'Alta' }),
      task({
        id: 'later',
        titulo: 'Más tarde',
        venceEn: '2026-09-30T09:00:00Z',
        prioridad: 'Media',
      }),
      task({ id: 'first', titulo: 'Primero', venceEn: '2026-09-10T09:00:00Z', prioridad: 'Baja' }),
    ])

    expect(ordered.map((item) => item.id)).toEqual(['first', 'later', 'undated'])
  })

  it('puts critical items before other items scheduled at the same time', () => {
    const ordered = sortTasksForAgenda([
      task({
        id: 'normal',
        titulo: 'Normal',
        venceEn: '2026-09-10T09:00:00Z',
        critico: false,
        prioridad: 'Alta',
      }),
      task({
        id: 'critical',
        titulo: 'Crítica',
        venceEn: '2026-09-10T09:00:00Z',
        critico: true,
        prioridad: 'Baja',
      }),
    ])

    expect(ordered.map((item) => item.id)).toEqual(['critical', 'normal'])
  })
})
