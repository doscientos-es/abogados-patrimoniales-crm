import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => null,
}))

import { ContactPersonalFilesTab } from './contact-personal-files-tab'

afterEach(cleanup)

describe('ContactPersonalFilesTab', () => {
  it('shows the document count and upload action without a search field', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const memberRole = 'lawyer' as const
    render(
      <QueryClientProvider client={queryClient}>
        <ContactPersonalFilesTab
          firmId="firm-1"
          contactId="contact-1"
          relationship="Lead"
          role={memberRole}
        />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('0 documentos')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Subir documentos' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Buscar documentos personales' })).toBeNull()
  })

  it('opens the upload dialog prefilled from a pending Lead requirement', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const memberRole = 'admin' as const
    render(
      <QueryClientProvider client={queryClient}>
        <ContactPersonalFilesTab
          firmId="firm-1"
          contactId="contact-1"
          relationship="Lead"
          requiredDocumentRequests={['Justificante de domicilio']}
          role={memberRole}
        />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Subir Justificante de domicilio' }))

    expect((screen.getByLabelText('Nombre o descripción') as HTMLInputElement).value).toBe(
      'Justificante de domicilio',
    )
    expect((screen.getByLabelText('Categoría') as HTMLSelectElement).value).toBe('other')
    expect((screen.getByLabelText('Observaciones') as HTMLTextAreaElement).value).toContain(
      'Justificante de domicilio',
    )
  })

  it('shows document sections and opens an upload with the selected category', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const memberRole = 'lawyer' as const
    render(
      <QueryClientProvider client={client}>
        <ContactPersonalFilesTab
          firmId="firm-1"
          contactId="contact-1"
          relationship="Lead"
          role={memberRole}
        />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Falta Identificación')).toBeTruthy()
    expect(screen.getByText('Falta Protección de datos')).toBeTruthy()
    expect(screen.getByText('Falta Poderes y autorizaciones')).toBeTruthy()
    expect(screen.getAllByText('Sin archivos incorporados.')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Subir Poderes y autorizaciones' }))
    expect((screen.getByLabelText('Categoría') as HTMLSelectElement).value).toBe('power')
  })

  it('shows stored documents and their section status', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
    const memberRole = 'lawyer' as const
    client.setQueryData(
      ['contact-documents', 'firm-1', 'contact-1'],
      [
        {
          id: 'doc-1',
          document_type: 'identification',
          name: 'DNI',
          original_name: 'dni.pdf',
          document_status: 'current',
          document_number: 'TEST-123',
          issued_on: '2026-01-02',
          expires_on: '2099-01-02',
          signed_on: null,
          observations: 'Documento revisado',
          tags: [],
          created_at: '2026-01-01',
        },
        {
          id: 'doc-2',
          document_type: 'other',
          name: 'Justificante',
          original_name: 'justificante.pdf',
          document_status: 'pending',
          document_number: '',
          issued_on: null,
          expires_on: null,
          signed_on: null,
          observations: '',
          tags: [],
          created_at: '2026-01-01',
        },
      ],
    )
    render(
      <QueryClientProvider client={client}>
        <ContactPersonalFilesTab
          firmId="firm-1"
          contactId="contact-1"
          relationship="Lead"
          role={memberRole}
        />
      </QueryClientProvider>,
    )

    const title = screen.getByText('Identificación', { selector: '[data-slot="card-title"]' })
    const card = title.closest('[data-slot="card"]') as HTMLElement
    expect(within(card).getByText('Incorporado')).toBeTruthy()
    expect(within(card).getByText('DNI')).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'dni.pdf' })).toBeTruthy()
    expect(within(card).getByText('Vigente')).toBeTruthy()
    expect(within(card).getByText('Documento revisado')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'justificante.pdf' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('TEST-123')).toBeNull()
    expect(screen.queryByText('Expedición')).toBeNull()
    expect(screen.queryByText('Falta Identificación')).toBeNull()
  })
})
