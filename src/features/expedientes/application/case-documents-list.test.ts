import { describe, expect, it } from 'vitest'

import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { documentCategories, filterDocuments, formatFileSize } from './case-documents-list'

const doc = (patch: Partial<CaseDocumentRow>) =>
  ({
    id: 'd',
    original_name: 'archivo.pdf',
    category: 'Escritos',
    created_at: '2026-10-01T10:00:00Z',
    ...patch,
  }) as CaseDocumentRow

const documents = [
  doc({
    id: '1',
    original_name: 'Demanda inicial.pdf',
    category: 'Escritos',
    created_at: '2026-10-01T10:00:00Z',
  }),
  doc({
    id: '2',
    original_name: 'Poder notarial.pdf',
    category: 'Poderes',
    created_at: '2026-10-05T10:00:00Z',
  }),
  doc({
    id: '3',
    original_name: 'scan0001.pdf',
    category: 'Escritos',
    created_at: '2026-10-03T10:00:00Z',
  }),
]
const same = (document: CaseDocumentRow) => document.original_name

describe('lista de documentos del expediente', () => {
  it('ordena por recientes y filtra por categoría', () => {
    const ids = (list: CaseDocumentRow[]) => list.map((item) => item.id)
    expect(
      ids(
        filterDocuments(documents, {
          query: '',
          category: 'all',
          sort: 'recent',
          displayName: same,
        }),
      ),
    ).toEqual(['2', '3', '1'])
    expect(
      ids(
        filterDocuments(documents, {
          query: '',
          category: 'Escritos',
          sort: 'recent',
          displayName: same,
        }),
      ),
    ).toEqual(['3', '1'])
  })

  it('busca sin distinguir tildes ni mayúsculas, también por el nombre normalizado', () => {
    const byDisplay = (document: CaseDocumentRow) =>
      document.id === '3' ? 'SENTENCIA - Primera instancia' : document.original_name
    const found = filterDocuments(documents, {
      query: 'sentencia',
      category: 'all',
      sort: 'name',
      displayName: byDisplay,
    })
    expect(found.map((item) => item.id)).toEqual(['3'])
    expect(
      filterDocuments(documents, {
        query: 'PODER',
        category: 'all',
        sort: 'name',
        displayName: same,
      }),
    ).toHaveLength(1)
  })

  it('lista categorías únicas y formatea tamaños', () => {
    expect(documentCategories(documents)).toEqual(['Escritos', 'Poderes'])
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatFileSize(-1)).toBe('—')
  })
})
