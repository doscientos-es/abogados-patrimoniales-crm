import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { uploadDocumentVersion, useRefreshCaseDocuments } from '@/features/expedientes'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'
import { errorMessage } from '@/shared/lib/error-message'

import { CASE_DOCUMENT_MIME, validateCaseDocumentFile } from '../application/case-document-rules'

/**
 * "Upload a new version" for any document row: `pickVersionFor(document)` opens the file chooser
 * and the chosen file becomes version + 1. Spread `inputProps` on one hidden `<input>`.
 */
export function useVersionUpload(firmId: string | undefined, caseId: string) {
  const input = useRef<HTMLInputElement>(null)
  const target = useRef<CaseDocumentRow | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const refresh = useRefreshCaseDocuments(firmId, caseId)

  const pickVersionFor = (document: CaseDocumentRow) => {
    target.current = document
    input.current?.click()
  }

  const upload = async (file: File) => {
    const document = target.current
    target.current = null
    if (!document) return
    const problem = validateCaseDocumentFile(file)
    if (problem) {
      toast.error(problem)
      return
    }
    setUploadingId(document.id)
    try {
      await uploadDocumentVersion(document, file)
      await refresh()
      toast.success(
        `Nueva versión de «${document.original_name}» guardada (v${document.version + 1}).`,
      )
    } catch (failure) {
      toast.error(errorMessage(failure, 'No se pudo subir la nueva versión.'))
    } finally {
      setUploadingId(null)
    }
  }

  const inputProps = {
    ref: input,
    type: 'file' as const,
    hidden: true,
    'aria-label': 'Seleccionar la nueva versión del documento',
    accept: CASE_DOCUMENT_MIME.join(','),
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void upload(file)
    },
  }

  return { uploadingId, pickVersionFor, inputProps }
}
