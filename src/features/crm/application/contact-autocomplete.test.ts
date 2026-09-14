import { describe, expect, it } from 'vitest'

import { contactosParaAutocompletado } from './contact-autocomplete'

const contact = (id: string, overrides: Record<string, string> = {}) => ({
  id,
  nombre: `Contacto ${id}`,
  apellidos: '',
  razonSocial: '',
  nif: '',
  telefono: '',
  email: '',
  tipoPersona: 'Persona física' as const,
  ...overrides,
})

describe('contactosParaAutocompletado', () => {
  it('encuentra coincidencias por datos de contacto sin distinguir tildes', () => {
    const contacts = [
      contact('contact-1', { nombre: 'María', email: 'maria@ejemplo.es' }),
      contact('contact-2', { razonSocial: 'Asesoría López', nif: 'B12345678' }),
    ]

    expect(contactosParaAutocompletado(contacts, 'maria')).toEqual([contacts[0]])
    expect(contactosParaAutocompletado(contacts, 'b123')).toEqual([contacts[1]])
  })

  it('excluye contactos y limita los resultados renderizados', () => {
    const contacts = Array.from({ length: 60 }, (_, index) => contact(`contact-${index}`))

    const results = contactosParaAutocompletado(contacts, '', ['contact-0'])

    expect(results).toHaveLength(50)
    expect(results.some((item) => item.id === 'contact-0')).toBe(false)
  })
})
