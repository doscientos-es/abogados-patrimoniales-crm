import { describe, expect, it } from 'vitest'

import { conDecision, instruccionesPresupuesto, tareaDecision } from './qualification-decision'

describe('decisiones de cualificación', () => {
  it('records the decision history and reads current quote-preparation instructions', () => {
    const details = conDecision(
      {},
      {
        tipo: 'preparar_presupuesto',
        fecha: '2026-10-13',
        motivo: 'Herencia',
        detalle: 'Fases separadas',
        decididoPor: 'user-1',
        fechaRevision: '2026-11-12',
      },
    )
    expect(instruccionesPresupuesto(details)).toEqual({
      servicio: 'Herencia',
      instrucciones: 'Fases separadas',
      decididoPor: 'user-1',
      fechaObjetivo: '2026-11-12',
    })
    expect(
      tareaDecision({
        tipo: 'en_analisis',
        motivo: 'Viabilidad jurídica',
        detalle: 'Revisar contratos',
        oportunidadId: 'lead-1',
        responsableId: 'user-2',
        fecha: '2026-11-12',
      }),
    ).toMatchObject({
      titulo: 'ANALIZAR VIABILIDAD DEL ASUNTO',
      oportunidadId: 'lead-1',
      asignadoId: 'user-2',
    })
  })

  it('does not show instructions for another current decision', () => {
    expect(
      instruccionesPresupuesto(
        conDecision(
          {},
          {
            tipo: 'en_analisis',
            fecha: 'x',
            motivo: 'm',
            detalle: 'd',
          },
        ),
      ),
    ).toBeNull()
  })
})
