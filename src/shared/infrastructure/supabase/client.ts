import { createClient } from '@supabase/supabase-js'

function requirePublicEnvironment(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY') {
  const value = import.meta.env[name]
  if (!value) throw new Error(`${name} must be configured before using Supabase.`)
  return value
}

export function createSupabaseBrowserClient() {
  return createClient(
    requirePublicEnvironment('VITE_SUPABASE_URL'),
    requirePublicEnvironment('VITE_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  )
}