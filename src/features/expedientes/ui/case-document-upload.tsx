import { FolderPlus, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { useCaseFolders, useCreateCaseFolder } from '@/features/expedientes'
import { cn } from '@/lib/utils'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { CASE_DOCUMENT_MIME } from '../application/case-document-rules'
import { CONFIDENTIALITY_LABEL, folderOptions } from '../application/case-documents-list'
import { CaseDocumentUploadList } from './case-document-upload-list'
import { CaseFolderCreator } from './case-folder-creator'
import { useUploadQueue } from './use-upload-queue'

const DEFAULT_CATEGORIES = ['General', 'Escritos', 'Resoluciones', 'Poderes', 'Contratos']
const selectClass =
  'border-input bg-background h-8 rounded-md border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Upload from the case Documents tab: drop files anywhere on the tab or pick them, choose the
 * category and confidentiality once, and follow each file. A failed file can be retried alone.
 */
export function CaseDocumentUpload({
  firmId,
  caseId,
  categories,
  children,
}: {
  firmId: string | undefined
  caseId: string
  categories: string[]
  children: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [category, setCategory] = useState('General')
  const [confidentiality, setConfidentiality] =
    useState<CaseDocumentRow['confidentiality']>('normal')
  const [folderId, setFolderId] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const folders = useCaseFolders(firmId, caseId)
  const createFolder = useCreateCaseFolder(firmId, caseId)
  const folderChoices = folderOptions(folders.data ?? [])
  const categoryChoices = [...new Set([...DEFAULT_CATEGORIES, ...categories])]
  const queue = useUploadQueue(firmId, caseId, { category, confidentiality, folderId })
  const { busy, add } = queue

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    if (event.dataTransfer.files.length) void add(event.dataTransfer.files)
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={onDrop}
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 transition-colors',
          over ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <Upload className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-48 flex-1 text-sm">
          <p className="font-medium">
            {over
              ? 'Suelta los archivos para subirlos'
              : 'Arrastra aquí los documentos del expediente'}
          </p>
          <p className="text-muted-foreground text-xs">
            PDF, DOCX, XLSX, JPG o PNG · hasta 25 MB cada uno
          </p>
        </div>
        <select
          aria-label="Categoría de los documentos a subir"
          className={selectClass}
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categoryChoices.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <select
          aria-label="Confidencialidad de los documentos a subir"
          className={selectClass}
          value={confidentiality}
          onChange={(event) => setConfidentiality(event.target.value as typeof confidentiality)}
        >
          {Object.entries(CONFIDENTIALITY_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Carpeta donde guardar los documentos"
          className={selectClass}
          value={folderId}
          onChange={(event) => setFolderId(event.target.value)}
        >
          <option value="">Sin carpeta</option>
          {folderChoices.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.path}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setCreatingFolder((current) => !current)}
          aria-expanded={creatingFolder}
        >
          <FolderPlus className="size-4" aria-hidden="true" /> Nueva carpeta
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          aria-label="Seleccionar documentos para subir"
          accept={CASE_DOCUMENT_MIME.join(',')}
          onChange={(event) => {
            if (event.target.files) void add(event.target.files)
            event.target.value = ''
          }}
        />
        <Button size="sm" disabled={busy || !firmId} onClick={() => input.current?.click()}>
          <Upload className="size-4" aria-hidden="true" /> Subir documentos
        </Button>
      </div>

      {creatingFolder ? (
        <CaseFolderCreator
          parentPath={folderChoices.find((folder) => folder.id === folderId)?.path ?? null}
          onCreate={(name) => createFolder(name, folderId || null)}
          onDone={() => setCreatingFolder(false)}
        />
      ) : null}

      <CaseDocumentUploadList items={queue.items} onRetry={queue.retry} onRemove={queue.remove} />
      {children}
    </div>
  )
}
