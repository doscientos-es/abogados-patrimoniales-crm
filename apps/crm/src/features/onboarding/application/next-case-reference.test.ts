import { describe, expect, it } from 'vitest'

import { siguienteReferenciaExpediente } from './next-case-reference'

describe('siguienteReferenciaExpediente', () => {
  it('estima el siguiente número a partir del mayor existente', () => {
    expect(siguienteReferenciaExpediente(['AP_9', 'AP_11', 'AP_10'])).toBe('AP_12')
  })

  it('inicia en uno cuando no hay expedientes', () => {
    expect(siguienteReferenciaExpediente([])).toBe('AP_1')
  })

  it('conserva el prefijo del expediente con el número más alto', () => {
    expect(siguienteReferenciaExpediente(['LEX-3', 'CASE-8', 'LEX-7'])).toBe('CASE-9')
  })
})
