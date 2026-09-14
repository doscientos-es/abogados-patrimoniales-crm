import { describe, expect, it } from 'vitest'

import { buildInformesMetrics } from './informes-dashboard'

describe('buildInformesMetrics', () => {
  it('combines economic, portfolio and operational information for the selected year', () => {
    const metrics = buildInformesMetrics(
      {
        cases: [{ id: 'case-1', area: 'Sucesiones', fechaCierre: null }],
        opportunities: [
          { id: 'lead-1', fase: 'won' },
          { id: 'lead-2', fase: 'entry' },
        ],
        tasks: [
          { id: 'done', estado: 'Completada', venceEn: null },
          { id: 'late', estado: 'Pendiente', venceEn: '2026-08-01' },
        ],
        invoices: [
          {
            id: 'invoice-1',
            estado: 'issued',
            ejercicio: 2026,
            emision: '2026-08-03',
            importeTotal: 1200,
            importePendiente: 400,
            cobros: [{ fecha: '2026-08-04', importe: 800 }],
          },
        ],
      } as never,
      new Date('2026-08-10T10:00:00Z'),
    )

    expect(metrics.issued).toBe(1200)
    expect(metrics.collected).toBe(800)
    expect(metrics.pending).toBe(400)
    expect(metrics.distribution).toMatchObject([{ label: 'Sucesiones', value: 1 }])
    expect(metrics.conversion).toBe(50)
    expect(metrics.execution).toBe(50)
    expect(metrics.overdueTasks).toHaveLength(1)
    expect(metrics.trend.at(-1)).toMatchObject({ issued: 1200, collected: 800 })
  })

  it('keeps the economic series empty when there is no financial activity', () => {
    const metrics = buildInformesMetrics(
      { cases: [], invoices: [], opportunities: [], tasks: [] },
      new Date('2026-08-10T10:00:00Z'),
    )

    expect(metrics.trend).toHaveLength(6)
    expect(metrics.trend.every((point) => point.issued === 0 && point.collected === 0)).toBe(true)
    expect(metrics.issued).toBe(0)
    expect(metrics.collected).toBe(0)
  })
})
