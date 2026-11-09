import { describe, expect, it } from 'vitest'

import { requiredDocumentsForContact } from './lead-document-requirements'

describe('requiredDocumentsForContact', () => {
  it('combines Lead requests and always includes identity and privacy', () => {
    expect(
      requiredDocumentsForContact(
        [
          { detalles: { documentacionSolicitada: ['Poder de representación', 'DNI/NIE'] } },
          { detalles: { documentacionSolicitada: ['Poder de representación', 'Escritura'] } },
        ],
        true,
      ),
    ).toEqual(['Protección de datos', 'Poder de representación', 'DNI/NIE', 'Escritura'])
  })

  it('does not apply Lead requirements to another contact relationship', () => {
    expect(
      requiredDocumentsForContact(
        [{ detalles: { documentacionSolicitada: ['Identificación'] } }],
        false,
      ),
    ).toEqual([])
  })
})
