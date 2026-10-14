import {
  getSupabaseBrowserClient,
  type ContactDocumentRow,
  type ContactDocumentType,
} from '@/shared/infrastructure/supabase'

export const CONTACT_DOCUMENT_CATEGORIES: Array<{ type: ContactDocumentType; label: string }> = [
  { type: 'identification', label: 'Identificación' },
  { type: 'privacy', label: 'Protección de datos' },
  { type: 'power', label: 'Poderes y autorizaciones' },
  { type: 'authority', label: 'Acreditación de representación' },
  { type: 'other', label: 'Otros documentos personales' },
]

export const CONTACT_DOCUMENT_MIME = ['application/pdf', 'image/jpeg', 'image/png']
export const CONTACT_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024

/** Guarda el archivo y sus metadatos en el archivo privado del contacto. */
export async function uploadContactDocument(input: {
  firmId: string
  contactId: string
  file: File
  name: string
  type: ContactDocumentType
  documentStatus?: ContactDocumentRow['document_status']
  documentNumber?: string
  issuedOn?: string | null
  expiresOn?: string | null
  signedOn?: string | null
  observations?: string
  tags?: string[]
}) {
  const { firmId, contactId, file } = input
  if (!CONTACT_DOCUMENT_MIME.includes(file.type) || file.size > CONTACT_DOCUMENT_MAX_BYTES)
    throw new Error(`«${file.name}»: sube un PDF, JPG o PNG de hasta 25 MB.`)

  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('No hay conexión con la base de datos.')

  const id = crypto.randomUUID()
  const storagePath = `${firmId}/${contactId}/${id}/${file.name.replace(/[\\/]/g, '_')}`
  const { error: uploadError } = await client.storage
    .from('contact-documents')
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const name = input.name.trim() || file.name
  const { error } = await client.from('crm_contact_documents').insert({
    id,
    firm_id: firmId,
    contact_id: contactId,
    document_type: input.type,
    name,
    original_name: file.name,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    document_status: input.documentStatus ?? 'current',
    document_number: input.documentNumber ?? '',
    issued_on: input.issuedOn ?? null,
    expires_on: input.expiresOn ?? null,
    signed_on: input.signedOn ?? null,
    observations: input.observations ?? '',
    tags: input.tags ?? [],
  })
  if (error) {
    await client.storage.from('contact-documents').remove([storagePath])
    throw error
  }
  return { id, name }
}
