import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

import { Documents } from './documents'

const moveDocument = vi.fn().mockResolvedValue({ error: null })
const moveFolder = vi.fn().mockResolvedValue({ error: null })
const createFolder = vi.fn().mockResolvedValue({ error: null })
const archiveDocument = vi.fn().mockResolvedValue({ error: null })
const updateDocumentWorkflow = vi.fn().mockResolvedValue({ error: null })
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
  workflow_status: 'inbox',
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
                    {
                      id: 'folder-2',
                      firm_id: 'firm-1',
                      case_id: 'case-1',
                      parent_id: null,
                      name: 'Pruebas',
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
      if (name === 'crm_move_document_folder') return moveFolder(args)
      if (name === 'crm_create_document_folder') return createFolder(args)
      if (name === 'crm_archive_case_document') return archiveDocument(args)
      if (name === 'crm_update_document_workflow') return updateDocumentWorkflow(args)
      return Promise.resolve({ error: null })
    },
  }),
}))

function renderDocuments() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Documents />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  documentQueryFails = false
  hasDocuments = true
  hasFolders = true
  moveDocument.mockClear()
  moveFolder.mockClear()
  createFolder.mockClear()
  archiveDocument.mockClear()
  updateDocumentWorkflow.mockClear()
})

describe('Documents', () => {
  it('offers a keyboard-accessible, confirmed alternative to drag and drop', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir acciones de Poder notarial.pdf' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mover' }))

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

  it('offers a confirmed keyboard alternative for moving folders', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir acciones de la carpeta Escritos' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover carpeta' }))
    expect(screen.getByRole('dialog', { name: 'Mover carpeta' }).textContent).toContain(
      'Sus archivos y subcarpetas se conservarán.',
    )
    fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'folder-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar movimiento' }))

    await waitFor(() =>
      expect(moveFolder).toHaveBeenCalledWith({
        target_folder_id: 'folder-1',
        target_parent_id: 'folder-2',
      }),
    )
  })

  it('archives a document only after an explicit confirmation', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir acciones de Poder notarial.pdf' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archivar' }))

    expect(screen.getByRole('dialog', { name: 'Archivar documento' }).textContent).toContain(
      'todas sus versiones dejarán de estar disponibles',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }))

    await waitFor(() =>
      expect(archiveDocument).toHaveBeenCalledWith({
        target_document_id: 'document-1',
        target_expected_version: 1,
      }),
    )
  })

  it('reports the selected folder so the route can persist it in the URL', async () => {
    const onLocationChange = vi.fn()
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Documents
          location={{ caseId: 'case-1', folderId: null }}
          onLocationChange={onLocationChange}
        />
      </QueryClientProvider>,
    )

    fireEvent.click((await screen.findAllByRole('button', { name: 'Abrir carpeta Escritos' }))[0]!)
    expect(onLocationChange).toHaveBeenCalledWith({ caseId: 'case-1', folderId: 'folder-1' })
  })

  it('shows the same location in grid or list view', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )

    expect(
      screen.getByRole('button', { name: 'Vista de cuadrícula' }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Vista de lista' }))

    expect(screen.getByRole('list', { name: 'Documentos en lista' })).toBeTruthy()
    expect(screen.getByText('Poder notarial.pdf')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Vista de lista' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('shows root actions only while listing the document cases', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Documents rootActions={<button type="button">Nuevo expediente</button>} />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('button', { name: 'Nuevo expediente' })).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    expect(screen.queryByRole('button', { name: 'Nuevo expediente' })).toBeNull()
  })

  it('shows workflow independently of folders and persists a state transition', async () => {
    renderDocuments()
    fireEvent.click(await screen.findByRole('button', { name: /flujo documental/i }))

    expect(screen.getByRole('heading', { name: 'Flujo documental' })).toBeTruthy()
    expect(screen.getByText('Poder notarial.pdf')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Estado de Poder notarial.pdf'), {
      target: { value: 'in_progress' },
    })

    await waitFor(() =>
      expect(updateDocumentWorkflow).toHaveBeenCalledWith({
        target_document_id: 'document-1',
        target_expected_version: 1,
        target_workflow_status: 'in_progress',
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
