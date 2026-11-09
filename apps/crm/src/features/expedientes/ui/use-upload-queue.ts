import { useState } from 'react'
import { toast } from 'sonner'

import { uploadCaseDocument, useRefreshCaseDocuments } from '@/features/expedientes'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'
import { errorMessage } from '@/shared/lib/error-message'

import { validateCaseDocumentFile } from '../application/case-document-rules'

export type UploadItem = {
  id: string
  file: File
  status: 'waiting' | 'uploading' | 'done' | 'error'
  error?: string
}

export type UploadOptions = {
  category: string
  confidentiality: CaseDocumentRow['confidentiality']
  folderId: string
}

/**
 * Sequential upload queue for the case Documents tab. Validates each file, uploads it with the
 * options chosen at that moment and lets a failed file be retried alone.
 */
export function useUploadQueue(firmId: string | undefined, caseId: string, options: UploadOptions) {
  const refresh = useRefreshCaseDocuments(firmId, caseId)
  const [items, setItems] = useState<UploadItem[]>([])
  const busy = items.some((item) => item.status === 'uploading')

  const patch = (id: string, change: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)))

  const send = async (item: UploadItem) => {
    if (!firmId) {
      toast.error('No hay un despacho activo.')
      return
    }
    patch(item.id, { status: 'uploading' })
    try {
      await uploadCaseDocument({
        firmId,
        caseId,
        file: item.file,
        category: options.category,
        confidentiality: options.confidentiality,
        folderId: options.folderId || null,
      })
      patch(item.id, { status: 'done' })
      await refresh()
    } catch (failure) {
      patch(item.id, { status: 'error', error: errorMessage(failure, 'No se pudo subir.') })
    }
  }

  const add = async (files: FileList | File[]) => {
    const accepted: UploadItem[] = []
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

  const remove = (id: string) => setItems((current) => current.filter((item) => item.id !== id))

  return { items, busy, add, retry: send, remove }
}
