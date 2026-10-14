import { describe, expect, it } from 'vitest'

import { columnaOnboarding, hitoOnboarding } from './onboarding-workflow'

describe('onboarding milestones', () => {
  it('shows payment confirmed but no case as still awaiting casework', () => {
    expect(
      hitoOnboarding({
        expedienteId: null,
        pagoConfirmado: '2026-10-02',
        proformaEnviada: '2026-10-01',
      }),
    ).toBe('pago_sin_expediente')
    expect(
      columnaOnboarding({
        expedienteId: null,
        cambioFase: '2026-10-02',
        pagoConfirmado: '2026-10-02',
      }),
    ).toBe('esperando_provision')
  })

  it('keeps a case opened without provision in recent cases until payment is confirmed', () => {
    const item = { expedienteId: 'case-1', cambioFase: '2026-01-01', pagoConfirmado: null }
    expect(columnaOnboarding(item, new Date('2026-10-10T12:00:00'))).toBe('expediente_abierto')
    expect(hitoOnboarding({ ...item, proformaEnviada: '2026-01-01' })).toBe('expediente_sin_pago')
  })

  it('moves paid cases to completed after the recent-case window', () => {
    expect(
      columnaOnboarding(
        { expedienteId: 'case-1', cambioFase: '2026-09-01', pagoConfirmado: '2026-09-01' },
        new Date('2026-10-01T12:00:00'),
      ),
    ).toBe('completados')
  })
})
