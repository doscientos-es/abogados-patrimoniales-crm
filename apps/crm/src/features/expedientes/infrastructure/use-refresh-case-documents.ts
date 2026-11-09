import { useQueryClient } from '@tanstack/react-query'

/**
 * Refreshes every list that shows the documents of a case: this tab and the Documents page.
 * Call it after any upload so both screens stay in sync.
 */
export function useRefreshCaseDocuments(firmId: string | undefined, caseId: string) {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ['expedientes', firmId, caseId, 'documentos'] })
    void queryClient.invalidateQueries({ queryKey: ['documents', firmId] })
  }
}
