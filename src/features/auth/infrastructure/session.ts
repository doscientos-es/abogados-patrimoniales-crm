import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/shared/infrastructure/supabase'

import type { AuthenticatedUser } from '../application/auth-types'

export const isAuthProviderConfigured = isSupabaseConfigured

function toAuthenticatedUser(user: {
  id: string
  email?: string | null
  user_metadata?: { display_name?: unknown; full_name?: unknown } | null
}): AuthenticatedUser {
  const metadata = user.user_metadata
  const displayName =
    typeof metadata?.display_name === 'string'
      ? metadata.display_name.trim()
      : typeof metadata?.full_name === 'string'
        ? metadata.full_name.trim()
        : ''
  return { id: user.id, email: user.email ?? null, displayName: displayName || null }
}

export async function getCurrentAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const client = getSupabaseBrowserClient()
  if (!client) return null
  // Read the local session first. This keeps signed-out screens responsive even when
  // the Auth endpoint is temporarily unavailable.
  if (typeof client.auth.getSession === 'function') {
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    if (sessionError) throw sessionError
    if (!sessionData.session) return null
  }

  // Verify an existing token, but never leave the application in an infinite loading state.
  const verification = client.auth.getUser()
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('La verificación de sesión ha agotado el tiempo.')), 8_000),
  )
  const { data, error } = await Promise.race([verification, timeout])
  if (error) throw error
  return data.user ? toAuthenticatedUser(data.user) : null
}

export function subscribeToAuthStateChanges(listener: (user: AuthenticatedUser | null) => void) {
  const client = getSupabaseBrowserClient()
  if (!client) return () => undefined
  const { data } = client.auth.onAuthStateChange((_event, session) =>
    listener(session ? toAuthenticatedUser(session.user) : null),
  )
  return () => data.subscription.unsubscribe()
}

export async function signInWithSupabasePassword(email: string, password: string) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase no está configurado en este entorno.')
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOutOfSupabase() {
  const client = getSupabaseBrowserClient()
  if (!client) return
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function updateSupabasePassword(password: string) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase no está configurado en este entorno.')
  const { error } = await client.auth.updateUser({ password })
  if (error) throw error
}

export async function requestSupabasePasswordReset(email: string) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase no está configurado en este entorno.')
  const redirectTo = `${window.location.origin}/`
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}
