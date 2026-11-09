import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

/** Same optional Drive hand-off as the Documents page; the CRM works without it. */
export async function queueDriveSync(documentId: string) {
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
