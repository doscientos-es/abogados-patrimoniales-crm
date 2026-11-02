import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

import {
  folderOptions,
  type DocumentSort,
  type FolderNode,
} from '../application/case-documents-list'

const selectClass =
  'border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type DocumentFilters = {
  query: string
  category: string
  folder: string
  sort: DocumentSort
}

/** Search, category, folder and sort controls of the case Documents tab. */
export function CaseDocumentsToolbar({
  filters,
  onChange,
  categories,
  folders,
}: {
  filters: DocumentFilters
  onChange: (change: Partial<DocumentFilters>) => void
  categories: string[]
  folders: FolderNode[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search
          className="text-muted-foreground absolute top-2.5 left-2.5 size-4"
          aria-hidden="true"
        />
        <Input
          aria-label="Buscar documentos"
          className="pl-8"
          placeholder="Buscar por nombre o categoría…"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
        />
      </div>
      <select
        aria-label="Filtrar por categoría"
        className={selectClass}
        value={filters.category}
        onChange={(event) => onChange({ category: event.target.value })}
      >
        <option value="all">Todas las categorías</option>
        {categories.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      {folders.length ? (
        <select
          aria-label="Filtrar por carpeta"
          className={selectClass}
          value={filters.folder}
          onChange={(event) => onChange({ folder: event.target.value })}
        >
          <option value="all">Todas las carpetas</option>
          <option value="none">Sin carpeta</option>
          {folderOptions(folders).map((option) => (
            <option key={option.id} value={option.id}>
              {option.path}
            </option>
          ))}
        </select>
      ) : null}
      <select
        aria-label="Ordenar documentos"
        className={selectClass}
        value={filters.sort}
        onChange={(event) => onChange({ sort: event.target.value as DocumentSort })}
      >
        <option value="recent">Más recientes</option>
        <option value="name">Nombre</option>
        <option value="category">Categoría</option>
      </select>
    </div>
  )
}
