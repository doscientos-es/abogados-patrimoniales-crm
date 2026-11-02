import { IconButton } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { ExternalLink, FileText, FolderOpen, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDocumentNamings } from '@/features/documentos/document-naming-data'
import {
  CONFIDENTIALITY_LABEL,
  CONTENT_STATUS_LABEL,
  documentCategories,
  filterDocuments,
  formatFileSize,
  type DocumentSort,
} from '@/features/expedientes/application/case-documents-list'
import { abrirJustificante } from '@/features/expedientes/infrastructure/case-economic-documents'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

const selectClass =
  'border-input bg-background h-9 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' })

/** Documents tab list: search, category filter, normalized names, quick open and detail link. */
export function CaseDocumentsSection({
  documents,
  expedienteId,
  firmId,
}: {
  documents: CaseDocumentRow[]
  expedienteId: string
  firmId: string | undefined
}) {
  const namings = useDocumentNamings(firmId)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<DocumentSort>('recent')
  const displayName = (document: CaseDocumentRow) =>
    namings.data?.byLogicalId[document.logical_document_id]?.display_name ?? document.original_name
  const visible = filterDocuments(documents, { query, category, sort, displayName })
  const categories = documentCategories(documents)
  const confidential = documents.filter((document) => document.confidentiality !== 'normal').length
  const pendingReview = documents.filter((document) => document.content_status === 'pending').length

  const open = (document: CaseDocumentRow) =>
    abrirJustificante({
      documentId: document.id,
      nombre: document.original_name,
      storagePath: document.storage_path,
    }).catch((error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el documento.'),
    )

  return (
    <section className="space-y-3" aria-label="Documentos del expediente">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-base font-semibold">Documentos</h2>
          <p className="text-muted-foreground text-xs">
            {documents.length} vigente{documents.length === 1 ? '' : 's'}
            {pendingReview
              ? ` · ${pendingReview} pendiente${pendingReview === 1 ? '' : 's'} de revisar`
              : ''}
            {confidential ? ` · ${confidential} restringido${confidential === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <Link
          to="/documentos"
          search={{ case: expedienteId }}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FolderOpen className="size-4" aria-hidden="true" /> Abrir gestor documental
        </Link>
      </header>

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          aria-label="Filtrar por categoría"
          className={selectClass}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">Todas las categorías</option>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select
          aria-label="Ordenar documentos"
          className={selectClass}
          value={sort}
          onChange={(event) => setSort(event.target.value as DocumentSort)}
        >
          <option value="recent">Más recientes</option>
          <option value="name">Nombre</option>
          <option value="category">Categoría</option>
        </select>
      </div>

      <Card>
        <CardContent className="divide-y pt-2">
          {visible.map((document) => {
            const name = displayName(document)
            return (
              <div key={document.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-48 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  {name !== document.original_name ? (
                    <p className="text-muted-foreground truncate text-xs">
                      Original: {document.original_name}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    {document.category} · v{document.version} ·{' '}
                    {formatFileSize(document.size_bytes)} ·{' '}
                    {dateTime.format(new Date(document.updated_at))}
                  </p>
                </div>
                {document.content_status !== 'validated' ? (
                  <Badge
                    variant={document.content_status === 'rejected' ? 'destructive' : 'secondary'}
                  >
                    {CONTENT_STATUS_LABEL[document.content_status]}
                  </Badge>
                ) : null}
                <Badge variant={document.confidentiality === 'normal' ? 'outline' : 'default'}>
                  {CONFIDENTIALITY_LABEL[document.confidentiality]}
                </Badge>
                <IconButton
                  label="Abrir documento"
                  variant="ghost"
                  onClick={() => void open(document)}
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </IconButton>
                <Link
                  to="/documentos"
                  search={{ case: expedienteId, doc: document.id }}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Detalle
                </Link>
              </div>
            )
          })}
          {!visible.length ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {documents.length
                ? 'Ningún documento coincide con la búsqueda.'
                : 'No hay documentos incorporados.'}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
