import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { PersistentDocuments } from './persistent-documents'

const moveDocument = vi.fn().mockResolvedValue({ error: null })
const createFolder = vi.fn().mockResolvedValue({ error: null })
let documentQueryFails = false
let hasDocuments = true
let hasFolders = true
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
                    data: documentQueryFails ? null : hasDocuments ? [document] : [],
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
              data: hasFolders
                ? [
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
                  ]
                : [],
              error: null,
            }),
          }),
        }
      },
    }),
    rpc: (name: string, args: unknown) => {
      if (name === 'crm_move_case_document') return moveDocument(args)
      if (name === 'crm_create_document_folder') return createFolder(args)
      return Promise.resolve({ error: null })
    },
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
  hasDocuments = true
  hasFolders = true
  moveDocument.mockClear()
  createFolder.mockClear()
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

  it('allows creating the first folder before any document is uploaded', async () => {
    hasDocuments = false
    hasFolders = false
    renderDocuments()

    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva carpeta' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Escritos' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear carpeta' }))

    await waitFor(() =>
      expect(createFolder).toHaveBeenCalledWith({
        target_firm_id: 'firm-1',
        target_case_id: 'case-1',
        target_parent_id: null,
        folder_name: 'Escritos',
      }),
    )
  })

  it('reports the selected folder so the route can persist it in the URL', async () => {
    const onLocationChange = vi.fn()
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <PersistentDocuments
          location={{ caseId: 'case-1', folderId: null }}
          onLocationChange={onLocationChange}
        />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir carpeta Escritos' }))
    expect(onLocationChange).toHaveBeenCalledWith({ caseId: 'case-1', folderId: 'folder-1' })
  })

  it('shows root actions only while listing the document cases', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <PersistentDocuments rootActions={<button type="button">Nuevo expediente</button>} />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Nuevo expediente' })).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    expect(screen.queryByRole('button', { name: 'Nuevo expediente' })).toBeNull()
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
