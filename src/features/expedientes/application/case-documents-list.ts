import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

export const CONFIDENTIALITY_LABEL: Record<CaseDocumentRow['confidentiality'], string> = {
  normal: 'Normal',
  restricted: 'Restringido',
  confidential: 'Confidencial',
}

export const CONTENT_STATUS_LABEL: Record<CaseDocumentRow['content_status'], string> = {
  pending: 'Pendiente de revisar',
  validated: 'Validado',
  rejected: 'Rechazado',
}

export type DocumentSort = 'recent' | 'name' | 'category'

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Search (name, display name, category), category filter and sort of the case documents. */
export function filterDocuments(
  documents: CaseDocumentRow[],
  options: {
    query: string
    category: string
    sort: DocumentSort
    displayName: (document: CaseDocumentRow) => string
  },
) {
  const query = normalize(options.query.trim())
  return documents
    .filter((document) => options.category === 'all' || document.category === options.category)
    .filter(
      (document) =>
        !query ||
        normalize(
          `${options.displayName(document)} ${document.original_name} ${document.category}`,
        ).includes(query),
    )
    .sort((first, second) => {
      if (options.sort === 'name')
        return options
          .displayName(first)
          .localeCompare(options.displayName(second), 'es', { sensitivity: 'base' })
      if (options.sort === 'category')
        return (
          first.category.localeCompare(second.category, 'es') ||
          second.created_at.localeCompare(first.created_at)
        )
      return second.created_at.localeCompare(first.created_at)
    })
}

export function documentCategories(documents: CaseDocumentRow[]) {
  return [...new Set(documents.map((document) => document.category))].sort((first, second) =>
    first.localeCompare(second, 'es'),
  )
}
