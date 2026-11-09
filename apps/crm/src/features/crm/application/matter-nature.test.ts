import { describe, expect, it } from 'vitest'

import { fijarNaturaleza, leerNaturaleza, naturalezaDefinitiva } from './matter-nature'

describe('naturaleza del asunto', () => {
  it('keeps one current value and audits subsequent changes with reason', () => {
    const first = fijarNaturaleza({ ref: 'L-1' }, 'pendiente', 'user-1', '2026-10-13T09:00:00Z')
    expect(leerNaturaleza(first)).toMatchObject({
      valor: 'pendiente',
      historial: [{ anterior: null }],
    })
    expect(() => fijarNaturaleza(first, 'judicial', 'user-1', '2026-10-14T09:00:00Z')).toThrow(
      /motivo/i,
    )
    const changed = fijarNaturaleza(
      first,
      'judicial',
      'user-2',
      '2026-10-14T09:00:00Z',
      'Demanda presentada',
    )
    expect(leerNaturaleza(changed)).toMatchObject({
      valor: 'judicial',
      historial: [{ anterior: null }, { anterior: 'pendiente', motivo: 'Demanda presentada' }],
    })
    expect(changed).toMatchObject({ ref: 'L-1' })
  })

  it('only judicial and extrajudicial are definitive', () => {
    expect(naturalezaDefinitiva('judicial')).toBe(true)
    expect(naturalezaDefinitiva('pendiente')).toBe(false)
    expect(naturalezaDefinitiva(null)).toBe(false)
  })
})
