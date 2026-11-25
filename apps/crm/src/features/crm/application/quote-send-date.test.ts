import { describe, expect, it } from 'vitest'

import { fechaEnvioEs } from './quote-editor'

describe('fechas de presupuesto', () => {
  it('formatea fechas sin hora sin desplazar el día por zona horaria', () => {
    expect(fechaEnvioEs('2026-11-24')).toBe('24/11/2026')
    expect(fechaEnvioEs('')).toBe('')
  })

  it('conserva la hora local cuando existe', () => {
    expect(fechaEnvioEs(new Date(2026, 10, 24, 10, 5).toISOString())).toBe(
      '24/11/2026 a las 10:05',
    )
  })
})