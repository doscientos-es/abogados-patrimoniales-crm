import { describe, expect, it } from 'vitest'

import {
  buildDisplayName,
  sanitizeSuggestion,
  validateTypeName,
  type RawAiSuggestion,
} from './document-naming'

const catalog = [{ id: 'demand-id', name: 'DEMANDA' }]
const suggestion: RawAiSuggestion = {
  typeName: 'demanda',
  confidence: 0.9,
  description: 'Demanda inicial 2026-01-05 FINAL',
  documentDate: '2026-01-05',
  parties: [' Ana '],
  court: 'Juzgado de Bilbao',
  procedureNumber: '10/2026',
}

describe('document naming', () => {
  it('normalizes the display name but keeps the original extension', () => {
    expect(buildDisplayName('demanda', 'Demanda inicial 2026-01-05 FINAL', 'original.PDF')).toBe(
      'DEMANDA - Demanda inicial.pdf',
    )
  })

  it('keeps unidentified documents confirmable without losing the original extension', () => {
    expect(buildDisplayName(null, '', 'original.PDF')).toBe('SIN IDENTIFICAR.pdf')
  })

  it('only accepts a catalog type above the confidence threshold', () => {
    expect(sanitizeSuggestion(suggestion, catalog).typeId).toBe('demand-id')
    expect(sanitizeSuggestion({ ...suggestion, confidence: 0.4 }, catalog)).toMatchObject({
      typeId: null,
      typeName: null,
      description: '',
    })
  })

  it('rejects duplicate and reserved document types', () => {
    expect(validateTypeName(' demanda ', catalog)).toContain('Ya existe')
    expect(validateTypeName('sin identificar', [])).toContain('reservado')
  })
})