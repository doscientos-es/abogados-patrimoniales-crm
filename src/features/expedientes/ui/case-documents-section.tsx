import { IconButton } from '@doscientos/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ExternalLink, FilePlus2, FileText, FolderOpen, LoaderCircle, Search } from 'lucide-react'
import { useRef, useState } from 'react'
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
import {
  CASE_DOCUMENT_MIME,
  abrirJustificante,
  subirNuevaVersion,
  validateCaseDocumentFile,
} from '@/features/expedientes/infrastructure/case-economic-documents'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { CaseDocumentUpload } from './case-document-upload'

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
  const [folder, setFolder] = useState('all')
  const folderRows = useCaseFolders(firmId, expedienteId).data ?? []
  const displayName = (document: CaseDocumentRow) =>
    namings.data?.byLogicalId[document.logical_document_id]?.display_name ?? document.original_name
  const visible = filterDocuments(documents, { query, category, folder, sort, displayName })
  const categories = documentCategories(documents)
  const confidential = documents.filter((document) => document.confidentiality !== 'normal').length
  const pendingReview = documents.filter((document) => document.content_status === 'pending').length

  const versionInput = useRef<HTMLInputElement>(null)
  const versionTarget = useRef<CaseDocumentRow | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const pickVersionFor = (document: CaseDocumentRow) => {
    versionTarget.current = document
    versionInput.current?.click()
  }

  const uploadVersion = async (file: File) => {
    const target = versionTarget.current
    versionTarget.current = null
    if (!target) return
    const problem = validateCaseDocumentFile(file)
    if (problem) {
      toast.error(problem)
      return
    }
    setUploadingId(target.id)
    try {
      await subirNuevaVersion(target, file)
      await queryClient.invalidateQueries({
        queryKey: ['expedientes', firmId, expedienteId, 'documentos'],
      })
      void queryClient.invalidateQueries({ queryKey: ['documents', firmId] })
      toast.success(`Nueva versión de «${target.original_name}» guardada (v${target.version + 1}).`)
    } catch (failure) {
      const message =
        failure && typeof failure === 'object' && 'message' in failure
          ? String(failure.message)
          : 'No se pudo subir la nueva versión.'
      toast.error(message)
    } finally {
      setUploadingId(null)
    }
  }

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

      <CaseDocumentUpload firmId={firmId} caseId={expedienteId} categories={categories}>
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
          {folderRows.length ? (
            <select
              aria-label="Filtrar por carpeta"
              className={selectClass}
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            >
              <option value="all">Todas las carpetas</option>
              <option value="none">Sin carpeta</option>
              {folderOptions(folderRows).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.path}
                </option>
              ))}
            </select>
          ) : null}
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
            {visible.map((document) => (
              <CaseDocumentListItem
                key={document.id}
                document={document}
                displayName={displayName(document)}
                folderPath={folderPath(folderRows, document.folder_id)}
                firmId={firmId}
                expedienteId={expedienteId}
                uploadingId={uploadingId}
                onPickVersion={pickVersionFor}
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
      <input
        ref={versionInput}
        type="file"
        hidden
        aria-label="Seleccionar la nueva versión del documento"
        accept={CASE_DOCUMENT_MIME.join(',')}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void uploadVersion(file)
        }}
      />
    </section>
  )
}
