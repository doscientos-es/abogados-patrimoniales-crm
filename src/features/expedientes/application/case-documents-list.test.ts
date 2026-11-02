import { describe, expect, it } from 'vitest'

import { validateCaseDocumentFile } from '@/features/expedientes/infrastructure/case-economic-documents'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import {
  documentCategories,
  filterDocuments,
  folderOptions,
  folderPath,
  formatFileSize,
} from './case-documents-list'

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

  it('valida los archivos a subir con las mismas reglas que el gestor documental', () => {
    const file = (name: string, type: string, size: number) =>
      ({ name, type, size }) as unknown as File
    expect(validateCaseDocumentFile(file('a.pdf', 'application/pdf', 1000))).toBeNull()
    expect(validateCaseDocumentFile(file('a.exe', 'application/x-msdownload', 1000))).toMatch(
      /formato/,
    )
    expect(
      validateCaseDocumentFile(file('grande.pdf', 'application/pdf', 26 * 1024 * 1024)),
    ).toMatch(/25 MB/)
    expect(validateCaseDocumentFile(file('vacio.pdf', 'application/pdf', 0))).toMatch(/vacío/)
  })

  it('construye la ruta de carpetas anidadas y resiste ciclos', () => {
    const folders = [
      { id: 'a', parent_id: null, name: 'Escritos' },
      { id: 'b', parent_id: 'a', name: 'Demanda' },
      { id: 'x', parent_id: 'y', name: 'X' },
      { id: 'y', parent_id: 'x', name: 'Y' },
    ]
    expect(folderPath(folders, 'b')).toBe('Escritos / Demanda')
    expect(folderPath(folders, null)).toBe('')
    expect(folderPath(folders, 'x')).toBe('Y / X')
    expect(folderOptions(folders).map((option) => option.path)).toEqual([
      'Escritos',
      'Escritos / Demanda',
      'X / Y',
      'Y / X',
    ])
  })

  it('filtra por carpeta, sin carpeta o todas', () => {
    const inFolder = [
      doc({ id: '1', folder_id: 'a' }),
      doc({ id: '2', folder_id: null }),
      doc({ id: '3', folder_id: 'b' }),
    ]
    const ids = (folder: string) =>
      filterDocuments(inFolder, { query: '', category: 'all', folder, sort: 'recent', displayName: same }).map((item) => item.id).sort()
    expect(ids('all')).toEqual(['1', '2', '3'])
    expect(ids('none')).toEqual(['2'])
    expect(ids('a')).toEqual(['1'])
  })

  it('lista categorías únicas y formatea tamaños', () => {
    expect(documentCategories(documents)).toEqual(['Escritos', 'Poderes'])
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatFileSize(-1)).toBe('—')
  })
})
