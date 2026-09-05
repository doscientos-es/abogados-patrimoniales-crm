import { describe, expect, it } from 'vitest'

import { valorFechaParaInput } from './contact-form-values'

describe('valorFechaParaInput', () => {
  it.each([
    ['2026-09-05', '2026-09-05'],
    ['2026-09-05T09:30:00Z', '2026-09-05'],
    ['05/09/2026', '2026-09-05'],
    [undefined, ''],
    ['fecha no válida', ''],
  ])('normaliza %s para un input de fecha', (entrada, esperada) => {
    expect(valorFechaParaInput(entrada)).toBe(esperada)
  })
})