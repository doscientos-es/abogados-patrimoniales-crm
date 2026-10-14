import { describe, expect, it } from 'vitest'

import {
  PARTICIPANT_TYPES,
  participantTypeFromRole,
  possibleDuplicates,
  reorderParticipants,
} from './participant-groups'

describe('participant types', () => {
  it('offers exactly the Infolex intervention types', () => {
    expect(PARTICIPANT_TYPES).toEqual([
      'Cliente',
      'Contrario',
      'Letrado',
      'Procurador',
      'Responsable',
      'Tercero',
      'Colaborador',
      'Colitigante',
      'Notario',
      'Perito',
      'Profesional',
      'Proveedor',
      'Empleado',
      'Arrendatario',
    ])
  })
  it('keeps legacy roles readable', () => {
    expect(participantTypeFromRole('Contrario · Demandado principal')).toEqual({
      tipo: 'Contrario',
      detalle: 'Demandado principal',
    })
    expect(participantTypeFromRole('Heredero').tipo).toBe('Cliente')
    expect(participantTypeFromRole('Abogado contrario').tipo).toBe('Letrado')
    expect(participantTypeFromRole('Perito').tipo).toBe('Perito')
    expect(participantTypeFromRole('Vecino').tipo).toBe('Tercero')
  })
})

describe('manual order', () => {
  const rows = [
    { id: 'a', orden: 0, creadoEn: '2026-01-01' },
    { id: 'b', orden: 0, creadoEn: '2026-01-02' },
    { id: 'c', orden: 0, creadoEn: '2026-01-03' },
  ]
  it('moves a row up and renumbers', () => {
    expect(reorderParticipants(rows, 'c', 'up')).toEqual([
      { id: 'a', orden: 10 },
      { id: 'c', orden: 20 },
      { id: 'b', orden: 30 },
    ])
  })
  it('does nothing at the edges', () => {
    expect(reorderParticipants(rows, 'a', 'up')).toEqual([])
    expect(reorderParticipants(rows, 'c', 'down')).toEqual([])
  })
})

describe('duplicates', () => {
  const contacts = [{ id: '1', nif: '12345678-Z', email: 'Ana@x.es' }]
  it('matches by normalised id or email', () => {
    expect(possibleDuplicates(contacts, '12345678z', '')).toHaveLength(1)
    expect(possibleDuplicates(contacts, '', ' ana@x.es ')).toHaveLength(1)
    expect(possibleDuplicates(contacts, '', '')).toHaveLength(0)
  })
})
