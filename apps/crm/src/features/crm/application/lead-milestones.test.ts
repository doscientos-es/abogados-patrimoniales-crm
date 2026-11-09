import { describe, expect, it } from 'vitest'

import {
  debeAbrirCasework,
  esConflictoIdempotente,
  HitoFueraDeOrden,
  pasosHito,
} from './lead-milestones'

describe('avance del Lead por hitos', () => {
  it('mapea los hitos hacia delante por las fases existentes', () => {
    expect(pasosHito('entry', 'viabilidad_apta').map((step) => step.fase)).toEqual([
      'qualification',
      'first_meeting',
    ])
    expect(pasosHito('first_meeting', 'presupuesto_solicitado').map((step) => step.fase)).toEqual([
      'quote',
    ])
    expect(pasosHito('quote', 'revision_solicitada')[0]).toMatchObject({
      fase: 'validation',
      subestado: 'En revisión',
    })
  })

  it('is idempotent for repeated/out-of-order milestones and rejects closed Leads', () => {
    expect(pasosHito('quote', 'presupuesto_solicitado')).toEqual([])
    expect(pasosHito('engagement', 'presupuesto_solicitado')).toEqual([])
    expect(() => pasosHito('lost', 'viabilidad_apta')).toThrow(HitoFueraDeOrden)
    expect(esConflictoIdempotente('The opportunity is already in this stage')).toBe(true)
  })

  it('opens casework only after confirmed payment, with nature and no existing case', () => {
    const input = {
      faseOnboarding: 'payment' as const,
      pagoConfirmado: '2026-10-08',
      expedienteId: null,
    }
    expect(debeAbrirCasework({ ...input, naturaleza: 'judicial' })).toBe(true)
    expect(
      debeAbrirCasework({
        ...input,
        faseOnboarding: 'proforma',
        pagoConfirmado: null,
        naturaleza: 'judicial',
      }),
    ).toBe(false)
    expect(debeAbrirCasework({ ...input, expedienteId: 'case-1', naturaleza: 'judicial' })).toBe(
      false,
    )
    expect(debeAbrirCasework({ ...input, naturaleza: null })).toBe(false)
  })
})
