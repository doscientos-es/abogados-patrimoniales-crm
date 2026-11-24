import { isDedicatedCalendar } from './calendar.ts'

export async function verifyCalendarAccess(
  calendarId: string,
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  if (!isDedicatedCalendar(calendarId)) throw new Error('A dedicated calendar is required')
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=1&fields=accessRole`
  const result = await fetcher(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(6_000),
  })
  if (!result.ok) throw new Error('Calendar cannot be accessed')
  const data = (await result.json()) as { accessRole?: unknown }
  if (data.accessRole !== 'owner') throw new Error('Calendar ownership is required')
}