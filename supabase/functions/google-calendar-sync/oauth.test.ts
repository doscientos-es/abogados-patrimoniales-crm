import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calendarAccessToken } from './oauth.ts'

const shared = {
  GOOGLE_CLIENT_ID: 'shared-client',
  GOOGLE_CLIENT_SECRET: 'shared-secret',
  GOOGLE_REFRESH_TOKEN: 'drive-refresh',
  GOOGLE_CALENDAR_REFRESH_TOKEN: 'calendar-refresh',
}

async function authorize(values: Record<string, string>) {
  let body: URLSearchParams | undefined
  const fetcher: typeof fetch = async (_url, init) => {
    assert.ok(init?.body instanceof URLSearchParams)
    body = init.body
    return Response.json({ access_token: 'calendar-access' })
  }
  const token = await calendarAccessToken((name) => values[name] ?? '', fetcher)
  return { token, body }
}

test('reuses the Drive OAuth client with the separate Calendar refresh token', async () => {
  const { token, body } = await authorize(shared)
  assert.equal(token, 'calendar-access')
  assert.equal(body?.get('client_id'), 'shared-client')
  assert.equal(body?.get('client_secret'), 'shared-secret')
  assert.equal(body?.get('refresh_token'), 'calendar-refresh')
})

test('uses the dedicated client when both Calendar credentials are set', async () => {
  const { body } = await authorize({
    ...shared,
    GOOGLE_CALENDAR_CLIENT_ID: 'calendar-client',
    GOOGLE_CALENDAR_CLIENT_SECRET: 'calendar-secret',
  })
  assert.equal(body?.get('client_id'), 'calendar-client')
  assert.equal(body?.get('client_secret'), 'calendar-secret')
})

test('rejects incomplete Calendar credentials or a missing Calendar refresh token', async () => {
  await assert.rejects(authorize({ ...shared, GOOGLE_CALENDAR_CLIENT_ID: 'calendar-client' }))
  await assert.rejects(authorize({ ...shared, GOOGLE_CALENDAR_REFRESH_TOKEN: '' }))
})
