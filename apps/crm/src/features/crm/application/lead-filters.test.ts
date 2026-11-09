import { describe, expect, it } from 'vitest'

import {
  ALL_LEAD_FILTER,
  EMPTY_LEAD_FILTER,
  filterLeads,
  UNASSIGNED_LEAD_FILTER,
} from './lead-filters'

const opportunity = (overrides = {}) =>
  ({
    id: 'lead-1',
    referencia: 'OP-001',
    contactoId: 'contact-1',
    titulo: 'Herencia familiar',
    area: '',
    fase: 'entry',
    subestado: 'Sin revisar',
    prioridad: 'Media',
    estadoOperativo: 'Debemos trabajo',
    origen: 'Formulario web',
    creada: '2026-08-01T09:00:00Z',
    actualizada: '2026-08-01T09:00:00Z',
    asignadoId: null,
    ...overrides,
  }) as never

const noFilters = {
  query: '',
  responsableId: ALL_LEAD_FILTER,
  fase: ALL_LEAD_FILTER,
  estadoOperativo: ALL_LEAD_FILTER,
  origen: ALL_LEAD_FILTER,
  prioridad: ALL_LEAD_FILTER,
}

describe('filterLeads', () => {
  it('combines text, owner, stage, status, source and priority filters using persistent fields', () => {
    const opportunities = [
      opportunity(),
      opportunity({
        id: 'lead-2',
        referencia: 'OP-002',
        contactoId: 'contact-2',
        titulo: 'División de cosa común',
        fase: 'quote',
        prioridad: 'Alta',
        estadoOperativo: '',
        origen: '',
        asignadoId: 'member-1',
      }),
    ]
    const contacts = new Map([
      ['contact-1', 'Elena Vargas'],
      ['contact-2', 'Jorge Landa'],
    ])

    expect(filterLeads(opportunities, contacts, { ...noFilters, query: 'elena' })).toHaveLength(1)
    expect(
      filterLeads(opportunities, contacts, {
        ...noFilters,
        responsableId: UNASSIGNED_LEAD_FILTER,
        fase: 'entry',
      }).map((item) => item.id),
    ).toEqual(['lead-1'])
    expect(
      filterLeads(opportunities, contacts, {
        ...noFilters,
        responsableId: 'member-1',
        fase: 'quote',
        estadoOperativo: EMPTY_LEAD_FILTER,
        origen: EMPTY_LEAD_FILTER,
        prioridad: 'Alta',
      }).map((item) => item.id),
    ).toEqual(['lead-2'])
  })
})
