import { describe, expect, it } from 'vitest'

import { isOlderThan, isOverdue } from './time-status'

describe('time status', () => {
  const now = Date.parse('2026-09-07T12:00:00Z')

  it('identifies overdue dates at render time', () => {
    expect(isOverdue('2026-09-07T11:59:59Z', now)).toBe(true)
    expect(isOverdue('2026-09-07T12:00:00Z', now)).toBe(false)
    expect(isOverdue(null, now)).toBe(false)
  })

  it('identifies records older than the requested age', () => {
    expect(isOlderThan('2026-08-24T12:00:00Z', 14 * 86_400_000, now)).toBe(true)
    expect(isOlderThan('2026-08-24T12:00:01Z', 14 * 86_400_000, now)).toBe(false)
  })
})
