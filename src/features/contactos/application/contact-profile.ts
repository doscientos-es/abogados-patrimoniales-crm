import type { Json } from '@/shared/infrastructure/supabase'

export const SATISFACTION_LEVELS = [
  'Sin valorar',
  'Muy bajo',
  'Bajo',
  'Medio',
  'Alto',
  'Muy alto',
] as const
export type SatisfactionLevel = (typeof SATISFACTION_LEVELS)[number]

export const ATTENTION_CATEGORIES = ['Preferente', 'Estándar', 'Intencional'] as const
export type AttentionCategory = (typeof ATTENTION_CATEGORIES)[number]

export const INCIDENT_TYPES = [
  'Retraso en la tramitación',
  'Falta de información',
  'Honorarios',
  'Trato recibido',
  'Error documental',
  'Otro',
] as const
export type IncidentStatus = 'Abierta' | 'En revisión' | 'Resuelta' | 'Cerrada'

export type SatisfactionRecord = {
  id: string
  createdAt: string
  level: SatisfactionLevel
  notes: string
  actorId: string | null
}

export type ContactIncident = {
  id: string
  createdAt: string
  type: string
  description: string
  status: IncidentStatus
  resolution: string
  observations: string
}

export type ContactProfile = {
  language: string
  preferredHours: string
  treatment: string
  instructions: string
  treatmentNotes: string
  attention: AttentionCategory
  satisfaction: SatisfactionLevel
  satisfactionHistory: SatisfactionRecord[]
  incidents: ContactIncident[]
}

export const EMPTY_CONTACT_PROFILE: ContactProfile = {
  language: '',
  preferredHours: '',
  treatment: '',
  instructions: '',
  treatmentNotes: '',
  attention: 'Estándar',
  satisfaction: 'Sin valorar',
  satisfactionHistory: [],
  incidents: [],
}

function object(value: Json | undefined): Record<string, Json | undefined> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function string(value: Json | undefined, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function isSatisfaction(value: string): value is SatisfactionLevel {
  return SATISFACTION_LEVELS.some((level) => level === value)
}

function isIncidentStatus(value: string): value is IncidentStatus {
  return ['Abierta', 'En revisión', 'Resuelta', 'Cerrada'].includes(value)
}

export function contactProfileFromJson(value: Json | undefined): ContactProfile {
  const data = object(value)
  const satisfaction = string(data['satisfaction'])
  const attention = string(data['attention'])
  const history = Array.isArray(data['satisfactionHistory'])
    ? data['satisfactionHistory'].flatMap((entry, index) => {
        const record = object(entry)
        const level = string(record['level'])
        if (!isSatisfaction(level)) return []
        return [
          {
            id: string(record['id'], `rating-${index}`),
            createdAt: string(record['createdAt']),
            level,
            notes: string(record['notes']),
            actorId: typeof record['actorId'] === 'string' ? record['actorId'] : null,
          },
        ]
      })
    : []
  const incidents = Array.isArray(data['incidents'])
    ? data['incidents'].flatMap((entry, index) => {
        const incident = object(entry)
        const status = string(incident['status'])
        if (!isIncidentStatus(status)) return []
        return [
          {
            id: string(incident['id'], `incident-${index}`),
            createdAt: string(incident['createdAt']),
            type: string(incident['type'], 'Otro'),
            description: string(incident['description']),
            status,
            resolution: string(incident['resolution']),
            observations: string(incident['observations']),
          },
        ]
      })
    : []
  return {
    language: string(data['language']),
    preferredHours: string(data['preferredHours']),
    treatment: string(data['treatment']),
    instructions: string(data['instructions']),
    treatmentNotes: string(data['treatmentNotes']),
    attention: ATTENTION_CATEGORIES.some((item) => item === attention)
      ? (attention as AttentionCategory)
      : 'Estándar',
    satisfaction: isSatisfaction(satisfaction) ? satisfaction : 'Sin valorar',
    satisfactionHistory: history,
    incidents,
  }
}
