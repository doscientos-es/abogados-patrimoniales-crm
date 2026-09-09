import { describe, expect, it } from 'vitest'

import { taskBoardColumn } from './persistent-task-workspace'

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
})
