import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}
const roles = new Set(['admin', 'lawyer', 'paralegal'])

function json(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!authorization || !token) return json({ error: 'Unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500)

  try {
    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const firmId = typeof body.firmId === 'string' ? body.firmId : ''
    const role = typeof body.role === 'string' ? body.role : ''
    if (
      name.length < 2 ||
      name.length > 160 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      email.length > 254 ||
      !firmId ||
      !roles.has(role)
    ) {
      return json({ error: 'Invalid invitation data' }, 400)
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userData, error: userError } = await caller.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(url, serviceRoleKey)
    const { data: membership } = await admin
      .from('crm_firm_members')
      .select('role')
      .eq('firm_id', firmId)
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!membership || !['owner', 'admin'].includes(membership.role))
      return json({ error: 'Forbidden' }, 403)
    if (role === 'admin' && membership.role !== 'owner') return json({ error: 'Forbidden' }, 403)

    const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: name },
    })
    if (createError || !created.user) return json({ error: 'Could not create member' }, 400)

    const { error: memberError } = await admin.from('crm_firm_members').insert({
      firm_id: firmId,
      user_id: created.user.id,
      role,
      status: 'invited',
    })
    if (memberError) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: 'Could not create invitation' }, 400)
    }
    return json({ success: 'Invitation sent' })
  } catch {
    return json({ error: 'Could not create invitation' }, 500)
  }
})
