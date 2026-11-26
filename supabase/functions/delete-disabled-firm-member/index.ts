import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

import { handleMemberRemoval } from './handler.ts'

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey)
    return new Response(JSON.stringify({ error: 'server_configuration' }), { status: 500 })
  const admin = createClient(url, serviceRoleKey)
  const caller = (authorization: string) =>
    createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  return handleMemberRemoval(req, {
    identify: async (authorization, token) => {
      const { data, error } = await caller(authorization).auth.getUser(token)
      return error ? null : (data.user?.id ?? null)
    },
    count: async (authorization, firmId, userId) => {
      const { data, error } = await caller(authorization).rpc(
        'crm_get_firm_member_assignment_count',
        {
          target_firm_id: firmId,
          target_user_id: userId,
        },
      )
      return error || typeof data !== 'number' ? null : data
    },
    reserve: async (firmId, userId, actorId) => {
      const { error } = await admin.rpc('crm_reserve_firm_member_removal', {
        target_firm_id: firmId,
        target_user_id: userId,
        actor_id: actorId,
      })
      return !error
    },
    deleteAccount: async (userId) => {
      // Auth revokes sessions and anonymizes credentials while preserving audit references.
      const { error } = await admin.auth.admin.deleteUser(userId, true)
      return !error
    },
    finish: async (firmId, userId, actorId) => {
      const { error } = await admin.rpc('crm_finish_firm_member_removal', {
        target_firm_id: firmId,
        target_user_id: userId,
        actor_id: actorId,
      })
      return !error
    },
  })
})
