import { describe, expect, it } from 'vitest'

import {
  caseAlerts,
  caseControlColumn,
  caseDependency,
  casePhaseForColumn,
  relativeDays,
} from './case-control'

const expediente = (overrides = {}) =>
  ({
    id: 'case-1',
    referencia: 'AP_11',
    contactoPrincipalId: 'contact-1',
    oportunidadId: null,
    titulo: 'Compraventa',
    area: '',
    tipoAsunto: '',
    naturaleza: 'Extrajudicial',
    estadoGeneral: 'active',
    fase: 'intake',
    estadoOperativo: 'pending',
    prioridad: 'Media',
    asignadoId: 'user-1',
    fechaApertura: '2026-01-01',
    fechaCierre: null,
    proximaAccion: '',
    dondeEstamos: '',
    version: 1,
    actualizadoEn: '2026-01-01T10:00:00Z',
    ...overrides,
  }) as never

describe('case control workflow', () => {
  it('normalizes legacy and operational phases into control board columns', () => {
    expect(caseControlColumn(expediente())).toBe('diagnosis')
    expect(caseControlColumn(expediente({ fase: 'Preparación y primeras actuaciones' }))).toBe(
      'preparation',
    )
    expect(caseControlColumn(expediente({ fase: 'Propuesta o borrador' }))).toBe('proposal')
    expect(casePhaseForColumn('in_progress')).toBe('En curso')
  })

  it('labels dependencies and reports stale, unvalidated, and overdue case work', () => {
    const now = Date.parse('2026-09-07T12:00:00Z')
    const alerts = caseAlerts(
      expediente(),
      [
        {
          expedienteId: 'case-1',
          tipo: 'Plazo',
          validacion: 'Propuesto',
          estado: 'Pendiente',
          titulo: 'Contestación',
          venceEn: '2026-09-06T09:00:00Z',
        },
      ] as never,
      [],
      now,
    )
    expect(caseDependency('pending')).toBe('Debemos actuar nosotros')
    expect(alerts).toEqual(
      expect.arrayContaining([
        'Sin actuaciones registradas en más de 15 días',
        'Fecha sin validar: Contestación',
        'Tarea vencida: Contestación',
      ]),
    )
  })

  it('formats past, current, and future movement dates', () => {
    const now = Date.parse('2026-09-07T12:00:00Z')
    expect(relativeDays('2026-09-06T12:00:00Z', now)).toBe('hace 1 día')
    expect(relativeDays('2026-09-07T12:00:00Z', now)).toBe('hoy')
    expect(relativeDays('2026-09-09T12:00:00Z', now)).toBe('dentro de 2 días')
  })
})
