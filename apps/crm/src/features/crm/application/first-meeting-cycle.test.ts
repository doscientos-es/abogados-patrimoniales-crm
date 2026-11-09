import { describe, expect, it } from 'vitest'

import {
  REMINDER_TITLE,
  comenzar,
  estadoAsistente,
  isFirstMeeting,
  marcarNoAsistencia,
  pickFirstMeeting,
  recordatorioNoAsistencia,
  terminar,
} from './first-meeting-cycle'

const programada = {
  status: 'scheduled',
  startsAt: '2026-10-20T08:30:00.000Z',
  endsAt: '2026-10-20T09:00:00.000Z',
  meetingType: 'Primera cita',
  primeraCita: { estado: 'Programada', resultado: 'previo' },
}

describe('ciclo de Primera cita', () => {
  it('registra comienzo, fin y duración efectiva sin perder los datos previos', () => {
    const active = comenzar(programada, '2026-10-20T08:31:00.000Z')
    expect(estadoAsistente(active)).toBe('en_curso')
    expect(active.primeraCita).toMatchObject({ estado: 'En curso', resultado: 'previo' })
    const finished = terminar(active, '2026-10-20T09:05:00.000Z')
    expect(estadoAsistente(finished)).toBe('finalizada')
    expect(finished.actualDurationMinutes).toBe(34)
    expect(() => terminar(programada, '2026-10-20T09:05:00.000Z')).toThrow()
  })

  it('no-show blocks starting and creates a follow-up task linked to the Lead', () => {
    const noShow = marcarNoAsistencia(programada, '2026-10-20T09:00:00.000Z')
    expect(estadoAsistente(noShow)).toBe('no_asistencia')
    expect(() => comenzar(noShow, '2026-10-20T09:10:00.000Z')).toThrow()
    const reminder = recordatorioNoAsistencia(
      { oportunidadId: 'lead-1', asignadoId: 'user-1' } as never,
      new Date('2026-10-20T10:00:00'),
    )
    expect(reminder).toMatchObject({
      titulo: REMINDER_TITLE,
      oportunidadId: 'lead-1',
      asignadoId: 'user-1',
    })
  })

  it('recognizes only Lead first meetings and selects a live meeting over a closed one', () => {
    const first = { tipo: 'Evento' as const, oportunidadId: 'lead-1', reunion: programada }
    const closed = { ...first, id: 'closed', estado: 'Completada' as const }
    const live = { ...first, id: 'live', estado: 'Pendiente' as const }
    const other = { ...first, id: 'other', oportunidadId: 'lead-2', estado: 'Pendiente' as const }
    expect(isFirstMeeting(first as never)).toBe(true)
    expect(isFirstMeeting({ ...first, reunion: { meetingType: 'Seguimiento' } } as never)).toBe(
      false,
    )
    expect(
      (pickFirstMeeting([closed, live, other] as never[], 'lead-1') as { id?: string } | undefined)
        ?.id,
    ).toBe('live')
  })
})
