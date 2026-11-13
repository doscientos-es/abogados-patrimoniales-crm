import { Link } from '@tanstack/react-router'
import { FolderOpen } from 'lucide-react'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useDocumentNamings } from '@/features/documentos/document-naming-data'
import { InternalDrafts } from '@/features/documentos/ui/internal-drafts'
import { useCaseFolders } from '@/features/expedientes'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { documentCategories, filterDocuments, folderPath } from '../application/case-documents-list'
import { CaseDocumentListItem } from './case-document-list-item'
import { CaseDocumentUpload } from './case-document-upload'
import { CaseDocumentsToolbar, type DocumentFilters } from './case-documents-toolbar'
import { useVersionUpload } from './use-version-upload'

const INITIAL_FILTERS: DocumentFilters = {
  query: '',
  category: 'all',
  folder: 'all',
  sort: 'recent',
}

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
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const folderRows = useCaseFolders(firmId, expedienteId).data ?? []
  const version = useVersionUpload(firmId, expedienteId)
  const displayName = (document: CaseDocumentRow) =>
    namings.data?.byLogicalId[document.logical_document_id]?.display_name ?? document.original_name
  const visible = filterDocuments(documents, { ...filters, displayName })
  const categories = documentCategories(documents)
  const confidential = documents.filter((document) => document.confidentiality !== 'normal').length
  const pendingReview = documents.filter((document) => document.content_status === 'pending').length

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

      <InternalDrafts firmId={firmId} targetId={expedienteId} targetType="case" />
      <CaseDocumentUpload firmId={firmId} caseId={expedienteId} categories={categories}>
        <CaseDocumentsToolbar
          filters={filters}
          onChange={(change) => setFilters((current) => ({ ...current, ...change }))}
          categories={categories}
          folders={folderRows}
        />

        <Card>
          <CardContent className="divide-y pt-2">
            {visible.map((document) => (
              <CaseDocumentListItem
                key={document.id}
                document={document}
                displayName={displayName(document)}
                folderPath={folderPath(folderRows, document.folder_id)}
                firmId={firmId}
                expedienteId={expedienteId}
                uploadingId={version.uploadingId}
                onPickVersion={version.pickVersionFor}
              />
            ))}
            {!visible.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {documents.length
                  ? 'Ningún documento coincide con la búsqueda.'
                  : 'No hay documentos incorporados.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </CaseDocumentUpload>
      <input {...version.inputProps} />
    </section>
  )
}
