import assert from 'node:assert/strict'
import { test } from 'node:test'

import { verifyCalendarAccess } from './connection.ts'

test('verifies access and ownership without creating an event', async () => {
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(init?.method, undefined)
    assert.equal(new URL(String(url)).searchParams.get('fields'), 'accessRole')
    return Response.json({ accessRole: 'owner' })
  }
  await verifyCalendarAccess('firm@group.calendar.google.com', 'access', fetcher)
})

test('rejects missing access, non-owned calendars and primary calendars', async () => {
  await assert.rejects(
    verifyCalendarAccess('firm@group.calendar.google.com', 'access', async () =>
      Response.json({ accessRole: 'reader' }),
    ),
  )
  await assert.rejects(
    verifyCalendarAccess(
      'firm@group.calendar.google.com',
      'access',
      async () => new Response(null, { status: 403 }),
    ),
  )
  await assert.rejects(verifyCalendarAccess('primary', 'access'))
})
