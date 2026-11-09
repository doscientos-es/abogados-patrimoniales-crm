import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), updateUser: vi.fn() }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
    },
  }),
  isSupabaseConfigured: true,
}))

import { getCurrentAuthenticatedUser, updateSupabasePassword } from './session'

describe('getCurrentAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test' } }, error: null })
  })

  it('verifies the stored session with Supabase Auth before granting access', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'abogada@example.com' } },
      error: null,
    })

    await expect(getCurrentAuthenticatedUser()).resolves.toEqual({
      id: 'user-1',
      email: 'abogada@example.com',
      displayName: null,
    })
    expect(mocks.getUser).toHaveBeenCalledOnce()
  })

  it('rejects an invalid stored token so AccessGate returns to the login form', async () => {
    const error = new Error('Auth session missing')
    mocks.getUser.mockResolvedValue({ data: { user: null }, error })

    await expect(getCurrentAuthenticatedUser()).rejects.toThrow('Auth session missing')
  })

  it('rejects a password update when the recovery session is no longer valid', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })

    await expect(updateSupabasePassword('nueva-clave')).rejects.toThrow(
      'La sesión de recuperación ha caducado o ya se ha utilizado.',
    )
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password when a recovery session is available', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'test' } }, error: null })
    mocks.updateUser.mockResolvedValue({ error: null })

    await expect(updateSupabasePassword('nueva-clave')).resolves.toBeUndefined()
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'nueva-clave' })
  })
})
