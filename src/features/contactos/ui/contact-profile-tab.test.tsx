import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

vi.mock('@/features/contactos', () => ({
  useActualizarPerfilContacto: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}))

import { ContactProfileTab } from './contact-profile-tab'

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
})

function renderProfile() {
  render(
    <ContactProfileTab
      firmId="firm-1"
      contact={{
        id: 'contact-1',
        version: 3,
        origen: 'Web',
        creado: '24/09/2026',
        profile: undefined,
      } as never}
      userId="user-1"
      role="lawyer"
    />,
  )
}

describe('ContactProfileTab', () => {
  it('preserva la observación de satisfacción si falla el guardado', async () => {
    mocks.mutateAsync.mockRejectedValueOnce({ message: 'Fallo de PostgREST' })
    renderProfile()

    const note = screen.getByLabelText('Observación de la valoración') as HTMLInputElement
    fireEvent.change(note, { target: { value: 'Requiere seguimiento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar valoración' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Fallo de PostgREST'))
    expect(note.value).toBe('Requiere seguimiento')
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('preserva la descripción de incidencia si falla el guardado', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('Fallo de persistencia'))
    renderProfile()

    const description = screen.getByLabelText('Descripción de la incidencia') as HTMLInputElement
    fireEvent.change(description, { target: { value: 'Pendiente de revisión' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Fallo de persistencia'))
    expect(description.value).toBe('Pendiente de revisión')
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })
})