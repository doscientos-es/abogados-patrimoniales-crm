type Environment = (name: string) => string

export async function calendarAccessToken(env: Environment, fetcher: typeof fetch = fetch) {
  const calendarId = env('GOOGLE_CALENDAR_CLIENT_ID')
  const calendarSecret = env('GOOGLE_CALENDAR_CLIENT_SECRET')
  const useCalendarClient = Boolean(calendarId || calendarSecret)
  const clientId = useCalendarClient ? calendarId : env('GOOGLE_CLIENT_ID')
  const clientSecret = useCalendarClient ? calendarSecret : env('GOOGLE_CLIENT_SECRET')
  const refreshToken = env('GOOGLE_CALENDAR_REFRESH_TOKEN')
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error('Google Calendar is not configured')

  const result = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(6_000),
  })
  if (!result.ok) throw new Error('Google Calendar authorization unavailable')
  const data = (await result.json()) as { access_token?: unknown }
  if (typeof data.access_token !== 'string' || !data.access_token)
    throw new Error('Google Calendar returned an invalid authorization')
  return data.access_token
}
