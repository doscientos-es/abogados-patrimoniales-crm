import { getSupabaseBrowserClient, type CaseDocumentRow } from '@/shared/infrastructure/supabase'

export type AdjuntoEconomico = { documentId: string; nombre: string; storagePath: string }

const MAX_BYTES = 25 * 1024 * 1024

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Uploads a file as a normal case document, so it also shows up in the Documents tab with the
 * same permissions. Same prepare → upload → finalize flow as the Documents page.
 */
export async function subirJustificante(
  firmId: string,
  caseId: string,
  file: File,
  category = 'Económico',
  confidentiality: 'normal' | 'restricted' | 'confidential' = 'normal',
  folderId: string | null = null,
): Promise<AdjuntoEconomico> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Sin conexión.')
  if (file.size > MAX_BYTES) throw new Error('El archivo supera 25 MB.')
  const { data, error } = await client.rpc('crm_create_case_document', {
    target_firm_id: firmId,
    target_case_id: caseId,
    target_workstream_id: null,
    document_category: category,
    original_file_name: file.name,
    content_mime_type: file.type || 'application/octet-stream',
    content_size_bytes: file.size,
    document_confidentiality: confidentiality,
  })
  if (error) throw error
  if (!data) throw new Error('No se pudo preparar el documento.')
  await uploadPrepared(client, data, file)
  return { documentId: data.id, nombre: file.name, storagePath: data.storage_path }
}

/**
 * Uploads a new version of an existing document (same logical document, version + 1). The
 * expected version guards against someone else uploading a version in the meantime.
 */
export async function subirNuevaVersion(
  document: Pick<CaseDocumentRow, 'id' | 'version'>,
  file: File,
): Promise<AdjuntoEconomico> {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Sin conexión.')
  if (file.size > MAX_BYTES) throw new Error('El archivo supera 25 MB.')
  const { data, error } = await client.rpc('crm_create_document_version', {
    target_document_id: document.id,
    target_expected_version: document.version,
    original_file_name: file.name,
    content_mime_type: file.type || 'application/octet-stream',
    content_size_bytes: file.size,
  })
  if (error?.code === '40001')
    throw new Error('Alguien subió otra versión mientras tanto. Recarga y vuelve a intentarlo.')
  if (error) throw error
  if (!data) throw new Error('No se pudo preparar la nueva versión.')
  await uploadPrepared(client, data, file)
  return { documentId: data.id, nombre: file.name, storagePath: data.storage_path }
}

/** Upload the bytes, finalize with the checksum and clean up the pending row if anything fails. */
async function uploadPrepared(
  client: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  prepared: { id: string; storage_path: string },
  file: File,
) {
  try {
    const upload = await client.storage
      .from('case-documents')
      .upload(prepared.storage_path, file, { contentType: file.type, upsert: false })
    if (upload.error) throw upload.error
    const done = await client.rpc('crm_finalize_document_version', {
      target_document_id: prepared.id,
      content_checksum: await sha256(file),
    })
    if (done.error) throw done.error
  } catch (failure) {
    await client.storage
      .from('case-documents')
      .remove([prepared.storage_path])
      .catch(() => undefined)
    await client.rpc('crm_abort_document_version', { target_document_id: prepared.id })
    throw failure
  }
  void queueDriveSync(prepared.id)
}

/** Same optional Drive hand-off as the Documents page; the CRM works without it. */
async function queueDriveSync(documentId: string) {
  const client = getSupabaseBrowserClient()
  if (!client) return
  try {
    const { data, error } = await client.rpc('crm_queue_drive_sync', {
      target_document_id: documentId,
      target_operation: 'upload',
    })
    if (!error && data?.id)
      void client.functions.invoke('sync-drive-document', { body: { jobId: data.id } })
  } catch {
    // Drive is optional.
  }
}

export const CASE_DOCUMENT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]

/** Same rules as the Documents page: PDF, DOCX, XLSX, JPG or PNG, up to 25 MB. */
export function validateCaseDocumentFile(file: File): string | null {
  if (!CASE_DOCUMENT_MIME.includes(file.type))
    return `«${file.name}»: formato no permitido (PDF, DOCX, XLSX, JPG o PNG).`
  if (file.size > MAX_BYTES) return `«${file.name}» supera el límite de 25 MB.`
  if (file.size === 0) return `«${file.name}» está vacío.`
  return null
}

export async function abrirJustificante(attachment: AdjuntoEconomico) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Sin conexión.')
  const { data, error } = await client.storage
    .from('case-documents')
    .createSignedUrl(attachment.storagePath, 60)
  if (error || !data?.signedUrl)
    throw new Error('No se pudo abrir el documento. Puede que ya no tengas acceso.')
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
