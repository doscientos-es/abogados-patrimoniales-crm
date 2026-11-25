import { describe, expect, it } from 'vitest'

import { oportunidadFromRow } from './supabase-oportunidades'

describe('oportunidadFromRow', () => {
  it('preserves qualification details while exposing the commercial summary', () => {
    const item = oportunidadFromRow({
      id: 'lead-1',
      firm_id: 'firm-1',
      reference: 'OP-001',
      contact_id: 'contact-1',
      title: 'Herencia',
      area: 'Sucesiones',
      stage: 'qualification',
      substage: 'Pendiente',
      priority: 'high',
      operational_status: 'En revisión',
      source: 'Web',
      description: 'Consulta',
      assigned_to: null,
      estimated_amount: 1200,
      details: {
        probabilidad: 65,
        fechaObjetivo: '2026-10-20',
        informacionInicial: { queSolicita: 'Orientación' },
      },
      version: 3,
      created_by: null,
      updated_by: null,
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-02T10:00:00Z',
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })

    expect(item).toMatchObject({
      probabilidad: 65,
      fechaObjetivo: '2026-10-20',
      detalles: { informacionInicial: { queSolicita: 'Orientación' } },
    })
  })

  it('exposes the resolved review label without changing the stored substage', () => {
    const item = oportunidadFromRow({
      id: 'lead-1',
      firm_id: 'firm-1',
      reference: 'OP-001',
      contact_id: 'contact-1',
      title: 'Herencia',
      area: '',
      stage: 'validation',
      substage: 'En revisión',
      priority: 'medium',
      operational_status: '',
      source: '',
      description: '',
      assigned_to: null,
      estimated_amount: null,
      details: {
        presupuesto: { editor: { actual: { version: 1, lineas: [], estado: 'validado' } } },
      },
      version: 1,
      created_by: null,
      updated_by: null,
      created_at: '',
      updated_at: '',
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    expect(item.subestado).toBe('En revisión')
    expect(item.subestadoMostrado).toBe('Presupuesto validado')
  })
})
