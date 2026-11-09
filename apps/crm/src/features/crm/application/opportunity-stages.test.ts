import { describe, expect, it } from 'vitest'

import { canMoveLeadInPipeline, OPPORTUNITY_STAGE_LABELS } from './opportunity-stages'

describe('canMoveLeadInPipeline', () => {
  it('provides a Spanish label for the initial stage', () => {
    expect(OPPORTUNITY_STAGE_LABELS.entry).toBe('Entrada')
  })

  it('allows a Lead to return to the preceding active stage', () => {
    expect(canMoveLeadInPipeline('quote', 'first_meeting')).toBe(true)
    expect(canMoveLeadInPipeline('engagement', 'validation')).toBe(true)
  })

  it('only allows transitions accepted by the workflow and keeps closing explicit', () => {
    expect(canMoveLeadInPipeline('quote', 'qualification')).toBe(false)
    expect(canMoveLeadInPipeline('quote', 'lost')).toBe(false)
  })
})
