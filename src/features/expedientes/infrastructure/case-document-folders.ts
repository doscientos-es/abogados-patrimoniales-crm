import { useQuery, useQueryClient } from '@tanstack/react-query'

import { getSupabaseBrowserClient, type CaseDocumentRow } from '@/shared/infrastructure/supabase'

/** Same cache keys as the Documents page, so both screens refresh each other. */
export const caseFoldersKey = (firmId: string | undefined) => ['document-folders', firmId]

export function useCaseFolders(firmId: string | undefined, caseId: string) {
  return useQuery({
    queryKey: caseFoldersKey(firmId),
    enabled: Boolean(firmId),
    queryFn: async () => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_document_folders')
        .select('*')
        .eq('firm_id', firmId)
        .order('name')
      if (error) throw error
      return data
    },
    select: (rows) => rows.filter((folder) => folder.case_id === caseId),
  })
}

export function useCreateCaseFolder(firmId: string | undefined, caseId: string) {
  const queryClient = useQueryClient()
  return async (name: string, parentId: string | null) => {
    const client = getSupabaseBrowserClient()
    if (!client || !firmId) throw new Error('No hay un despacho activo.')
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) throw new Error('Escribe el nombre de la carpeta.')
    const { error } = await client.rpc('crm_create_document_folder', {
      target_firm_id: firmId,
      target_case_id: caseId,
      target_parent_id: parentId,
      folder_name: clean,
    })
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: caseFoldersKey(firmId) })
    return clean
  }
}

/** Versions of one logical document, newest first. Only loaded when the row is expanded. */
export function useDocumentVersions(
  firmId: string | undefined,
  logicalDocumentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['document-versions', firmId, logicalDocumentId],
    enabled: Boolean(firmId) && enabled,
    queryFn: async (): Promise<CaseDocumentRow[]> => {
      const client = getSupabaseBrowserClient()
      if (!client || !firmId) return []
      const { data, error } = await client
        .from('crm_case_documents')
        .select('*')
        .eq('firm_id', firmId)
        .eq('logical_document_id', logicalDocumentId)
        .order('version', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
