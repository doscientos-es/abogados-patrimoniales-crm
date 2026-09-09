import { describe, expect, it } from 'vitest'

import { buildDashboardMetrics } from './persistent-dashboard'

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
    origen: '',
    creada: '2026-08-01',
    actualizada: '2026-08-01',
    ...overrides,
  }) as never

const invoice = (overrides = {}) =>
  ({
    id: 'invoice-1',
    contactoId: 'contact-1',
    referencia: 'F-1',
    cliente: 'Cliente',
    asuntoId: 'case-1',
    asuntoReferencia: 'EX-1',
    concepto: 'Servicios',
    importeTotal: 1000,
    importeCobrado: 0,
    importePendiente: 1000,
    moneda: 'EUR',
    emision: '2026-08-01',
    ejercicio: 2026,
    estado: 'issued',
    ...overrides,
  }) as never

describe('buildDashboardMetrics', () => {
  it('derives daily work, commercial follow-up and collections from persistent records', () => {
    const metrics = buildDashboardMetrics(
      {
        tasks: [
          task({
            id: 'overdue',
            expedienteId: 'case-1',
            venceEn: '2026-08-04T09:00:00Z',
            critico: true,
          }),
          task({
            id: 'today-event',
            oportunidadId: 'opportunity-1',
            tipo: 'Evento',
            venceEn: '2026-08-05T14:00:00Z',
          }),
          task({ id: 'future-event', tipo: 'Evento', venceEn: '2026-08-08T09:00:00Z' }),
          task({ id: 'completed', estado: 'Completada', venceEn: '2026-08-01T09:00:00Z' }),
        ],
        opportunities: [
          opportunity({ id: 'opportunity-1', fase: 'entry' }),
          opportunity({ id: 'quote', fase: 'quote' }),
          opportunity({ id: 'validation', fase: 'validation' }),
          opportunity({ id: 'sent', fase: 'engagement' }),
          opportunity({ id: 'won', fase: 'won' }),
        ],
        cases: [
          { id: 'case-1', fechaCierre: null },
          { id: 'closed-case', fechaCierre: '2026-08-01' },
        ] as never,
        invoices: [invoice(), invoice({ id: 'paid', estado: 'paid', importePendiente: 0 })],
        onboardings: [
          { id: 'onboarding-1', fase: 'proforma' },
          { id: 'onboarding-2', fase: 'payment' },
        ] as never,
        activities: [],
      },
      new Date('2026-08-05T10:00:00Z').getTime(),
    )

    expect(metrics.openTasks).toHaveLength(3)
    expect(metrics.overdueTasks).toHaveLength(1)
    expect(metrics.immediateTasks.map((item) => item.id)).toEqual([
      'overdue',
      'today-event',
      'future-event',
    ])
    expect(metrics.todayEvents).toHaveLength(1)
    expect(metrics.upcomingEvents).toHaveLength(2)
    expect(metrics.criticalDeadlines).toHaveLength(1)
    expect(metrics.newLeads).toHaveLength(1)
    expect(metrics.leadsWithoutFollowUp.map((item) => item.id)).toEqual([
      'quote',
      'validation',
      'sent',
    ])
    expect(metrics.attentionOpportunities.map((item) => item.id)).toEqual([
      'quote',
      'validation',
      'sent',
      'opportunity-1',
    ])
    expect(metrics.preparationQuotes).toHaveLength(1)
    expect(metrics.validationQuotes).toHaveLength(1)
    expect(metrics.sentQuotes).toHaveLength(1)
    expect(metrics.pendingProformas).toHaveLength(1)
    expect(metrics.activeCases).toHaveLength(1)
    expect(metrics.casesWithOverdueTask.size).toBe(1)
    expect(metrics.pendingAmount).toBe(1000)
  })
})
