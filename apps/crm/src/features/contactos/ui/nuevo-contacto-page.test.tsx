import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  refetch: vi.fn(),
  navigate: vi.fn(),
  upload: vi.fn(),
  toastError: vi.fn(),
  duplicateCandidates: [] as {
    id: string
    name: string
    taxId: string | null
    email: string | null
    alternateEmail: string | null
    phone: string | null
    alternatePhone: string | null
  }[],
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode
    to: string
    params?: { id: string }
  }) => <a href={params ? `/contactos/${params.id}` : to}>{children}</a>,
  useNavigate: () => mocks.navigate,
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/contactos', () => ({
  useCrearContacto: () => ({ mutateAsync: mocks.create, isPending: false }),
  uploadContactDocument: mocks.upload,
  useContactDuplicateCandidates: () => ({
    data: mocks.duplicateCandidates,
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
  mocks.duplicateCandidates = []
})

describe('detección de contactos duplicados al dar de alta', () => {
  it('avisa del teléfono repetido, permite abrir el contacto y exige confirmación para continuar', async () => {
    const existing = {
      id: 'existing',
      name: 'Contacto existente',
      taxId: null,
      email: null,
      alternateEmail: null,
      phone: '+34 600 123 456',
      alternatePhone: null,
    }
    mocks.duplicateCandidates = [existing]
    mocks.refetch.mockResolvedValue({ data: [existing], isError: false })
    mocks.create.mockResolvedValue({ id: 'new-contact' })
    mocks.navigate.mockResolvedValue(undefined)
    render(<NuevoContactoPage />)
    fireEvent.input(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    fireEvent.input(screen.getByLabelText('Teléfono'), { target: { value: '600123456' } })
    expect(screen.getByText('Contacto existente')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Contacto existente' }).getAttribute('href')).toBe(
      '/contactos/existing',
    )
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

  it('bloquea un documento duplicado y ofrece abrir la ficha existente', async () => {
    const existing = {
      id: 'existing',
      name: 'Contacto con el mismo DNI',
      taxId: '12345678Z',
      email: null,
      alternateEmail: null,
      phone: null,
      alternatePhone: null,
    }
    mocks.duplicateCandidates = [existing]
    mocks.refetch.mockResolvedValue({ data: [existing], isError: false })
    render(<NuevoContactoPage />)

    fireEvent.input(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    fireEvent.input(screen.getByLabelText('NIF'), { target: { value: '1234 5678-Z' } })
    expect(screen.getByRole('link', { name: existing.name }).getAttribute('href')).toBe(
      '/contactos/existing',
    )
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))

    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce())
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Ya existe'))
  })
})

describe('documentos del alta', () => {
  it('cancela el alta integrada sin navegar', () => {
    const onCancel = vi.fn()
    render(<NuevoContactoPage onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('devuelve el contacto creado al diálogo sin navegar', async () => {
    const onCreated = vi.fn()
    mocks.create.mockResolvedValue({ id: 'new-contact', nombre: 'Ana' })
    render(<NuevoContactoPage onCreated={onCreated} />)
    fireEvent.input(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-contact' })),
    )
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

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
