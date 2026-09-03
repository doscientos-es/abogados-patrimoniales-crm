import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/shared/infrastructure/supabase'

import type { AuthenticatedUser } from '../application/auth-types'

export const isAuthProviderConfigured = isSupabaseConfigured

function toAuthenticatedUser(user: { id: string; email?: string | null }): AuthenticatedUser {
  return { id: user.id, email: user.email ?? null }
}

export async function getCurrentAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const client = getSupabaseBrowserClient()
  if (!client) return null
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session ? toAuthenticatedUser(data.session.user) : null
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
