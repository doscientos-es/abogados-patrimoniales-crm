import assert from 'node:assert/strict'
import { test } from 'node:test'

import { synchronizeCalendarJob, type CalendarJob } from './calendar.ts'

const config = {
  calendarId: 'firm-calendar@group.calendar.google.com',
  accessToken: 'mock',
  staffDomain: 'despacho.example',
}
const job: CalendarJob = {
  id: '10000000-0000-4000-8000-000000000001',
  active: true,
  starts_at: '2026-12-01T10:00:00+01:00',
  ends_at: '2026-12-01T11:00:00+01:00',
  revision: 1,
  lease_id: 'test-lease',
  emails: ['HELENA@despacho.example', 'helena@despacho.example', 'external@example.com'],
}
const id = job.id.replaceAll('-', '')
const event = {
  id,
  etag: '"event-version"',
  summary: 'Cita del despacho',
  visibility: 'private',
  guestsCanInviteOthers: false,
  guestsCanModify: false,
  guestsCanSeeOtherGuests: false,
  start: { dateTime: '2026-12-01T09:00:00.000Z', timeZone: 'Europe/Madrid' },
  end: { dateTime: '2026-12-01T10:00:00.000Z', timeZone: 'Europe/Madrid' },
  attendees: [{ email: 'helena@despacho.example', responseStatus: 'accepted' }],
  extendedProperties: { private: { lex_booking: id } },
}

function mockGoogle(...responses: Response[]) {
  const calls: { url: URL; method?: string; body: unknown; headers: Headers }[] = []
  const fetcher: typeof fetch = async (url, options) => {
    calls.push({
      url: new URL(String(url)),
      method: options?.method,
      body: typeof options?.body === 'string' ? JSON.parse(options.body) : undefined,
      headers: new Headers(options?.headers),
    })
    const response = responses.shift()
    assert.ok(response, 'Unexpected Google Calendar request')
    return response
  }
  return { calls, fetcher }
}

test('creates a private event with only staff emails, without copying CRM details', async () => {
  const { calls, fetcher } = mockGoogle(new Response(null, { status: 404 }), Response.json(event))
  const source = { ...job, clientName: 'Private client', notes: 'Private notes' }
  await synchronizeCalendarJob(source, config, fetcher)

  assert.deepEqual(
    calls.map(({ method }) => method),
    ['GET', 'POST'],
  )
  const [, insert] = calls
  assert.equal(insert?.url.searchParams.get('sendUpdates'), 'all')
  const { etag: _etag, ...projection } = event
  assert.deepEqual(insert?.body, {
    ...projection,
    attendees: [{ email: 'helena@despacho.example' }],
  })
})

test('a retry with an already synchronized event sends no new invitation', async () => {
  const { calls, fetcher } = mockGoogle(Response.json(event))
  await synchronizeCalendarJob(job, config, fetcher)
  assert.deepEqual(
    calls.map(({ method }) => method),
    ['GET'],
  )
})

test('rescheduling replaces the guest list and preserves responses of guests who remain', async () => {
  const { calls, fetcher } = mockGoogle(
    Response.json({
      ...event,
      attendees: [...event.attendees, { email: 'previous@despacho.example' }],
    }),
    Response.json(event),
  )
  await synchronizeCalendarJob(
    {
      ...job,
      emails: [...job.emails, 'new@despacho.example'],
      ends_at: '2026-12-01T12:00:00+01:00',
    },
    config,
    fetcher,
  )

  const [, patch] = calls
  assert.equal(patch?.method, 'PATCH')
  assert.equal(patch?.url.searchParams.get('sendUpdates'), 'all')
  assert.equal(patch?.headers.get('if-match'), event.etag)
  assert.deepEqual(patch?.body, {
    summary: event.summary,
    visibility: event.visibility,
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    guestsCanSeeOtherGuests: false,
    start: event.start,
    end: { dateTime: '2026-12-01T11:00:00.000Z', timeZone: 'Europe/Madrid' },
    attendees: [...event.attendees, { email: 'new@despacho.example' }],
    extendedProperties: event.extendedProperties,
  })
})

test('cancels with notifications and treats an already removed event as done', async () => {
  const cancellation = { ...job, active: false }
  const { calls, fetcher } = mockGoogle(
    Response.json(event),
    new Response(null, { status: 204 }),
    new Response(null, { status: 410 }),
  )
  await synchronizeCalendarJob(cancellation, config, fetcher)
  await synchronizeCalendarJob(cancellation, config, fetcher)

  assert.deepEqual(
    calls.map(({ method }) => method),
    ['GET', 'DELETE', 'GET'],
  )
  assert.equal(calls[1]?.url.searchParams.get('sendUpdates'), 'all')
  assert.equal(calls[1]?.headers.get('if-match'), event.etag)
})

test('refuses to modify events not owned by the integration or to use a primary calendar', async () => {
  const { calls, fetcher } = mockGoogle(Response.json({ ...event, extendedProperties: {} }))
  await assert.rejects(
    synchronizeCalendarJob({ ...job, active: false }, config, fetcher),
    /ownership/,
  )
  await assert.rejects(
    synchronizeCalendarJob(job, { ...config, calendarId: 'primary' }, fetcher),
    /dedicated/,
  )
  assert.deepEqual(
    calls.map(({ method }) => method),
    ['GET'],
  )
})
