import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DriveSettings } from './drive-settings'

const invoke = vi.fn().mockResolvedValue({
  data: { rootFolderId: 'folder-123', rootFolderName: 'LEX · Expedientes' },
  error: null,
})
let connection: {
  firm_id: string
  root_folder_id: string
  root_folder_name: string
  status: 'disconnected' | 'connected' | 'error'
  last_sync_at: null
  last_error: null
  connected_at: null
  connected_by: null
  created_at: string
  updated_at: string
} | null = null

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: connection, error: null }) }),
      }),
    }),
    functions: { invoke },
  }),
}))

function renderSettings(role: 'owner' | 'lawyer' = 'owner') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DriveSettings actorRole={role} firmId="firm-1" />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  connection = null
  invoke.mockReset()
  invoke.mockResolvedValue({
    data: { rootFolderId: 'folder-123', rootFolderName: 'LEX · Expedientes' },
    error: null,
  })
})

describe('DriveSettings', () => {
  it('extracts the folder ID from a Drive URL before verifying the connection', async () => {
    renderSettings()

    const field = await screen.findByLabelText('Carpeta raíz de Drive')
    fireEvent.change(field, {
      target: { value: 'https://drive.google.com/drive/folders/folder-123?usp=drive_link' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y conectar' }))

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('configure-drive-connection', {
        body: { firmId: 'firm-1', rootFolderId: 'folder-123' },
      }),
    )
  })

  it('does not offer the connection action to members without administration permissions', async () => {
    renderSettings('lawyer')

    const field = (await screen.findByLabelText('Carpeta raíz de Drive')) as HTMLInputElement
    expect(screen.getByText('Sin conectar')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /verificar/i })).toBeNull()
    expect(field.disabled).toBe(true)
  })
})
