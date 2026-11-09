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
    /** 'all', 'none' (no folder) or a folder id. */
    folder?: string
    sort: DocumentSort
    displayName: (document: CaseDocumentRow) => string
  },
) {
  const query = normalize(options.query.trim())
  const folder = options.folder ?? 'all'
  return documents
    .filter((document) => options.category === 'all' || document.category === options.category)
    .filter(
      (document) =>
        folder === 'all' ||
        (folder === 'none' ? document.folder_id === null : document.folder_id === folder),
    )
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

export type FolderNode = { id: string; parent_id: string | null; name: string }

/** «Escritos / Demanda» for a folder id; empty when the document is not in a folder. */
export function folderPath(folders: FolderNode[], folderId: string | null | undefined) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const names: string[] = []
  const seen = new Set<string>()
  let current = folderId ? byId.get(folderId) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    names.unshift(current.name)
    current = current.parent_id ? byId.get(current.parent_id) : undefined
  }
  return names.join(' / ')
}

/** All folders of a case with their full path, sorted alphabetically by path. */
export function folderOptions(folders: FolderNode[]) {
  return folders
    .map((folder) => ({ id: folder.id, path: folderPath(folders, folder.id) }))
    .sort((first, second) => first.path.localeCompare(second.path, 'es'))
}

export function documentCategories(documents: CaseDocumentRow[]) {
  return [...new Set(documents.map((document) => document.category))].sort((first, second) =>
    first.localeCompare(second, 'es'),
  )
}
