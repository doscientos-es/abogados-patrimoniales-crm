const calendarApi = 'https://www.googleapis.com/calendar/v3'

export type CalendarJob = {
  id: string
  active: boolean
  starts_at: string
  ends_at: string
  revision: number
  lease_id: string
  emails: string[]
}

type Attendee = { email: string; responseStatus?: string; organizer?: boolean }
type RemoteEvent = {
  id?: string
  etag?: string
  status?: string
  summary?: string
  visibility?: string
  guestsCanInviteOthers?: boolean
  guestsCanModify?: boolean
  guestsCanSeeOtherGuests?: boolean
  start?: { dateTime?: string }
  end?: { dateTime?: string }
  attendees?: Attendee[]
  extendedProperties?: { private?: { lex_booking?: string } }
}

type CalendarConfig = { calendarId: string; accessToken: string; staffDomain: string }

function eventId(bookingId: string) {
  const id = bookingId.toLowerCase().replaceAll('-', '')
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('Invalid booking ID')
  return id
}

export function isDedicatedCalendar(calendarId: string) {
  return /^[^@/\s]+@group\.calendar\.google\.com$/i.test(calendarId)
}

function corporateEmails(emails: string[], staffDomain: string) {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()))]
    .filter((email) => {
      const parts = email.split('@')
      return parts.length === 2 && /^[^\s]+$/.test(parts[0] ?? '') && parts[1] === staffDomain
    })
    .sort()
}

function eventFields(job: CalendarJob, staffDomain: string, previous: Attendee[] = []) {
  const start = new Date(job.starts_at)
  const end = new Date(job.ends_at)
  if (!(start.getTime() < end.getTime())) throw new Error('Invalid appointment dates')
  const responses = new Map(
    previous.map((attendee) => [attendee.email.toLowerCase(), attendee.responseStatus]),
  )
  const attendees = corporateEmails(job.emails, staffDomain).map((email) => {
    const responseStatus = responses.get(email)
    return responseStatus ? { email, responseStatus } : { email }
  })
  return {
    summary: 'Cita del despacho',
    visibility: 'private',
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    guestsCanSeeOtherGuests: false,
    start: { dateTime: start.toISOString(), timeZone: 'Europe/Madrid' },
    end: { dateTime: end.toISOString(), timeZone: 'Europe/Madrid' },
    attendees,
    extendedProperties: { private: { lex_booking: eventId(job.id) } },
  }
}

function alreadyInSync(remote: RemoteEvent, expected: ReturnType<typeof eventFields>) {
  const wanted = expected.attendees.map(({ email }) => email)
  const actual = (remote.attendees ?? [])
    .filter((attendee) => !attendee.organizer || wanted.includes(attendee.email.toLowerCase()))
    .map((attendee) => attendee.email.toLowerCase())
    .sort()
  return (
    remote.summary === expected.summary &&
    remote.visibility === expected.visibility &&
    remote.guestsCanInviteOthers === false &&
    !remote.guestsCanModify &&
    remote.guestsCanSeeOtherGuests === false &&
    Date.parse(remote.start?.dateTime ?? '') === Date.parse(expected.start.dateTime) &&
    Date.parse(remote.end?.dateTime ?? '') === Date.parse(expected.end.dateTime) &&
    JSON.stringify(wanted) === JSON.stringify(actual)
  )
}

export async function synchronizeCalendarJob(
  job: CalendarJob,
  config: CalendarConfig,
  fetcher = fetch,
) {
  if (!isDedicatedCalendar(config.calendarId))
    throw new Error('A dedicated Google calendar is required')
  const id = eventId(job.id)
  const collection = `${calendarApi}/calendars/${encodeURIComponent(config.calendarId)}/events`
  const path = `${collection}/${id}`
  const request = (url: string, method: string, body?: object, etag?: string) =>
    fetcher(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(etag ? { 'If-Match': etag } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(6_000),
    })

  const current = await request(path, 'GET')
  if (current.status === 404 || current.status === 410) {
    if (!job.active) return
    const inserted = await request(`${collection}?sendUpdates=all`, 'POST', {
      ...eventFields(job, config.staffDomain),
      id,
    })
    if (!inserted.ok) throw new Error('Google Calendar could not create the appointment')
    return
  }
  if (!current.ok) throw new Error('Google Calendar could not read the appointment')
  const remote = (await current.json()) as RemoteEvent
  if (remote.status === 'cancelled' && !job.active) return
  if (
    remote.id !== id ||
    !remote.etag ||
    remote.extendedProperties?.private?.lex_booking !== id ||
    remote.status === 'cancelled'
  )
    throw new Error('Appointment ownership cannot be verified')

  if (!job.active) {
    const deleted = await request(`${path}?sendUpdates=all`, 'DELETE', undefined, remote.etag)
    if (!deleted.ok && deleted.status !== 404 && deleted.status !== 410)
      throw new Error('Google Calendar could not cancel the appointment')
    return
  }

  const desired = eventFields(job, config.staffDomain, remote.attendees)
  if (alreadyInSync(remote, desired)) return
  const updated = await request(`${path}?sendUpdates=all`, 'PATCH', desired, remote.etag)
  if (!updated.ok) throw new Error('Google Calendar could not update the appointment')
}
