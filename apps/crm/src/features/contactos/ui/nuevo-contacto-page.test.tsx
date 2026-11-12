import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  refetch: vi.fn(),
  navigate: vi.fn(),
  upload: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/contactos">{children}</a>,
  useNavigate: () => mocks.navigate,
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/contactos', () => ({
  useCrearContacto: () => ({ mutateAsync: mocks.create, isPending: false }),
  uploadContactDocument: mocks.upload,
  useContactPhoneCandidates: () => ({
    data: [
      {
        id: 'existing',
        name: 'Contacto existente',
        phone: '+34 600 123 456',
        alternatePhone: null,
      },
    ],
    refetch: mocks.refetch,
  }),
}))
vi.mock('@/features/notas', () => ({
  useCrearNotaPersona: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./contact-ai-intake', () => ({
  ContactAIIntake: ({
    onApply,
  }: {
    onApply: (values: Record<string, string>, files: File[]) => void
  }) => (
    <button
      type="button"
      onClick={() => onApply({}, [new File(['pdf'], 'dni.pdf', { type: 'application/pdf' })])}
    >
      Preparar documento
    </button>
  ),
}))

import { NuevoContactoPage } from './nuevo-contacto-page'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('alta de contacto con teléfono compartido', () => {
  it('avisa, exige confirmación y permite crear después de revisar la coincidencia', async () => {
    const existing = {
      id: 'existing',
      name: 'Contacto existente',
      phone: '+34 600 123 456',
      alternatePhone: null,
    }
    mocks.refetch.mockResolvedValue({ data: [existing], isError: false })
    mocks.create.mockResolvedValue({ id: 'new-contact' })
    mocks.navigate.mockResolvedValue(undefined)
    render(<NuevoContactoPage />)
    fireEvent.input(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    fireEvent.input(screen.getByLabelText('Teléfono'), { target: { value: '600123456' } })
    expect(screen.getByText('Contacto existente')).toBeTruthy()
    const form = screen.getByRole('form', { name: 'Formulario de nuevo contacto' })
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalled())
    expect(mocks.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText(/He revisado las coincidencias/))
    fireEvent.submit(form)
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/contactos/$id',
        params: { id: 'new-contact' },
      }),
    )
    expect(mocks.create).toHaveBeenCalledOnce()
  })
})

describe('documentos del alta', () => {
  it.each([false, true])(
    'adjunta el documento y comunica el fallo si ocurre: %s',
    async (fails) => {
      mocks.create.mockResolvedValue({ id: 'new-contact' })
      mocks.navigate.mockResolvedValue(undefined)
      if (fails) mocks.upload.mockRejectedValueOnce(new Error('Error de subida'))
      else mocks.upload.mockResolvedValueOnce(undefined)
      render(<NuevoContactoPage />)
      fireEvent.input(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
      fireEvent.click(screen.getByRole('button', { name: 'Preparar documento' }))
      fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))
      await waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
      expect(mocks.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          firmId: 'firm-1',
          contactId: 'new-contact',
          name: 'dni.pdf',
          type: 'identification',
          file: expect.any(File),
        }),
      )
      if (fails) expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('dni.pdf'))
      else expect(mocks.toastError).not.toHaveBeenCalled()
    },
  )
})
