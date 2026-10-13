import { describe, expect, it } from 'vitest'

import { contarNotas, estaPospuesta, filtrarNotas, pendienteDeLectura } from './note-filters'
import type { NotaInterna } from './note-types'

function note(id: string, overrides: Partial<NotaInterna> = {}): NotaInterna {
  return {
    id,
    ambito: 'persona',
    contenido: 'Documentación pendiente',
    origen: { tipo: 'persona', id: 'contact-1', etiqueta: 'Contacto principal' },
    contactos: ['contact-1'],
    autor: 'Abogada',
    creada: '13/10/2026 09:00',
    estado: 'activa',
    destacada: false,
    critica: false,
    requiereConfirmacion: false,
    confirmaciones: [],
    vigencia: 'permanente',
    alVencer: 'archivar',
    pendienteRevision: false,
    disparadores: [],
    visibilidad: 'equipo',
    autorizados: [],
    conversiones: [],
    historial: [],
    ...overrides,
  }
}

describe('filtros y contadores de notas', () => {
  it('filtra por estado, contacto, texto y confirmación pendiente', () => {
    const notes = [
      note('new', {
        titulo: 'Llamar a notaría',
        requiereConfirmacion: true,
        creada: '13/10/2026 11:00',
      }),
      note('old', { estado: 'resuelta', contactos: [], creada: '12/10/2026 09:00' }),
    ]

    expect(
      filtrarNotas(
        notes,
        { estado: 'activa', pendientesLectura: true, texto: 'NOTARÍA' },
        'u1',
      ).map((item) => item.id),
    ).toEqual(['new'])
    expect(filtrarNotas(notes, { contactoId: 'other' }, 'u1')).toEqual([])
  })

  it('cuenta estados y solo considera lectura pendiente con usuario identificado', () => {
    const activeNote = note('active', {
      requiereConfirmacion: true,
      destacada: true,
      critica: true,
    })
    const notes = [
      activeNote,
      note('resolved', { estado: 'resuelta' }),
      note('archived', { estado: 'archivada' }),
    ]
    expect(pendienteDeLectura(activeNote, undefined)).toBe(false)
    expect(pendienteDeLectura(activeNote, 'user-1')).toBe(true)
    expect(contarNotas(notes, 'user-1')).toMatchObject({
      total: 3,
      activas: 1,
      resueltas: 1,
      archivadas: 1,
      destacadas: 1,
      criticas: 1,
      pendientesLectura: 1,
    })
  })

  it('interpreta la fecha pospuesta como dd/mm/yyyy', () => {
    const today = new Date('2026-10-13T12:00:00Z')
    expect(estaPospuesta(note('future', { posponerHasta: '14/10/2026' }), today)).toBe(true)
    expect(estaPospuesta(note('past', { posponerHasta: '12/10/2026' }), today)).toBe(false)
  })
})
