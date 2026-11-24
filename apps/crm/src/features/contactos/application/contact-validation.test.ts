import { describe, expect, it } from 'vitest'

import { spanishDocumentWarning, validContactEmail } from './contact-validation'

describe('validación de datos de contacto', () => {
  it('comprueba DNI, NIE y CIF sin rechazar documentos extranjeros', () => {
    expect(spanishDocumentWarning('12345678Z')).toBeNull()
    expect(spanishDocumentWarning('12345678A')).toMatch(/DNI o NIE/)
    expect(spanishDocumentWarning('X1234567L')).toBeNull()
    expect(spanishDocumentWarning('X1234567A')).toMatch(/DNI o NIE/)
    expect(spanishDocumentWarning('B12345674')).toBeNull()
    expect(spanishDocumentWarning('B12345678')).toMatch(/CIF/)
    expect(spanishDocumentWarning('FR12345678901')).toBeNull()
  })

  it('exige dominio y TLD si se introduce un correo', () => {
    expect(validContactEmail('')).toBe(true)
    expect(validContactEmail('ana@ejemplo.es')).toBe(true)
    expect(validContactEmail('ana@ejemplo')).toBe(false)
    expect(validContactEmail('ana@ejemplo.')).toBe(false)
    expect(validContactEmail('ana@@ejemplo.es')).toBe(false)
  })
})