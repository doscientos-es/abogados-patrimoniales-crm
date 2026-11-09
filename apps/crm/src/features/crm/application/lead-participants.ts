import type { Json } from '@/shared/infrastructure/supabase'

/** Lead participant stored with its linked canonical contact in details.otrosIntervinientes. */
export type LeadParticipant = {
  contactoId: string
  nombre: string
  rol: string
  posicion?: string
}

export const PARTICIPANT_POSITIONS = ['De nuestra parte', 'Parte contraria', 'Tercero'] as const

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function readParticipants(details: Json): LeadParticipant[] {
  const list = record(details)['otrosIntervinientes']
  if (!Array.isArray(list)) return []
  return list.flatMap((item) => {
    const participant = record(item)
    const nombre = typeof participant['nombre'] === 'string' ? participant['nombre'] : ''
    if (!nombre && typeof participant['contactoId'] !== 'string') return []
    return [
      {
        contactoId: typeof participant['contactoId'] === 'string' ? participant['contactoId'] : '',
        nombre: nombre || 'Interviniente',
        rol: typeof participant['rol'] === 'string' ? participant['rol'] : '',
        ...(typeof participant['posicion'] === 'string' && participant['posicion']
          ? { posicion: participant['posicion'] }
          : {}),
      },
    ]
  })
}

export function addParticipant(details: Json, participant: LeadParticipant): Json {
  const current = readParticipants(details).filter(
    (existing) => !participant.contactoId || existing.contactoId !== participant.contactoId,
  )
  const clean: LeadParticipant = {
    contactoId: participant.contactoId,
    nombre: participant.nombre,
    rol: participant.rol,
    ...(participant.posicion ? { posicion: participant.posicion } : {}),
  }
  return { ...record(details), otrosIntervinientes: [...current, clean] } as Json
}

export function removeParticipant(details: Json, contactoId: string): Json {
  return {
    ...record(details),
    otrosIntervinientes: readParticipants(details).filter(
      (participant) => participant.contactoId !== contactoId,
    ),
  } as Json
}
