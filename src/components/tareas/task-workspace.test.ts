import { describe, expect, it } from 'vitest'

import {
  calendarSlotHour,
  canMoveTaskInBoard,
  layoutCalendarEvents,
  specialMeetingCreationIssue,
  sortTasksForAgenda,
  taskBoardColumn,
  taskStatusForBoardColumn,
} from './task-workspace'

const task = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'task-1',
    estado: 'Pendiente',
    validacion: 'No aplica',
    ...overrides,
  }) as never

describe('taskBoardColumn', () => {
  it('groups active tasks by their real workflow status', () => {
    expect(taskBoardColumn(task())).toBe('pending')
    expect(taskBoardColumn(task({ estado: 'En curso' }))).toBe('in-progress')
    expect(taskBoardColumn(task({ estado: 'En espera' }))).toBe('waiting')
    expect(taskBoardColumn(task({ validacion: 'Propuesto' }))).toBe('pending')
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
    expect(canMoveTaskInBoard(task({ estado: 'En espera' }), 'pending')).toBe(false)
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

describe('calendarSlotHour', () => {
  it('keeps events in the visible timetable and groups outside hours at its edges', () => {
    expect(calendarSlotHour('2026-09-10T10:30:00')).toBe(10)
    expect(calendarSlotHour('2026-09-10T06:30:00')).toBe(8)
    expect(calendarSlotHour('2026-09-10T22:30:00')).toBe(19)
  })
})

describe('layoutCalendarEvents', () => {
  it('places overlapping events in separate columns instead of stacking them', () => {
    const layouts = layoutCalendarEvents([
      task({ id: 'first', titulo: 'Primero', venceEn: '2026-09-10T10:00:00' }),
      task({ id: 'second', titulo: 'Segundo', venceEn: '2026-09-10T10:15:00' }),
    ])

    expect(layouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task: expect.objectContaining({ id: 'first' }),
          column: 0,
          columnCount: 2,
        }),
        expect.objectContaining({
          task: expect.objectContaining({ id: 'second' }),
          column: 1,
          columnCount: 2,
        }),
      ]),
    )
  })

  it('returns to the first column when events no longer overlap', () => {
    const layouts = layoutCalendarEvents([
      task({ id: 'first', titulo: 'Primero', venceEn: '2026-09-10T10:00:00' }),
      task({ id: 'later', titulo: 'Después', venceEn: '2026-09-10T11:00:00' }),
    ])

    expect(layouts.map((layout) => [layout.column, layout.columnCount])).toEqual([
      [0, 1],
      [0, 1],
    ])
  })

  it('uses a special meeting duration when sizing and checking agenda overlaps', () => {
    const layouts = layoutCalendarEvents([
      task({
        id: 'meeting',
        titulo: 'Reunión de dos horas',
        tipo: 'Evento',
        venceEn: '2026-09-10T10:00:00',
        reunion: {
          specialType: 'meeting',
          startsAt: '2026-09-10T10:00:00',
          endsAt: '2026-09-10T12:00:00',
        },
      }),
      task({ id: 'later', titulo: 'Otra tarea', venceEn: '2026-09-10T11:00:00' }),
    ])

    expect(layouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task: expect.objectContaining({ id: 'meeting' }),
          height: 156,
          columnCount: 2,
        }),
        expect.objectContaining({
          task: expect.objectContaining({ id: 'later' }),
          columnCount: 2,
        }),
      ]),
    )
  })
})

describe('specialMeetingCreationIssue', () => {
  const meeting = {
    startsAt: '',
    endsAt: '',
    mode: 'office_bilbao' as const,
    location: '',
    meetingUrl: '',
    preparation: '',
    specialType: 'meeting' as const,
    attendeeContactIds: [],
    attendeeUserIds: [],
  }

  it('requires a subject and at least one attendee when creating a special meeting', () => {
    expect(specialMeetingCreationIssue(meeting)).toBe('Indica el objeto de la reunión.')
    expect(specialMeetingCreationIssue({ ...meeting, subject: 'Consulta' })).toBe(
      'Añade al menos una persona asistente.',
    )
    expect(
      specialMeetingCreationIssue({
        ...meeting,
        subject: 'Consulta',
        attendeeNames: ['  Cliente  '],
      }),
    ).toBeNull()
  })
})
