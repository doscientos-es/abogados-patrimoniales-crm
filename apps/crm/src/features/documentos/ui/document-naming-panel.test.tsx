import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ functions: { invoke: mocks.invoke } }),
}))

vi.mock('../document-naming-data', () => ({
  documentNamingKey: () => ['document-naming'],
  saveDocumentNaming: vi.fn(),
  useDocumentNamings: () => ({ data: { available: true, byLogicalId: {} }, isLoading: false }),
  useDocumentTypes: () => ({
    data: {
      available: true,
      rows: [{ id: 'contract', name: 'CONTRATO', active: true, suggestions: [] }],
    },
    isLoading: false,
  }),
}))

import { DocumentNamingPanel } from './document-naming-panel'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DocumentNamingPanel', () => {
  it('analyses a confidential document directly and keeps the suggestion for review', async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        suggestion: {
          typeName: 'CONTRATO',
          confidence: 0.9,
          description: 'Arrendamiento',
          documentDate: null,
          parties: [],
          court: null,
          procedureNumber: null,
        },
      },
      error: null,
    })
    const document = {
      id: 'doc-1',
      logical_document_id: 'logical-1',
      case_id: 'case-1',
      original_name: 'archivo.pdf',
      mime_type: 'application/pdf',
      confidentiality: 'confidential',
      is_current: true,
      content_status: 'validated',
      archived_at: null,
    } as never
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DocumentNamingPanel document={document} firmId="firm-1" stage={null} />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Analizar con LEXIA' }))
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('classify-case-document', {
        body: { documentId: 'doc-1', allowConfidential: true },
      }),
    )
    expect(await screen.findByText(/Propuesta de LEXIA \(confianza 90/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sí, que LEXIA lea/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirmar nombre' })).toBeTruthy()
  })
})
