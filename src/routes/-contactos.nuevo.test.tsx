import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createContact: vi.fn().mockResolvedValue({ id: 'contact-1' }),
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({
    children,
    to,
    ...props
  }: { children: ReactNode; to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
}))

vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))

vi.mock('@/features/contactos', () => ({
  useCrearContacto: () => ({ isPending: false, mutateAsync: mocks.createContact }),
}))

import { NuevoContactoPage } from '@/features/contactos/ui/nuevo-contacto-page'

afterEach(() => {
  cleanup()
  mocks.createContact.mockReset().mockResolvedValue({ id: 'contact-1' })
  mocks.navigate.mockClear()
})

describe('NuevoContactoPage', () => {
  it('configura valores iniciales, tipos de campo y ayudas accesibles', () => {
    render(<NuevoContactoPage />)

    expect(
      screen.getByRole('form', { name: 'Formulario de nuevo contacto' }).getAttribute('aria-busy'),
    ).toBe('false')
    expect((screen.getByLabelText('País') as HTMLInputElement).value).toBe('España')
    expect((screen.getByLabelText('Origen') as HTMLInputElement).value).toBe('Web')

    const postalCode = screen.getByLabelText('Código postal')
    expect(postalCode.getAttribute('inputmode')).toBe('numeric')
    expect(postalCode.getAttribute('pattern')).toBe('[0-9]{5}')
    expect(postalCode.getAttribute('maxlength')).toBe('5')
    expect(postalCode.getAttribute('aria-describedby')).toBe('contact-codigoPostal-description')
    expect(screen.getByText('Introduce los cinco dígitos del código postal.')).toBeTruthy()

    fireEvent.input(postalCode, { target: { value: '28A0-13' } })
    expect((postalCode as HTMLInputElement).value).toBe('28013')
  })

  it('envía los valores normalizados y abre la ficha creada', async () => {
    render(<NuevoContactoPage />)

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: ' Ana ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))

    await waitFor(() =>
      expect(mocks.createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoPersona: 'Persona física',
          relacion: 'Lead',
          valores: expect.objectContaining({ nombre: 'Ana', pais: 'España', origen: 'Web' }),
        }),
      ),
    )
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/contactos/$id',
      params: { id: 'contact-1' },
    })
  })
})
