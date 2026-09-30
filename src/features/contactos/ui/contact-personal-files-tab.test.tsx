import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => null,
}))

import { ContactPersonalFilesTab } from './contact-personal-files-tab'

afterEach(cleanup)

describe('ContactPersonalFilesTab', () => {
  it('keeps the search icon clear of the input text', async () => {
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

    const input = await screen.findByRole('textbox', { name: 'Buscar documentos personales' })
    const icon = input.parentElement?.querySelector('svg')

    expect(input.className).toContain('!pl-10')
    expect(icon?.classList.contains('pointer-events-none')).toBe(true)
  })

  it('opens the upload dialog prefilled from a pending Lead requirement', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <ContactPersonalFilesTab
          firmId="firm-1"
          contactId="contact-1"
          relationship="Lead"
          requiredDocumentRequests={['Justificante de domicilio']}
          role="lawyer"
        />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Subir Justificante de domicilio' }))

    expect(
      (screen.getByLabelText('Nombre o descripción') as HTMLInputElement).value,
    ).toBe('Justificante de domicilio')
    expect((screen.getByLabelText('Categoría') as HTMLSelectElement).value).toBe('other')
    expect((screen.getByLabelText('Observaciones') as HTMLTextAreaElement).value).toContain(
      'Justificante de domicilio',
    )
  })
})
