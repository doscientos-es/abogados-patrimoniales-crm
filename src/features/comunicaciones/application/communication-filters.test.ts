import { describe, expect, it } from 'vitest'

import type { ComunicacionOportunidad } from '@/features/crm/application/opportunity-types'

import { EMPTY_COMMUNICATION_FILTERS, filterLeadCommunications } from './communication-filters'

const communication = (
  overrides: Partial<ComunicacionOportunidad> = {},
): ComunicacionOportunidad => ({
  id: 'communication-1',
  leadId: 'lead-1',
  leadReferencia: 'OP-2026-0001',
  leadTitulo: 'Herencia de José',
  tipo: 'phone_call',
  resumen: 'Consulta sobre la legítima.',
  creadoEn: '2026-09-15T12:00:00',
  ...overrides,
})

describe('filterLeadCommunications', () => {
  it('combines communication type, inclusive date range, and accent-insensitive search', () => {
    const records = [
      communication(),
      communication({
        id: 'meeting-1',
        tipo: 'meeting',
        creadoEn: '2026-09-15T18:00:00',
      }),
      communication({ id: 'older-1', creadoEn: '2026-09-14T12:00:00' }),
    ]

    const filtered = filterLeadCommunications(records, {
      ...EMPTY_COMMUNICATION_FILTERS,
      tipo: 'phone_call',
      desde: '2026-09-15',
      hasta: '2026-09-15',
      busqueda: 'jose',
    })

    expect(filtered.map((record) => record.id)).toEqual(['communication-1'])
  })

  it('matches Lead references and rejects malformed date filters', () => {
    const records = [communication({ leadTitulo: 'Consulta civil' })]

    expect(
      filterLeadCommunications(records, {
        ...EMPTY_COMMUNICATION_FILTERS,
        busqueda: 'op-2026-0001',
      }),
    ).toEqual(records)
    expect(
      filterLeadCommunications(records, {
        ...EMPTY_COMMUNICATION_FILTERS,
        desde: '2026-02-30',
      }),
    ).toEqual([])
  })
})
