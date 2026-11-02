import { getSupabaseBrowserClient, type CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { MAX_CASE_DOCUMENT_BYTES } from '../application/case-document-rules'
import { queueDriveSync } from './case-document-drive-sync'

export type StoredCaseDocument = { documentId: string; nombre: string; storagePath: string }

type Client = NonNullable<ReturnType<typeof getSupabaseBrowserClient>>
type Prepared = { id: string; storage_path: string }

function requireClient(): Client {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Sin conexión.')
  return client
}

function requireAllowedSize(file: File) {
  if (file.size > MAX_CASE_DOCUMENT_BYTES) throw new Error('El archivo supera 25 MB.')
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const stored = (prepared: Prepared, file: File): StoredCaseDocument => ({
  documentId: prepared.id,
  nombre: file.name,
  storagePath: prepared.storage_path,
})

/** Upload the bytes, finalize with the checksum and clean up the pending row if anything fails. */
async function uploadPrepared(client: Client, prepared: Prepared, file: File) {
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

/**
 * Uploads a file as a normal case document, so it also shows up in the Documents tab with the
 * same permissions. Same prepare → upload → finalize flow as the Documents page.
 */
export async function uploadCaseDocument({
  firmId,
  caseId,
  file,
  category = 'Económico',
  confidentiality = 'normal',
  folderId = null,
}: {
  firmId: string
  caseId: string
  file: File
  category?: string
  confidentiality?: CaseDocumentRow['confidentiality']
  folderId?: string | null
}): Promise<StoredCaseDocument> {
  const client = requireClient()
  requireAllowedSize(file)
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
  if (folderId) {
    // Same order as the Documents page: place the pending document before uploading its bytes.
    const move = await client.rpc('crm_move_case_document', {
      target_document_id: data.id,
      target_folder_id: folderId,
    })
    if (move.error) {
      await client.rpc('crm_abort_document_version', { target_document_id: data.id })
      throw move.error
    }
  }
  await uploadPrepared(client, data, file)
  return stored(data, file)
}

/**
 * Uploads a new version of an existing document (same logical document, version + 1). The
 * expected version guards against someone else uploading a version in the meantime.
 */
export async function uploadDocumentVersion(
  document: Pick<CaseDocumentRow, 'id' | 'version'>,
  file: File,
): Promise<StoredCaseDocument> {
  const client = requireClient()
  requireAllowedSize(file)
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
  return stored(data, file)
}

/** Opens a short-lived signed link in a new tab (access is checked by storage policies). */
export async function openCaseDocument(document: { storagePath: string }) {
  const { data, error } = await requireClient()
    .storage.from('case-documents')
    .createSignedUrl(document.storagePath, 60)
  if (error || !data?.signedUrl)
    throw new Error('No se pudo abrir el documento. Puede que ya no tengas acceso.')
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
