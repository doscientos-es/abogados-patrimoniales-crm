import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

/** Finds an open task for a specific quote workflow marker. Fails closed on query errors. */
export async function buscarTareaRevisionAbierta(firmId: string, leadId: string, marker: string) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Sin conexión con el servidor.')
  const { data, error } = await client
    .from('crm_tasks')
    .select('id, assigned_to, due_at, description')
    .eq('firm_id', firmId)
    .eq('opportunity_id', leadId)
    .not('status', 'in', '(completed,cancelled)')
    .order('created_at', { ascending: true })
  if (error) throw error
  const task = (data ?? []).find((item) => (item.description ?? '').includes(marker))
  return task ? { id: task.id, asignadoId: task.assigned_to, venceEn: task.due_at } : null
}