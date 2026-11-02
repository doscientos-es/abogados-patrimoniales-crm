import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

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
    document_confidentiality: 'normal',
  })
  if (error) throw error
  if (!data) throw new Error('No se pudo preparar el documento.')
  try {
    const upload = await client.storage
      .from('case-documents')
      .upload(data.storage_path, file, { contentType: file.type, upsert: false })
    if (upload.error) throw upload.error
    const done = await client.rpc('crm_finalize_document_version', {
      target_document_id: data.id,
      content_checksum: await sha256(file),
    })
    if (done.error) throw done.error
  } catch (failure) {
    await client.storage
      .from('case-documents')
      .remove([data.storage_path])
      .catch(() => undefined)
    await client.rpc('crm_abort_document_version', { target_document_id: data.id })
    throw failure
  }
  return { documentId: data.id, nombre: file.name, storagePath: data.storage_path }
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
