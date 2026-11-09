import { describe, expect, it } from 'vitest'

import { desglosar, importePorPct, nuevaProforma, problemasProforma } from './proforma'

describe('Proforma desde presupuesto', () => {
  const base = {
    presupuestoReferencia: 'PR-1',
    version: 1,
    presBaseCents: 180000,
    presTotalCents: 217800,
    hoy: '2026-10-08',
    por: 'u',
  }

  it('por defecto propone el 60 % del total', () => {
    const proforma = nuevaProforma(base)
    expect(proforma.pct).toBe(60)
    expect(proforma.totalCents).toBe(130680)
    expect(proforma.baseCents + proforma.ivaCents).toBe(130680)
    expect(proforma.baseCents).toBe(108000)
  })

  it('el porcentaje es cambiable', () => {
    expect(importePorPct(217800, 50)).toBe(108900)
    expect(importePorPct(217800, 100)).toBe(217800)
  })

  it('importe editado a mano mantiene la proporción de IVA', () => {
    expect(desglosar(121000, 100000, 121000)).toEqual({
      baseCents: 100000,
      ivaCents: 21000,
      totalCents: 121000,
    })
  })

  it('no permite importe 0 ni superior al presupuesto', () => {
    const proforma = nuevaProforma(base)
    expect(problemasProforma({ ...proforma, totalCents: 0 })).toContain(
      'El importe debe ser mayor que 0.',
    )
    expect(problemasProforma({ ...proforma, totalCents: 300000 })).toContain(
      'El importe no puede superar el total del presupuesto.',
    )
    expect(problemasProforma(proforma)).toEqual([])
  })
})
