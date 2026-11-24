import { createClient } from 'npm:@supabase/supabase-js@2'

import { isDedicatedCalendar } from '../google-calendar-sync/calendar.ts'
import { verifyCalendarAccess } from '../google-calendar-sync/connection.ts'
import { calendarAccessToken } from '../google-calendar-sync/oauth.ts'

const cors = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}
const env = (name: string) => Deno.env.get(name)?.trim() ?? ''
const response = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: cors })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  const authorization = req.headers.get('authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  const url = env('SUPABASE_URL')
  const anonKey = env('SUPABASE_ANON_KEY')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !token) return response({ error: 'Unauthorized' }, 401)
  if (!url || !anonKey || !serviceKey) return response({ error: 'Configuration unavailable' }, 503)

  try {
    const body = (await req.json()) as { firmId?: unknown; action?: unknown }
    const firmId = typeof body.firmId === 'string' ? body.firmId : ''
    if (!firmId || !['verify', 'activate'].includes(String(body.action)))
      return response({ error: 'Invalid request' }, 400)
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: user, error: authError } = await caller.auth.getUser(token)
    if (authError || !user.user) return response({ error: 'Unauthorized' }, 401)
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data: member, error: memberError } = await admin
      .from('crm_firm_members')
      .select('role')
      .eq('firm_id', firmId)
      .eq('user_id', user.user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (memberError || !member || !['owner', 'admin'].includes(member.role))
      return response({ error: 'Forbidden' }, 403)

    const calendarId = env('GOOGLE_CALENDAR_ID')
    const staffDomain = env('GOOGLE_CALENDAR_STAFF_DOMAIN').toLowerCase()
    const workerSecret = env('CRM_GOOGLE_CALENDAR_WORKER_SECRET')
    if (
      firmId !== env('GOOGLE_CALENDAR_FIRM_ID') ||
      !isDedicatedCalendar(calendarId) ||
      !/^[a-z\d-]+(?:\.[a-z\d-]+)+$/.test(staffDomain) ||
      workerSecret.length < 32 ||
      workerSecret.length > 256
    )
      return response({ code: 'configuration' })

    let accessToken: string
    try {
      accessToken = await calendarAccessToken(env)
    } catch {
      return response({ code: 'authorization' })
    }
    try {
      await verifyCalendarAccess(calendarId, accessToken)
    } catch {
      return response({ code: 'calendar' })
    }

    if (body.action === 'activate') {
      const { error } = await admin.rpc('crm_enable_google_calendar_sync', {
        worker_url: `${url}/functions/v1/google-calendar-sync`,
        worker_secret: workerSecret,
      })
      if (error) return response({ code: 'schedule' })
    }
    const { data, error } = await admin.rpc('crm_google_calendar_sync_status', {
      target_firm: firmId,
    })
    if (error || !Array.isArray(data) || !data[0]) return response({ code: 'schedule' })
    return response({ code: 'ok', ...data[0] })
  } catch {
    return response({ error: 'Connection could not be verified' }, 503)
  }
})
