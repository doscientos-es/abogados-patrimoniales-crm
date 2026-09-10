import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ auth: { getUser: mocks.getUser } }),
  isSupabaseConfigured: true,
}))

import { getCurrentAuthenticatedUser } from './session'

describe('getCurrentAuthenticatedUser', () => {
  beforeEach(() => vi.clearAllMocks())

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
})
