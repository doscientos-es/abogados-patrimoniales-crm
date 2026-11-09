import { useEffect, useState } from 'react'

import {
  getCurrentAuthenticatedUser,
  isAuthProviderConfigured,
  signInWithSupabasePassword,
  signOutOfSupabase,
  subscribeToAuthStateChanges,
  updateSupabasePassword,
  requestSupabasePasswordReset,
} from '../infrastructure/session'
import type { AuthSessionState } from './auth-types'

export type { AuthenticatedUser, AuthSessionState } from './auth-types'

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState<AuthSessionState>(() =>
    isAuthProviderConfigured
      ? { status: 'loading', user: null }
      : { status: 'unconfigured', user: null },
  )

  useEffect(() => {
    if (!isAuthProviderConfigured) return
    let active = true
    void getCurrentAuthenticatedUser()
      .then((user) => {
        if (!active) return
        setState(user ? { status: 'signed-in', user } : { status: 'signed-out', user: null })
      })
      .catch(() => {
        if (active) setState({ status: 'signed-out', user: null })
      })

    const unsubscribe = subscribeToAuthStateChanges((user) => {
      if (active)
        setState(user ? { status: 'signed-in', user } : { status: 'signed-out', user: null })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return state
}

export async function signInWithPassword(email: string, password: string) {
  await signInWithSupabasePassword(email, password)
}

export async function signOut() {
  await signOutOfSupabase()
}

export async function updatePassword(password: string) {
  await updateSupabasePassword(password)
}

export async function requestPasswordReset(email: string) {
  await requestSupabasePasswordReset(email)
}
