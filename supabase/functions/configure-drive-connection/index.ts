import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function googleToken() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error('Google Drive credentials are not configured')

  const result = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const json = (await result.json()) as { access_token?: string; error_description?: string }
  if (!result.ok || !json.access_token)
    throw new Error(json.error_description ?? 'Google token refresh failed')
  return json.access_token
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
  if (!url || !anonKey || !serviceRoleKey) return response({ error: 'Server configuration error' }, 500)

  try {
    const body = (await req.json()) as { firmId?: unknown; rootFolderId?: unknown }
    const firmId = typeof body.firmId === 'string' ? body.firmId : ''
    const rootFolderId = typeof body.rootFolderId === 'string' ? body.rootFolderId.trim() : ''
    if (!firmId || !/^[A-Za-z0-9_-]+$/.test(rootFolderId))
      return response({ error: 'Invalid Drive connection data' }, 400)

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: userData, error: userError } = await caller.auth.getUser(token)
    if (userError || !userData.user) return response({ error: 'Unauthorized' }, 401)

    const admin = createClient(url, serviceRoleKey)
    const { data: membership } = await admin
      .from('crm_firm_members')
      .select('role')
      .eq('firm_id', firmId)
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!membership || !['owner', 'admin'].includes(membership.role))
      return response({ error: 'Forbidden' }, 403)

    const accessToken = await googleToken()
    const folder = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rootFolderId)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const root = (await folder.json()) as {
      id?: string
      name?: string
      mimeType?: string
      trashed?: boolean
      error?: { message?: string }
    }
    if (!folder.ok) return response({ error: root.error?.message ?? 'Drive folder could not be read' }, 400)
    if (root.mimeType !== 'application/vnd.google-apps.folder' || root.trashed || !root.id || !root.name)
      return response({ error: 'The selected Drive item must be an active folder' }, 400)

    const now = new Date().toISOString()
    const { error: saveError } = await admin.from('crm_drive_connections').upsert(
      {
        firm_id: firmId,
        root_folder_id: root.id,
        root_folder_name: root.name,
        status: 'connected',
        last_error: null,
        connected_at: now,
        connected_by: userData.user.id,
        updated_at: now,
      },
      { onConflict: 'firm_id' },
    )
    if (saveError) return response({ error: 'Drive connection could not be saved' }, 500)
    return response({ rootFolderId: root.id, rootFolderName: root.name })
  } catch {
    return response({ error: 'Drive connection could not be verified' }, 502)
  }
})