import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !token) return response({ error: 'Unauthorized' }, 401)
  if (!url || !anonKey || !serviceRoleKey)
    return response({ error: 'Server configuration error' }, 500)

  try {
    const body = (await req.json()) as { firmId?: unknown; userId?: unknown }
    const firmId = typeof body.firmId === 'string' ? body.firmId : ''
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!uuidPattern.test(firmId) || !uuidPattern.test(userId))
      return response({ error: 'Invalid member data' }, 400)

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userData, error: userError } = await caller.auth.getUser(token)
    if (userError || !userData.user) return response({ error: 'Unauthorized' }, 401)

    const { data: releasedAssignments, error: authorizationError } = await caller.rpc(
      'crm_get_firm_member_assignment_count',
      { target_firm_id: firmId, target_user_id: userId },
    )
    if (authorizationError) return response({ error: 'Forbidden' }, 403)

    const admin = createClient(url, serviceRoleKey)
    const { data: memberships, error: membershipsError } = await admin
      .from('crm_firm_members')
      .select('firm_id, status')
      .eq('user_id', userId)
    if (membershipsError) return response({ error: 'Could not verify member' }, 500)
    if (
      memberships.length !== 1 ||
      memberships[0].firm_id !== firmId ||
      memberships[0].status !== 'disabled'
    ) {
      return response({ error: 'Member cannot be permanently deleted' }, 409)
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) return response({ error: 'Could not permanently delete member' }, 409)
    return response({ releasedAssignments })
  } catch {
    return response({ error: 'Could not permanently delete member' }, 500)
  }
})
