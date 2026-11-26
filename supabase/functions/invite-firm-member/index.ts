import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

import { handleInvitation } from './handler.ts'
const invitationRedirectTo = 'https://www.lex.eus/'

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey)
    return new Response(JSON.stringify({ error: 'server_configuration' }), { status: 500 })
  const admin = createClient(url, serviceRoleKey)
  return handleInvitation(req, {
    identify: async (authorization, token) => {
      const caller = createClient(url, anonKey, {
        global: { headers: { Authorization: authorization } },
      })
      const { data, error } = await caller.auth.getUser(token)
      return error ? null : (data.user?.id ?? null)
    },
    role: async (firmId, actorId) => {
      const { data, error } = await admin
        .from('crm_firm_members')
        .select('role')
        .eq('firm_id', firmId)
        .eq('user_id', actorId)
        .eq('status', 'active')
        .maybeSingle()
      return error ? null : (data?.role ?? null)
    },
    invite: async ({ email, name }) => {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { display_name: name },
        redirectTo: invitationRedirectTo,
      })
      return error ? null : (data.user?.id ?? null)
    },
    addMember: async ({ firmId, role }, userId) => {
      const { error } = await admin.from('crm_firm_members').insert({
        firm_id: firmId,
        user_id: userId,
        role,
        status: 'invited',
      })
      return !error
    },
  })
})
