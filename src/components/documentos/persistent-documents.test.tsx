import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { PersistentDocuments } from './persistent-documents'

const moveDocument = vi.fn().mockResolvedValue({ error: null })
let documentQueryFails = false
const document: CaseDocumentRow = {
  id: 'document-1',
  firm_id: 'firm-1',
  case_id: 'case-1',
  workstream_id: null,
  folder_id: null,
  logical_document_id: 'logical-1',
  previous_version_id: null,
  version: 1,
  category: 'General',
  original_name: 'Poder notarial.pdf',
  storage_path: 'firm-1/case-1/poder.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1024,
  confidentiality: 'normal',
  checksum_sha256: 'a'.repeat(64),
  content_status: 'validated',
  is_current: true,
  archived_at: null,
  archived_by: null,
  created_by: 'user-1',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/expedientes', () => ({
  useExpedientesPersistentes: () => ({
    data: [{ id: 'case-1', referencia: 'EXP-001', titulo: 'Herencia de Ana' }],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === 'crm_case_documents') {
          return {
            eq: () => ({
              eq: () => ({
                is: () => ({
                  order: async () => ({
                    data: documentQueryFails ? null : [document],
                    error: documentQueryFails ? new Error('offline') : null,
                  }),
                }),
              }),
            }),
          }
        }
        return {
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: 'folder-1',
                  firm_id: 'firm-1',
                  case_id: 'case-1',
                  parent_id: null,
                  name: 'Escritos',
                  created_by: 'user-1',
                  created_at: '2026-01-01',
                  updated_at: '2026-01-01',
                },
              ],
              error: null,
            }),
          }),
        }
      },
    }),
    rpc: (name: string, args: unknown) =>
      name === 'crm_move_case_document' ? moveDocument(args) : Promise.resolve({ error: null }),
  }),
}))

function renderDocuments() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PersistentDocuments />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  documentQueryFails = false
  moveDocument.mockClear()
})

describe('PersistentDocuments', () => {
  it('offers a keyboard-accessible, confirmed alternative to drag and drop', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Mover' }))

    const dialog = screen.getByRole('dialog', { name: 'Mover documento' })
    expect(dialog.textContent).toContain('El archivo y su historial de versiones no cambiarán.')
    const destination = screen.getByLabelText('Destino') as HTMLSelectElement
    fireEvent.change(destination, { target: { value: 'folder-1' } })
    const confirm = screen.getByRole('button', { name: 'Confirmar movimiento' })
    expect(confirm).not.toHaveProperty('disabled', true)
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(moveDocument).toHaveBeenCalledWith({
        target_document_id: 'document-1',
        target_folder_id: 'folder-1',
      }),
    )
  })

  it('explains a loading failure and provides a recovery action', async () => {
    documentQueryFails = true
    renderDocuments()

    expect((await screen.findByRole('alert')).textContent).toContain(
      'No se pudieron cargar los documentos',
    )
    expect(screen.getByRole('button', { name: 'Reintentar carga' })).toBeTruthy()
  })
})
