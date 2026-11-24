import { createClient } from 'npm:@supabase/supabase-js@2'

import {
  isDedicatedCalendar,
  synchronizeCalendarJob,
  type CalendarJob,
  type CalendarJobDetails,
} from './calendar.ts'
import { calendarJobDetails } from './details.ts'
import { calendarAccessToken } from './oauth.ts'
import { consumeInvocationToken } from './worker-auth.ts'

const env = (name: string) => Deno.env.get(name)?.trim() ?? ''

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
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
    const authorized = await consumeInvocationToken(
      request.headers.get('x-crm-calendar-token'),
      async (invocationToken) => {
        const { data, error } = await client.rpc('crm_consume_google_calendar_invocation', {
          invocation_token: invocationToken,
        })
        if (error) throw error
        return data === true
      },
    )
    if (!authorized) return new Response(null, { status: 401 })
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
          const details = await calendarJobDetails(job, async (query) => {
            const { data: rows, error: detailsError } = await client.rpc(
              'crm_google_calendar_job_details',
              query,
            )
            if (detailsError || !Array.isArray(rows) || !rows[0]) return null
            return rows[0] as CalendarJobDetails
          })
          await synchronizeCalendarJob(
            { ...job, details },
            {
              calendarId,
              accessToken: token,
              staffDomain,
              crmBaseUrl: env('CRM_PUBLIC_URL') || undefined,
            },
          )
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
