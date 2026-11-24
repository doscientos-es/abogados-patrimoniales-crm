import { timingSafeEqual } from 'node:crypto'

import { createClient } from 'npm:@supabase/supabase-js@2'

import { isDedicatedCalendar, synchronizeCalendarJob, type CalendarJob } from './calendar.ts'
import { calendarAccessToken } from './oauth.ts'

const env = (name: string) => Deno.env.get(name)?.trim() ?? ''

function authorized(provided: string | null, expected: string) {
  if (!provided || provided.length !== expected.length || provided.length > 256) return false
  const encoder = new TextEncoder()
  const left = encoder.encode(provided)
  const right = encoder.encode(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const cronSecret = env('CRM_GOOGLE_CALENDAR_WORKER_SECRET')
  if (
    cronSecret.length < 32 ||
    !authorized(request.headers.get('x-crm-calendar-secret'), cronSecret)
  )
    return new Response(null, { status: 401 })

  const url = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  const firmId = env('GOOGLE_CALENDAR_FIRM_ID')
  const calendarId = env('GOOGLE_CALENDAR_ID')
  const staffDomain = env('GOOGLE_CALENDAR_STAFF_DOMAIN').toLowerCase()
  if (
    !url ||
    !serviceKey ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(firmId) ||
    !isDedicatedCalendar(calendarId) ||
    !/^[a-z\d-]+(?:\.[a-z\d-]+)+$/.test(staffDomain)
  )
    return new Response(null, { status: 503 })

  try {
    const client = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data, error } = await client.rpc('crm_claim_google_calendar_jobs', {
      target_firm: firmId,
      staff_domain: staffDomain,
    })
    if (error || !Array.isArray(data)) return new Response(null, { status: 503 })
    const jobs = data as CalendarJob[]
    if (!jobs.length) return new Response(null, { status: 204 })

    const token = await calendarAccessToken(env).catch(() => null)
    let failures = 0
    for (const job of jobs) {
      let errorCode = token ? null : 'google_auth'
      if (token) {
        try {
          await synchronizeCalendarJob(job, { calendarId, accessToken: token, staffDomain })
          if (job.active && job.emails.length !== job.staff_count) errorCode = 'staff_email'
        } catch {
          errorCode = 'calendar_request'
        }
      }
      const { error: finishError } = await client.rpc('crm_finish_google_calendar_job', {
        job_id: job.id,
        expected_lease: job.lease_id,
        processed_revision: job.revision,
        error_code: errorCode,
      })
      if (errorCode || finishError) failures += 1
    }

    return Response.json({ processed: jobs.length, failures }, { status: failures ? 503 : 200 })
  } catch {
    return new Response(null, { status: 503 })
  }
})
