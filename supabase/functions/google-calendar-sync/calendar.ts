const calendarApi = 'https://www.googleapis.com/calendar/v3'

export type CalendarJobDetails = {
  task_id: string
  title: string
  opportunity_id: string | null
  case_id: string | null
  assigned_name: string | null
  staff_names: string[]
}

export type CalendarJob = {
  id: string
  active: boolean
  starts_at: string
  ends_at: string
  revision: number
  lease_id: string
  emails: string[]
  staff_count: number
  details?: CalendarJobDetails
}

type Attendee = { email: string; responseStatus?: string; organizer?: boolean }
type RemoteEvent = {
  id?: string
  etag?: string
  status?: string
  summary?: string
  description?: string
  visibility?: string
  guestsCanInviteOthers?: boolean
  guestsCanModify?: boolean
  guestsCanSeeOtherGuests?: boolean
  start?: { dateTime?: string }
  end?: { dateTime?: string }
  attendees?: Attendee[]
  extendedProperties?: { private?: { lex_booking?: string } }
}

type CalendarConfig = {
  calendarId: string
  accessToken: string
  staffDomain: string
  crmBaseUrl?: string
}

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

function cleanText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  )
}

function eventDescription(details: CalendarJobDetails | undefined, crmBaseUrl: string) {
  if (!details) return ''
  const base = new URL(crmBaseUrl)
  if (base.protocol !== 'https:' || base.username || base.password)
    throw new Error('Invalid CRM URL')
  const lines: string[] = []
  const assigned = cleanText(details.assigned_name)
  if (assigned) lines.push(`Responsable: ${escapeHtml(assigned)}`)
  const staff = details.staff_names.map(cleanText).filter(Boolean)
  if (staff.length) lines.push(`Equipo: ${staff.map(escapeHtml).join(', ')}`)
  const addLink = (label: string, path: string, id: string | null, tab?: string) => {
    if (!id) return
    if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new Error('Invalid CRM ID')
    const url = new URL(`/${path}/${id}`, base.origin)
    if (tab) {
      url.searchParams.set('tab', tab)
      url.searchParams.set('appointmentId', details.task_id)
    }
    lines.push(`<a href="${escapeHtml(url.toString())}">${label}</a>`)
  }
  addLink('Abrir ficha del lead', 'oportunidades', details.opportunity_id, 'firstMeeting')
  addLink('Abrir ficha del expediente', 'expedientes', details.case_id, 'appointments')
  addLink('Abrir cita en el CRM', 'tareas', details.task_id)
  return lines.join('<br>')
}

function eventFields(job: CalendarJob, config: CalendarConfig, previous: Attendee[] = []) {
  const start = new Date(job.starts_at)
  const end = new Date(job.ends_at)
  if (!(start.getTime() < end.getTime())) throw new Error('Invalid appointment dates')
  const responses = new Map(
    previous.map((attendee) => [attendee.email.toLowerCase(), attendee.responseStatus]),
  )
  const attendees = corporateEmails(job.emails, config.staffDomain).map((email) => {
    const responseStatus = responses.get(email)
    return responseStatus ? { email, responseStatus } : { email }
  })
  return {
    summary: cleanText(job.details?.title) || 'Cita del despacho',
    description: eventDescription(job.details, config.crmBaseUrl ?? 'https://www.lex.eus'),
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
    (remote.description ?? '') === expected.description &&
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
      ...eventFields(job, config),
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

  const desired = eventFields(job, config, remote.attendees)
  if (alreadyInSync(remote, desired)) return
  const updated = await request(`${path}?sendUpdates=all`, 'PATCH', desired, remote.etag)
  if (!updated.ok) throw new Error('Google Calendar could not update the appointment')
}
