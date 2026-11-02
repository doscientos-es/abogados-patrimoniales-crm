import { describe, expect, it } from 'vitest'

import { auFichaUrl, formatAuReference, parseAuReference } from './physical-originals'

describe('Archivo único', () => {
  it('formats with six digits and no upper limit', () => {
    expect(formatAuReference(1)).toBe('AU-000001')
    expect(formatAuReference(1234567)).toBe('AU-1234567')
    expect(() => formatAuReference(0)).toThrow()
  })
  it('recognises hand-typed variants in the search box', () => {
    expect(parseAuReference('au 12')).toBe('AU-000012')
    expect(parseAuReference('AU000002')).toBe('AU-000002')
    expect(parseAuReference('AU-0')).toBeNull()
    expect(parseAuReference('herencia')).toBeNull()
  })
  it('the QR only holds the record page address', () => {
    expect(auFichaUrl('https://x.app/', 'AU-000007')).toBe('https://x.app/archivo-unico/AU-000007')
  })
})
