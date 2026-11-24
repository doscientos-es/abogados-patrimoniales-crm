import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ refetch: vi.fn(), updatePassword: vi.fn() }))

vi.mock('../application/auth-session', () => ({
  requestPasswordReset: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updatePassword: mocks.updatePassword,
  useAuthSession: () => ({
    status: 'signed-in' as const,
    user: { displayName: 'María', email: 'maria@despacho.es', id: 'user-1' },
  }),
}))
vi.mock('../application/membership', () => ({
  useActiveMembership: () => ({
    data: null,
    isError: false,
    isLoading: false,
    refetch: mocks.refetch,
  }),
}))

import { AccessGate, AccountMenu } from './access-gate'

afterEach(() => {
  mocks.refetch.mockReset()
  mocks.updatePassword.mockReset()
  window.history.replaceState({}, '', '/')
})

describe('AccessGate', () => {
  it('shows only the name in the account button and keeps the email in the menu', async () => {
    render(<AccountMenu />)

    const button = screen.getByRole('button', { name: 'Abrir menú de cuenta' })
    expect(button.textContent).toContain('María')
    expect(button.textContent).not.toContain('maria@despacho.es')
    fireEvent.click(button)
    expect(await screen.findByText('maria@despacho.es')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy()
  })

  it('opens the account menu from the compact avatar', async () => {
    render(<AccountMenu compact />)
    const button = screen.getByRole('button', { name: 'Abrir menú de cuenta' })
    expect(button.textContent).not.toContain('María')
    fireEvent.click(button)
    expect(await screen.findByText('maria@despacho.es')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy()
  })

  it('lets an invited user create a password before membership activation completes', async () => {
    mocks.refetch.mockResolvedValue(undefined)
    mocks.updatePassword.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/#type=invite')

    render(<AccessGate>Contenido privado</AccessGate>)

    expect(screen.getByText('Crea tu contraseña')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'nueva-clave' } })
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
      target: { value: 'nueva-clave' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar en LEX' }))

    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith('nueva-clave'))
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce())
  })

  it('opens the password form directly from a recovery link', async () => {
    mocks.refetch.mockResolvedValue(undefined)
    mocks.updatePassword.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/#type=recovery')

    render(<AccessGate>Contenido privado</AccessGate>)

    expect(screen.getByText('Restablece tu contraseña')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'nueva-clave' } })
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
      target: { value: 'nueva-clave' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))

    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith('nueva-clave'))
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledOnce())
  })
})
