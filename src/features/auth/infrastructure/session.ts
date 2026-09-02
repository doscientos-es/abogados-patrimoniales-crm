import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/shared/infrastructure/supabase'

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'unconfigured'; user: null }
  | { status: 'signed-out'; user: null }
  | { status: 'signed-in'; user: User }

export function useSupabaseSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    isSupabaseConfigured
      ? { status: 'loading', user: null }
      : { status: 'unconfigured', user: null },
  )

  useEffect(() => {
    const client = getSupabaseBrowserClient()
    if (!client) return
    let active = true
    void client.auth.getSession().then(({ data }) => {
      if (active)
        setState(
          data.session
            ? { status: 'signed-in', user: data.session.user }
            : { status: 'signed-out', user: null },
        )
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active)
        setState(
          session
            ? { status: 'signed-in', user: session.user }
            : { status: 'signed-out', user: null },
        )
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}

export async function signInWithPassword(email: string, password: string) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase no está configurado en este entorno.')
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const client = getSupabaseBrowserClient()
  if (!client) return
  const { error } = await client.auth.signOut()
  if (error) throw error
}
