import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, LoaderCircle, RotateCw, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  CASE_DOCUMENT_MIME,
  subirJustificante,
  validateCaseDocumentFile,
} from '@/features/expedientes/infrastructure/case-economic-documents'
import { cn } from '@/lib/utils'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { CONFIDENTIALITY_LABEL } from '../application/case-documents-list'

const DEFAULT_CATEGORIES = ['General', 'Escritos', 'Resoluciones', 'Poderes', 'Contratos']
const selectClass =
  'border-input bg-background h-8 rounded-md border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Item = {
  id: string
  file: File
  status: 'waiting' | 'uploading' | 'done' | 'error'
  error?: string
}

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
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [category, setCategory] = useState('General')
  const [confidentiality, setConfidentiality] =
    useState<CaseDocumentRow['confidentiality']>('normal')
  const [items, setItems] = useState<Item[]>([])
  const options = [...new Set([...DEFAULT_CATEGORIES, ...categories])]
  const patch = (id: string, change: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))
  const busy = items.some((item) => item.status === 'uploading')

  const send = async (item: Item) => {
    if (!firmId) {
      toast.error('No hay un despacho activo.')
      return
    }
    patch(item.id, { status: 'uploading' })
    try {
      await subirJustificante(firmId, caseId, item.file, category, confidentiality)
      patch(item.id, { status: 'done' })
      await queryClient.invalidateQueries({
        queryKey: ['expedientes', firmId, caseId, 'documentos'],
      })
      void queryClient.invalidateQueries({ queryKey: ['documents', firmId] })
    } catch (failure) {
      const message =
        failure && typeof failure === 'object' && 'message' in failure
          ? String(failure.message)
          : 'No se pudo subir.'
      patch(item.id, { status: 'error', error: message })
    }
  }

  const add = async (files: FileList | File[]) => {
    const accepted: Item[] = []
    for (const file of Array.from(files)) {
      const problem = validateCaseDocumentFile(file)
      if (problem) toast.error(problem)
      else accepted.push({ id: crypto.randomUUID(), file, status: 'waiting' })
    }
    if (!accepted.length) return
    setItems((current) => [...current, ...accepted])
    for (const item of accepted) await send(item)
    toast.success(accepted.length === 1 ? 'Documento subido.' : 'Subida terminada.')
  }

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
          {options.map((name) => (
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

      {items.length ? (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              {item.status === 'uploading' || item.status === 'waiting' ? (
                <LoaderCircle
                  className="text-muted-foreground size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : item.status === 'done' ? (
                <CircleCheck className="text-success size-4" aria-hidden="true" />
              ) : (
                <CircleAlert className="text-destructive size-4" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
              {item.status === 'error' ? (
                <>
                  <span className="text-destructive max-w-72 truncate text-xs">{item.error}</span>
                  <Button size="sm" variant="ghost" onClick={() => void send(item)}>
                    <RotateCw className="size-4" aria-hidden="true" /> Reintentar
                  </Button>
                </>
              ) : null}
              {item.status === 'done' || item.status === 'error' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Quitar ${item.file.name} de la lista`}
                  onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  )
}
