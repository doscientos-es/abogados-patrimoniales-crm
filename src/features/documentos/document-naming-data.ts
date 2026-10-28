import { useQuery } from '@tanstack/react-query'

import { getSupabaseBrowserClient } from '@/shared/infrastructure/supabase'

import { BUILTIN_DOCUMENT_TYPES, type DocumentType } from './document-naming'

export type DocumentNaming = {
  logical_document_id: string
  firm_id: string
  case_id: string
  type_id: string | null
  description: string
  display_name: string
  original_name: string
  document_date: string | null
  origin_stage: string | null
  closed_pdf: boolean
  metadata: { parties?: string[]; court?: string | null; procedureNumber?: string | null }
  ai_suggestion: unknown
  confirmed_at: string
}

export type NamingRule = { id: string; rule: string; active: boolean }
export type Listing<T> = { available: boolean; rows: T[] }

function table(name: string) {
  const client = getSupabaseBrowserClient() as unknown as {
    from: (tableName: string) => any
  } | null
  return client?.from(name) ?? null
}

export const documentTypesKey = (firmId: string | undefined) => ['crm', 'document-types', firmId]
export const documentNamingKey = (firmId: string | undefined) => ['crm', 'document-naming', firmId]
export const namingRulesKey = (firmId: string | undefined) => ['crm', 'document-naming-rules', firmId]

const builtins: DocumentType[] = BUILTIN_DOCUMENT_TYPES.map((name, index) => ({
  id: name,
  name,
  suggestions: [],
  sort_order: index * 10,
  active: true,
}))

export function useDocumentTypes(firmId: string | undefined) {
  return useQuery({
    queryKey: documentTypesKey(firmId),
    enabled: Boolean(firmId),
    queryFn: async (): Promise<Listing<DocumentType>> => {
      const source = table('crm_document_types')
      if (!source || !firmId) return { available: false, rows: builtins }
      const { data, error } = await source
        .select('id,name,suggestions,sort_order,active')
        .eq('firm_id', firmId)
        .order('sort_order')
        .order('name')
      return error
        ? { available: false, rows: builtins }
        : { available: true, rows: data as DocumentType[] }
    },
  })
}

export function useDocumentNamings(firmId: string | undefined) {
  return useQuery({
    queryKey: documentNamingKey(firmId),
    enabled: Boolean(firmId),
    queryFn: async (): Promise<{
      available: boolean
      byLogicalId: Record<string, DocumentNaming>
    }> => {
      const source = table('crm_document_naming')
      if (!source || !firmId) return { available: false, byLogicalId: {} }
      const { data, error } = await source.select('*').eq('firm_id', firmId)
      return error
        ? { available: false, byLogicalId: {} }
        : {
            available: true,
            byLogicalId: Object.fromEntries(
              (data as DocumentNaming[]).map((naming) => [naming.logical_document_id, naming]),
            ),
          }
    },
  })
}

export function useNamingRules(firmId: string | undefined) {
  return useQuery({
    queryKey: namingRulesKey(firmId),
    enabled: Boolean(firmId),
    queryFn: async (): Promise<Listing<NamingRule>> => {
      const source = table('crm_document_naming_rules')
      if (!source || !firmId) return { available: false, rows: [] }
      const { data, error } = await source
        .select('id,rule,active')
        .eq('firm_id', firmId)
        .order('created_at')
      return error ? { available: false, rows: [] } : { available: true, rows: data as NamingRule[] }
    },
  })
}

export async function saveDocumentNaming(row: Omit<DocumentNaming, 'confirmed_at'>) {
  const source = table('crm_document_naming')
  if (!source) throw new Error('No hay conexión con el despacho.')
  const { error } = await source.upsert(row, { onConflict: 'logical_document_id' })
  if (error) throw error
}

async function run(query: PromiseLike<{ error: unknown }>) {
  const { error } = await query
  if (error) throw error
}

export const documentTypesApi = {
  create: (firmId: string, name: string, sortOrder: number, suggestions: string[]) =>
    run(
      table('crm_document_types')!.insert({
        firm_id: firmId,
        name,
        sort_order: sortOrder,
        suggestions,
      }),
    ),
  update: (id: string, patch: Partial<Pick<DocumentType, 'name' | 'suggestions' | 'sort_order' | 'active'>>) =>
    run(
      table('crm_document_types')!
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id),
    ),
  addRule: (firmId: string, rule: string) =>
    run(table('crm_document_naming_rules')!.insert({ firm_id: firmId, rule })),
  setRuleActive: (id: string, active: boolean) =>
    run(table('crm_document_naming_rules')!.update({ active }).eq('id', id)),
}