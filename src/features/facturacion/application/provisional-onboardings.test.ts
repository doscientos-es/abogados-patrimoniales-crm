import { describe, expect, it } from 'vitest'

import {
  etiquetaEstadoEconomicoProvisional,
  resumenEconomicoProvisional,
} from './provisional-onboardings'

const onboarding = (overrides = {}) => ({
  id: 'onb-1', referencia: 'ONB-2026-00001', contactoId: 'contact-1', oportunidadId: null,
  expedienteId: null, asunto: 'Constitución societaria', fase: 'proforma',
  cambioFase: '2026-09-03', presupuestoReferencia: 'PR-2026-001', importePresupuesto: 2000,
  proformaEnviada: '2026-09-03', pagoConfirmado: null, inicioProgramado: null,
  inicioRealizado: null, responsableId: null, siguienteAccion: '', modalidad: 'pending', version: 1,
  ...overrides,
}) as never

describe('resumenEconomicoProvisional', () => {
  it('includes only manual proforma and payment confirmations', () => {
    const summary = resumenEconomicoProvisional([
      onboarding(),
      onboarding({ id: 'onb-2', fase: 'payment', pagoConfirmado: '2026-09-05' }),
      onboarding({ id: 'onb-3', fase: 'formal_start' }),
      onboarding({ id: 'onb-4', fase: 'completed' }),
    ])

    expect(summary.items.map((item) => item.id)).toEqual(['onb-2', 'onb-1'])
    expect(summary.proformasPendientes).toHaveLength(1)
    expect(summary.pagosConfirmados).toHaveLength(1)
  })

  it('uses clear labels without claiming a real invoice or collection', () => {
    expect(etiquetaEstadoEconomicoProvisional('proforma_sent')).toContain('pendiente')
    expect(etiquetaEstadoEconomicoProvisional('payment_confirmed')).toBe('Pago confirmado manualmente')
  })
})