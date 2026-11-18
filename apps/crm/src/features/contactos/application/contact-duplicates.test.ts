import { describe, expect, it } from 'vitest'

import { findContactDuplicates, type DuplicateContactCandidate } from './contact-duplicates'

describe('findContactDuplicates', () => {
  const contact: DuplicateContactCandidate = {
    id: 'contact-1',
    name: 'Ana García',
    taxId: '12345678Z',
    email: 'ana@example.es',
    alternateEmail: 'ana.alternativo@example.es',
    phone: '+34 600 123 456',
    alternatePhone: '911 123 456',
  }

  it('matches normalized document, primary and alternate email, and both phone numbers', () => {
    const matches = findContactDuplicates([contact], {
      documento: '1234 5678-z',
      email: ' ANA@EXAMPLE.ES ',
      email2: 'ana.alternativo@example.es',
      telefono: '0034 600123456',
      telefono2: '911123456',
    })

    expect(matches).toEqual([
      {
        contact,
        fields: ['documento', 'email', 'email2', 'telefono', 'telefono2'],
      },
    ])
  })

  it('ignores empty values and returns no matches for different contact details', () => {
    expect(
      findContactDuplicates([contact], {
        documento: '',
        email: '',
        email2: '',
        telefono: '',
        telefono2: '',
      }),
    ).toEqual([])
    expect(
      findContactDuplicates([contact], {
        documento: '87654321X',
        email: 'other@example.es',
        email2: '',
        telefono: '600123457',
        telefono2: '',
      }),
    ).toEqual([])
  })
})
