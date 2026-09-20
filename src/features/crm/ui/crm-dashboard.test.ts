import { describe, expect, it } from 'vitest'

import { buildCrmMetrics } from './crm-dashboard'

const task = (overrides = {}) =>
  ({
    id: 'task-1',
    expedienteId: null,
    oportunidadId: null,
    lineaId: null,
    tipo: 'Tarea',
    titulo: 'Tarea',
    descripcion: '',
    estado: 'Pendiente',
    prioridad: 'Media',
    venceEn: null,
    recordarEn: null,
    clasePlazo: null,
    validacion: 'No aplica',
    fuentePlazo: '',
    notaValidacion: '',
    validadoPor: null,
    validadoEn: null,
    critico: false,
    asignadoId: null,
    version: 1,
    ...overrides,
  }) as never

const opportunity = (overrides = {}) =>
  ({
    id: 'opportunity-1',
    referencia: 'OP-1',
    contactoId: 'contact-1',
    titulo: 'Lead',
    area: '',
    fase: 'entry',
    subestado: '',
    prioridad: 'Media',
    estadoOperativo: '',
    origen: 'Formulario web',
    creada: '2026-08-01',
    actualizada: '2026-08-05T09:00:00Z',
    ...overrides,
  }) as never

describe('buildCrmMetrics', () => {
  it('derives the commercial funnel, follow-up, alerts and conversions from stored Leads', () => {
    const metrics = buildCrmMetrics(
      {
        opportunities: [
          opportunity({ id: 'entry' }),
          opportunity({ id: 'meeting', fase: 'first_meeting' }),
          opportunity({ id: 'quote', fase: 'quote', actualizada: '2026-07-10T09:00:00Z' }),
          opportunity({ id: 'review', fase: 'validation', subestado: 'Sin revisar' }),
          opportunity({ id: 'sent', fase: 'engagement' }),
          opportunity({ id: 'won', fase: 'won' }),
          opportunity({ id: 'lost', fase: 'lost' }),
        ],
        tasks: [
          task({ id: 'entry-action', oportunidadId: 'entry', esSiguienteAccion: true }),
          task({
            id: 'meeting-action',
            oportunidadId: 'meeting',
            tipo: 'Evento',
            esSiguienteAccion: true,
            venceEn: '2026-08-07T09:00:00Z',
          }),
          task({
            id: 'quote-action',
            oportunidadId: 'quote',
            venceEn: '2026-08-02T09:00:00Z',
            critico: true,
            esSiguienteAccion: true,
          }),
        ],
      },
      new Date('2026-08-05T10:00:00Z').getTime(),
    )

    expect(metrics.activeOpportunities).toHaveLength(5)
    expect(metrics.opportunitiesWithUpcomingMeeting).toHaveLength(1)
    expect(metrics.pendingQuotes).toHaveLength(2)
    expect(metrics.withoutAction.map((item) => item.id)).toEqual(['review', 'sent'])
    expect(metrics.staleOpportunities.map((item) => item.id)).toEqual(['quote'])
    expect(metrics.pendingReview.map((item) => item.id)).toEqual(['review'])
    expect(metrics.wonOpportunities).toHaveLength(1)
    expect(metrics.lostOpportunities).toHaveLength(1)
    expect(metrics.funnel.map((item) => item.value)).toEqual([7, 5, 5, 4, 3, 1])
    const initialFunnelCount = metrics.funnel.at(0)?.value ?? 1
    expect(
      metrics.funnel.map((item) => Math.round((item.value / initialFunnelCount) * 100)),
    ).toEqual([100, 71, 71, 57, 43, 14])
    expect(metrics.conversion).toBe(14)
    expect(metrics.quoteConversion).toBe(25)
    expect(metrics.alerts.find((item) => item.opportunity.id === 'quote')?.messages).toEqual([
      'Sin actualizar 26 días',
      'Acción vencida',
      'Tarea crítica',
    ])
  })
})
