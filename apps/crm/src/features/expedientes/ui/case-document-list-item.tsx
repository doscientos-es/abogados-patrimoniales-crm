import { IconButton } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  LoaderCircle,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { openCaseDocument, useDocumentVersions } from '@/features/expedientes'
import {
  CONFIDENTIALITY_LABEL,
  CONTENT_STATUS_LABEL,
  formatFileSize,
} from '@/features/expedientes/application/case-documents-list'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'
import { errorMessage } from '@/shared/lib/error-message'

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' })

function openFile(document: CaseDocumentRow) {
  openCaseDocument({ storagePath: document.storage_path }).catch((error: unknown) =>
    toast.error(errorMessage(error, 'No se pudo abrir el documento.')),
  )
}

/** One document of the case: summary line, quick actions and its version history on demand. */
export function CaseDocumentListItem({
  document,
  displayName,
  folderPath,
  firmId,
  expedienteId,
  uploadingId,
  onPickVersion,
}: {
  document: CaseDocumentRow
  displayName: string
  folderPath: string
  firmId: string | undefined
  expedienteId: string
  uploadingId: string | null
  onPickVersion: (document: CaseDocumentRow) => void
}) {
  const [showVersions, setShowVersions] = useState(false)
  const versions = useDocumentVersions(firmId, document.logical_document_id, showVersions)
  const hasHistory = document.version > 1
  const uploading = uploadingId === document.id

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-48 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {displayName !== document.original_name ? (
            <p className="text-muted-foreground truncate text-xs">
              Original: {document.original_name}
            </p>
          ) : null}
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-xs">
            {folderPath ? (
              <span className="inline-flex items-center gap-1">
                <Folder className="size-3" aria-hidden="true" /> {folderPath} ·
              </span>
            ) : null}
            <span>
              {document.category} · v{document.version} · {formatFileSize(document.size_bytes)} ·{' '}
              {dateTime.format(new Date(document.updated_at))}
            </span>
          </p>
        </div>
        {document.content_status !== 'validated' ? (
          <Badge variant={document.content_status === 'rejected' ? 'destructive' : 'secondary'}>
            {CONTENT_STATUS_LABEL[document.content_status]}
          </Badge>
        ) : null}
        <Badge variant={document.confidentiality === 'normal' ? 'outline' : 'default'}>
          {CONFIDENTIALITY_LABEL[document.confidentiality]}
        </Badge>
        {hasHistory ? (
          <IconButton
            label={showVersions ? 'Ocultar versiones' : `Ver las ${document.version} versiones`}
            variant="ghost"
            onClick={() => setShowVersions((current) => !current)}
          >
            {showVersions ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
          </IconButton>
        ) : null}
        <IconButton label="Abrir documento" variant="ghost" onClick={() => openFile(document)}>
          <ExternalLink className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={
            uploading
              ? 'Subiendo nueva versión…'
              : `Subir nueva versión (actual: v${document.version})`
          }
          variant="ghost"
          isDisabled={uploadingId !== null}
          onClick={() => onPickVersion(document)}
        >
          {uploading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FilePlus2 className="size-4" aria-hidden="true" />
          )}
        </IconButton>
        <Link
          to="/documentos"
          search={{ case: expedienteId, doc: document.id }}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          Detalle
        </Link>
      </div>

      {showVersions ? (
        <ol className="mt-2 ml-8 space-y-1 border-l pl-3" aria-label="Historial de versiones">
          {versions.isPending ? (
            <li className="text-muted-foreground text-xs">Cargando versiones…</li>
          ) : null}
          {versions.isError ? (
            <li className="text-destructive text-xs">No se pudieron cargar las versiones.</li>
          ) : null}
          {versions.data?.map((version) => (
            <li key={version.id} className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={version.is_current ? 'default' : 'outline'}>v{version.version}</Badge>
              <span className="min-w-0 flex-1 truncate">{version.original_name}</span>
              <span className="text-muted-foreground">
                {formatFileSize(version.size_bytes)} ·{' '}
                {dateTime.format(new Date(version.created_at))}
              </span>
              {version.is_current ? <span className="text-muted-foreground">vigente</span> : null}
              <IconButton
                label={`Abrir la versión ${version.version}`}
                variant="ghost"
                onClick={() => openFile(version)}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
