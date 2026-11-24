import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { CalendarJob } from './calendar.ts'
import { calendarJobDetails } from './details.ts'

const job: CalendarJob = {
  id: 'job',
  active: true,
  starts_at: '',
  ends_at: '',
  revision: 3,
  lease_id: 'lease',
  emails: [],
  staff_count: 0,
}

test('fetches details only for the claimed lease and revision', async () => {
  const details = {
    task_id: 'task',
    title: 'Cita',
    opportunity_id: null,
    case_id: null,
    assigned_name: null,
    staff_names: [],
  }
  const result = await calendarJobDetails(job, async (query) => {
    assert.deepEqual(query, { job_id: 'job', expected_lease: 'lease', expected_revision: 3 })
    return details
  })
  assert.equal(result, details)
  await assert.rejects(
    calendarJobDetails(job, async () => null),
    /details unavailable/,
  )
})

test('cancelling an event does not require details for a deleted task', async () => {
  const result = await calendarJobDetails({ ...job, active: false }, async () => {
    throw new Error('Lookup must not run')
  })
  assert.equal(result, undefined)
})
