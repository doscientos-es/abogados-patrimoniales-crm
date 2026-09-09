import { describe, expect, it } from 'vitest'

import { canMoveLeadInPipeline } from './opportunity-stages'

describe('canMoveLeadInPipeline', () => {
  it('allows a Lead to return to the preceding active stage', () => {
    expect(canMoveLeadInPipeline('quote', 'first_meeting')).toBe(true)
    expect(canMoveLeadInPipeline('engagement', 'validation')).toBe(true)
  })

  it('only allows transitions accepted by the workflow and keeps closing explicit', () => {
    expect(canMoveLeadInPipeline('quote', 'qualification')).toBe(false)
    expect(canMoveLeadInPipeline('quote', 'lost')).toBe(false)
  })
})
