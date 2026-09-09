import { describe, expect, it } from 'vitest'

import {
  FASE_ONBOARDING_LABEL,
  PROXIMO_PASO,
  diasEnFase,
  esOnboardingActivo,
} from './onboarding-workflow'

describe('workflow de onboarding', () => {
  it('mantiene el orden operativo y el siguiente paso por cada fase', () => {
    expect(FASE_ONBOARDING_LABEL.proforma).toBe('Proforma enviada')
    expect(PROXIMO_PASO.payment).toBe('Contactar con el cliente para el inicio formal')
    expect(PROXIMO_PASO.completed).toBe('Abrir expediente')
  })

  it('solo considera activos los onboardings aún no completados', () => {
    expect(esOnboardingActivo({ fase: 'formal_start' })).toBe(true)
    expect(esOnboardingActivo({ fase: 'completed' })).toBe(false)
  })

  it('calcula días en fase y no genera valores negativos ni fechas inválidas', () => {
    const now = new Date('2026-09-07T12:00:00')
    expect(diasEnFase('2026-09-04', now)).toBe(3)
    expect(diasEnFase('2026-09-08', now)).toBe(0)
    expect(diasEnFase('fecha-inválida', now)).toBeNull()
  })
})
