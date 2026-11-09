/** Rules every case document upload follows, wherever it starts (tab, economy, archive). */
export const MAX_CASE_DOCUMENT_BYTES = 25 * 1024 * 1024

export const CASE_DOCUMENT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]

/** PDF, DOCX, XLSX, JPG or PNG, up to 25 MB, not empty. Returns a message or null when valid. */
export function validateCaseDocumentFile(file: File): string | null {
  if (!CASE_DOCUMENT_MIME.includes(file.type))
    return `«${file.name}»: formato no permitido (PDF, DOCX, XLSX, JPG o PNG).`
  if (file.size > MAX_CASE_DOCUMENT_BYTES) return `«${file.name}» supera el límite de 25 MB.`
  if (file.size === 0) return `«${file.name}» está vacío.`
  return null
}
