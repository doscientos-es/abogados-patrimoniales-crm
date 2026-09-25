import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CaseDocumentRow, DriveConnectionRow, TaskRow } from '@/shared/infrastructure/supabase'

import { Documents } from './documents'

const moveDocument = vi.fn().mockResolvedValue({ error: null })
const moveFolder = vi.fn().mockResolvedValue({ error: null })
const createFolder = vi.fn().mockResolvedValue({ error: null })
const archiveDocument = vi.fn().mockResolvedValue({ error: null })
const updateDocumentWorkflow = vi.fn().mockResolvedValue({ error: null })
const linkDocumentTask = vi.fn().mockResolvedValue({ error: null })
let documentQueryFails = false
let hasDocuments = true
let hasFolders = true
let driveConnection: Pick<DriveConnectionRow, 'status'> | null = null
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
const archivedDocument: CaseDocumentRow = {
  ...document,
  id: 'document-archived',
  logical_document_id: 'logical-archived',
  original_name: 'Poder notarial archivado.pdf',
  archived_at: '2026-01-02',
}
const task: TaskRow = {
  id: 'task-1',
  firm_id: 'firm-1',
  opportunity_id: null,
  case_id: 'case-1',
  workstream_id: null,
  kind: 'task',
  title: 'Preparar escrito de subsanación',
  description: '',
  status: 'pending',
  priority: 'medium',
  due_on: null,
  due_at: null,
  reminder_at: null,
  deadline_class: null,
  validation_status: 'not_required',
  deadline_source: '',
  validation_note: '',
  validated_by: null,
  validated_at: null,
  completed_at: null,
  critical: false,
  board_position: null,
  assigned_to: null,
  is_next_action: false,
  waiting_reason: null,
  waiting_until: null,
  waiting_detail: '',
  completion_result: '',
  cancellation_reason: '',
  opened_at: null,
  opened_by: null,
  rejection_reason: '',
  rejected_at: null,
  parent_task_id: null,
  meeting_details: {},
  details: {},
  version: 1,
  created_by: 'user-1',
  updated_by: 'user-1',
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
                not: () => ({
                  order: async () => ({
                    data: hasDocuments ? [archivedDocument] : [],
                    error: null,
                  }),
                }),
                order: async () => ({ data: [document], error: null }),
              }),
            }),
          }
        }
        if (table === 'crm_tasks') {
          return {
            eq: () => ({
              eq: () => ({ order: async () => ({ data: [task], error: null }) }),
            }),
          }
        }
        if (table === 'crm_document_task_links') {
          return {
            eq: () => ({
              eq: () => ({ order: async () => ({ data: [], error: null }) }),
            }),
          }
        }
        if (table === 'crm_drive_connections') {
          return {
            eq: () => ({ maybeSingle: async () => ({ data: driveConnection, error: null }) }),
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
      if (name === 'crm_link_document_task') return linkDocumentTask(args)
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
  driveConnection = null
  moveDocument.mockClear()
  moveFolder.mockClear()
  createFolder.mockClear()
  archiveDocument.mockClear()
  updateDocumentWorkflow.mockClear()
  linkDocumentTask.mockClear()
})

describe('Documents', () => {
  it('shows when Google Drive is connected for the current firm', async () => {
    driveConnection = { status: 'connected' }
    renderDocuments()

    expect(await screen.findByLabelText('Estado de Google Drive: Conectado')).toBeTruthy()
  })

  it('offers a keyboard-accessible, confirmed alternative to drag and drop', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir acciones de Poder notarial.pdf' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Mover' }))

    const dialog = screen.getByRole('dialog', { name: 'Mover documento' })
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(dialog.className).toContain('overflow-y-auto')
    expect(
      screen
        .getByRole('button', { name: 'Confirmar movimiento' })
        .closest('[data-slot="dialog-footer"]')?.className,
    ).toContain('sticky')
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

    const [folderButton] = await screen.findAllByRole('button', {
      name: 'Abrir carpeta Escritos',
    })
    if (!folderButton) throw new Error('No se encontró la carpeta Escritos.')
    fireEvent.click(folderButton)
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

  it('groups explorer actions with the view controls and filters documents', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )

    expect(screen.getByRole('button', { name: 'Nueva carpeta' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Subir archivo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir filtros de documentos' }))

    expect(screen.getByLabelText('Confidencialidad')).toBeTruthy()
    expect(screen.getByLabelText('Flujo documental')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Validación'), { target: { value: 'pending' } })
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Abrir filtros de documentos' }), {
      key: 'Escape',
    })

    expect(
      await screen.findByRole('heading', { name: 'No hay documentos que coincidan' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer filtros' }))
    expect(screen.getByText('Poder notarial.pdf')).toBeTruthy()
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

    expect(await screen.findByRole('heading', { name: 'Flujo documental' })).toBeTruthy()
    const searchInput = screen.getByRole('textbox', { name: 'Buscar documento' })
    expect(searchInput.className).toContain('leading-normal')
    expect(screen.getByRole('heading', { name: 'Pendiente de tratar' })).toBeTruthy()
    expect(screen.getByText('Poder notarial.pdf')).toBeTruthy()
    expect(screen.getByText('Poder notarial archivado.pdf')).toBeTruthy()
    expect(screen.queryByLabelText('Estado de Poder notarial archivado.pdf')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver documento Poder notarial.pdf' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ver detalle de Poder notarial.pdf' })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Ver expediente de Poder notarial.pdf' }),
    ).toBeTruthy()
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

  it('moves a validated document between active workflow columns by dragging its handle', async () => {
    renderDocuments()
    fireEvent.click(await screen.findByRole('button', { name: /flujo documental/i }))

    const dataTransfer = {
      effectAllowed: '',
      getData: vi.fn(() => 'document-1'),
      setData: vi.fn(),
    }
    fireEvent.dragStart(
      await screen.findByRole('button', { name: 'Arrastrar Poder notarial.pdf' }),
      {
        dataTransfer,
      },
    )
    const targetColumn = screen.getByRole('heading', { name: 'En tratamiento' }).closest('section')
    if (!targetColumn) throw new Error('No se encontró la columna de destino.')
    fireEvent.dragOver(targetColumn, { dataTransfer })
    expect(targetColumn.className).toContain('ring-2')
    fireEvent.drop(targetColumn, { dataTransfer })

    await waitFor(() =>
      expect(updateDocumentWorkflow).toHaveBeenCalledWith({
        target_document_id: 'document-1',
        target_expected_version: 1,
        target_workflow_status: 'in_progress',
      }),
    )
  })

  it('opens a document sheet with versions and lets the user link an existing case task', async () => {
    renderDocuments()
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir documentos del expediente exp-001/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir acciones de Poder notarial.pdf' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Ver detalle' }))

    expect(await screen.findByRole('dialog', { name: 'Poder notarial.pdf' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Versiones' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tareas y plazos vinculados' })).toBeTruthy()
    expect(
      await screen.findByRole('option', { name: 'Preparar escrito de subsanación' }),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tarea existente para vincular'), {
      target: { value: 'task-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular' }))

    await waitFor(() =>
      expect(linkDocumentTask).toHaveBeenCalledWith({
        target_document_id: 'document-1',
        target_task_id: 'task-1',
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
