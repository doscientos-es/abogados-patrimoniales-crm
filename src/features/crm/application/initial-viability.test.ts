import { describe, expect, it } from 'vitest'

import { permitePrimeraCita, VIABILIDAD_OPCIONES } from './initial-viability'

describe('viabilidad inicial', () => {
  it('allows booking for apt Leads and legacy Leads without a classification', () => {
    expect(permitePrimeraCita('apto')).toBe(true)
    expect(permitePrimeraCita(undefined)).toBe(true)
  })

  it('blocks booking while pending or when the Lead is not suitable', () => {
    expect(permitePrimeraCita('pendiente')).toBe(false)
    expect(permitePrimeraCita('no_apto')).toBe(false)
    expect(VIABILIDAD_OPCIONES).toHaveLength(3)
  })
})
