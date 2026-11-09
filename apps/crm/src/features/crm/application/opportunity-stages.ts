import type { OpportunityStage } from '@/shared/infrastructure/supabase'

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'entry',
  'qualification',
  'first_meeting',
  'quote',
  'validation',
  'engagement',
  'won',
  'lost',
]

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  entry: 'Entrada',
  qualification: 'Cualificación',
  first_meeting: 'Primera cita',
  quote: 'Solicitud de presupuesto',
  validation: 'Validación',
  engagement: 'Enviado al cliente',
  won: 'Aceptado',
  lost: 'Cerrado / Perdido',
}

export const OPPORTUNITY_TRANSITIONS: Record<OpportunityStage, OpportunityStage[]> = {
  entry: ['qualification', 'lost'],
  qualification: ['entry', 'first_meeting', 'lost'],
  first_meeting: ['qualification', 'quote', 'lost'],
  quote: ['first_meeting', 'validation', 'lost'],
  validation: ['quote', 'engagement', 'lost'],
  engagement: ['validation', 'won', 'lost'],
  won: [],
  lost: [],
}

const ACTIVE_STAGES: OpportunityStage[] = OPPORTUNITY_STAGES.filter((stage) => stage !== 'lost')

export function canMoveLeadInPipeline(current: OpportunityStage, target: OpportunityStage) {
  return target !== 'lost' && OPPORTUNITY_TRANSITIONS[current].includes(target)
}

export function nextOpportunityStage(stage: OpportunityStage) {
  const currentIndex = ACTIVE_STAGES.indexOf(stage)
  return currentIndex >= 0 ? ACTIVE_STAGES[currentIndex + 1] : undefined
}

export function opportunityTransitionNeedsReason(
  current: OpportunityStage,
  target: OpportunityStage,
) {
  return target === 'lost' || ACTIVE_STAGES.indexOf(target) < ACTIVE_STAGES.indexOf(current)
}
