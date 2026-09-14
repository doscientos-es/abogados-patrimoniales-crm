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
  useActiveMembership: () => ({ data: null, isError: false, isLoading: false, refetch: mocks.refetch }),
}))

import { AccessGate } from './access-gate'

afterEach(() => {
  mocks.refetch.mockReset()
  mocks.updatePassword.mockReset()
  window.history.replaceState({}, '', '/')
})

describe('AccessGate', () => {
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