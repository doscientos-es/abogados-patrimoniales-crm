import { describe, expect, it } from 'vitest'

import type { ContactRow } from '@/shared/infrastructure/supabase'

import { contactoFromRow } from './supabase-contactos'

describe('contactoFromRow', () => {
  it('preserva la referencia y las fechas sin formato para el listado operativo', () => {
    const contact = contactoFromRow({
      id: 'contact-1',
      firm_id: 'firm-1',
      reference: 'CT-0005',
      nature: 'person',
      relationship: 'client',
      status: 'active',
      display_name: 'Ana López',
      first_name: 'Ana',
      last_name: 'López',
      legal_name: null,
      tax_id: '12345678A',
      email: 'ana@example.com',
      phone: '600 000 000',
      source: 'Web',
      details: {},
      version: 1,
      created_by: null,
      updated_by: null,
      created_at: '2026-08-20T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
    } satisfies ContactRow)

    expect(contact).toMatchObject({
      referencia: 'CT-0005',
      creadoEn: '2026-08-20T12:00:00Z',
      modificadoEn: '2026-09-04T12:00:00Z',
      creado: '20/08/2026',
      modificado: '04/09/2026',
    })
  })
})
