import { useQuery } from '@tanstack/react-query'

import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

import type { OriginalStatus } from './physical-originals'

export type PhysicalOriginal = {
  id: string
  firm_id: string
  case_id: string
  au_number: number
  reference: string
  description: string
  storage_note: string | null
  status: OriginalStatus
  document_id: string | null
  created_at: string
  updated_at: string
}
export type OriginalEvent = {
  id: string
  event_type: string
  previous_status: string | null
  status: string | null
  note: string | null
  created_at: string
}
/** available=false: the tables are not there yet. Data is never simulated. */
export type Listing<T> = { available: boolean; rows: T[] }

const COLUMNS =
  'id,firm_id,case_id,au_number,reference,description,storage_note,status,document_id,created_at,updated_at'

type Loose = {
  from: (table: string) => {
    select: (columns: string) => any
  }
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

// The tables arrived after the generated types; typed locally until they are regenerated.
function client() {
  return getSupabaseBrowserClient() as unknown as Loose | null
}

export const caseOriginalsKey = (caseId: string | null | undefined) => [
  'crm',
  'physical-originals',
  caseId,
]

export function useCaseOriginals(caseId: string | null | undefined) {
  return useQuery({
    queryKey: caseOriginalsKey(caseId),
    enabled: Boolean(caseId),
    queryFn: async (): Promise<Listing<PhysicalOriginal>> => {
      const db = client()
      if (!db || !caseId) return { available: false, rows: [] }
      const { data, error } = await db
        .from('crm_physical_originals')
        .select(COLUMNS)
        .eq('case_id', caseId)
        .order('au_number', { ascending: false })
      if (error) return { available: false, rows: [] }
      return { available: true, rows: data as PhysicalOriginal[] }
    },
  })
}

export function useOriginalByReference(reference: string | null) {
  return useQuery({
    queryKey: ['crm', 'physical-original', reference],
    enabled: Boolean(reference),
    queryFn: async () => {
      const db = client()
      if (!db || !reference) return { available: false as const }
      const { data, error } = await db
        .from('crm_physical_originals')
        .select(COLUMNS)
        .eq('reference', reference)
        .maybeSingle()
      if (error) return { available: false as const }
      if (!data) return { available: true as const, original: null }
      const original = data as PhysicalOriginal
      const [events, caseResult, documentResult] = await Promise.all([
        db
          .from('crm_physical_original_events')
          .select('id,event_type,previous_status,status,note,created_at')
          .eq('original_id', original.id)
          .order('created_at'),
        db.from('crm_cases').select('id,title,reference').eq('id', original.case_id).maybeSingle(),
        original.document_id
          ? db
              .from('crm_case_documents')
              .select('id,original_name,storage_path')
              .eq('id', original.document_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      return {
        available: true as const,
        original,
        events: (events.data ?? []) as OriginalEvent[],
        caseRow: caseResult.data as { id: string; title: string; reference: string } | null,
        document: documentResult.data as {
          id: string
          original_name: string
          storage_path: string
        } | null,
      }
    },
  })
}

async function call(fn: string, args: Record<string, unknown>) {
  const db = client()
  if (!db) throw new Error('Sin conexión.')
  const { data, error } = await db.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as PhysicalOriginal
}

export const reserveOriginal = (
  firmId: string,
  caseId: string,
  description: string,
  storageNote: string,
) =>
  call('crm_reserve_physical_original', {
    target_firm_id: firmId,
    target_case_id: caseId,
    original_description: description,
    original_storage_note: storageNote || null,
  })

export const linkOriginalDocument = (originalId: string, documentId: string) =>
  call('crm_link_physical_original_document', {
    target_original_id: originalId,
    target_document_id: documentId,
  })

export const setOriginalStatus = (
  originalId: string,
  status: OriginalStatus,
  note: string,
  storageNote: string,
) =>
  call('crm_set_physical_original_status', {
    target_original_id: originalId,
    new_status: status,
    status_note: note || null,
    new_storage_note: storageNote || null,
  })
