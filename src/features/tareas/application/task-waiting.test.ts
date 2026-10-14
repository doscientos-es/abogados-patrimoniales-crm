import { describe, expect, it } from 'vitest'

import {
  componerDetalleEspera,
  entidadSugerida,
  historialEsperas,
  leerDetalleEspera,
} from './task-waiting'

describe('esperas de tareas', () => {
  it('guarda y recupera la entidad sin perder el detalle', () => {
    const detalle = componerDetalleEspera('Notaría Pérez', 'Copia simple de la escritura')
    expect(detalle).toBe('Esperamos a: Notaría Pérez\nCopia simple de la escritura')
    expect(leerDetalleEspera(detalle)).toEqual({
      esperamosA: 'Notaría Pérez',
      detalle: 'Copia simple de la escritura',
    })
  })

  it('mantiene compatibilidad con detalles antiguos y sugiere entidades', () => {
    expect(leerDetalleEspera('Texto anterior')).toEqual({
      esperamosA: null,
      detalle: 'Texto anterior',
    })
    expect(entidadSugerida('Esperando al cliente')).toBe('Cliente')
    expect(entidadSugerida('Decisión interna pendiente')).toBe('')
  })

  it('resume los eventos de inicio y revisión, ignorando otros eventos', () => {
    const history = historialEsperas([
      {
        event_type: 'waiting_review_due',
        payload: {},
        created_at: '2026-10-10',
        actor_id: null,
      },
      {
        event_type: 'status_changed',
        payload: {},
        created_at: '2026-10-09',
        actor_id: 'user-1',
      },
      {
        event_type: 'waiting_started',
        payload: { review_at: '2026-10-10T07:00:00Z', reason: 'Esperando a notaría' },
        created_at: '2026-10-01',
        actor_id: 'user-1',
      },
    ])
    expect(history.map((event) => event.tipo)).toEqual(['revision_llegada', 'inicio'])
    expect(history[1]).toMatchObject({
      revisarEn: '2026-10-10T07:00:00Z',
      motivo: 'Esperando a notaría',
      actorId: 'user-1',
    })
  })
})
