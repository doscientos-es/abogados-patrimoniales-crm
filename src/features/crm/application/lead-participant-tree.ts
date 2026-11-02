import type {
  ActualizarParticipanteInput,
  CrearParticipanteInput,
  ParticipantePersistido,
} from '@/features/expedientes/application/case-types'
import type { Json } from '@/shared/infrastructure/supabase'

/**
 * Lead participants use the same model as the case participants tree and are stored in
 * details.otrosIntervinientes. The historical keys (contactoId, nombre, rol, posicion) are kept
 * so that copying them into the case on opening still works.
 */
type Item = Record<string, unknown>

function record(value: unknown): Item {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Item) : {}
}
const str = (value: unknown) => (typeof value === 'string' ? value : '')

function items(details: Json): Item[] {
  const list = record(details)['otrosIntervinientes']
  if (!Array.isArray(list)) return []
  return list.map((raw, index) => {
    const item = record(raw)
    return { ...item, id: str(item['id']) || `lead-${str(item['contactoId']) || index}` }
  })
}

function withItems(details: Json, list: Item[]): Json {
  return { ...record(details), otrosIntervinientes: list } as Json
}

export function readLeadTreeParticipants(details: Json, leadId: string): ParticipantePersistido[] {
  return items(details)
    .filter((item) => !str(item['retiradoEn']))
    .map((item) => ({
      id: str(item['id']),
      expedienteId: leadId,
      contactoId: str(item['contactoId']) || null,
      nombre: str(item['nombre']) || 'Interviniente',
      rol: str(item['rol']),
      confidencialidad: 'Normal' as const,
      ...(str(item['tipo']) ? { tipo: str(item['tipo']) } : {}),
      ref: str(item['ref']),
      descripcion: str(item['descripcion']) || str(item['posicion']),
      orden: typeof item['orden'] === 'number' ? item['orden'] : 0,
      titularId: str(item['titularId']) || null,
      miembroId: str(item['miembroId']) || null,
      creadoEn: str(item['creadoEn']),
      detalles: item as Json,
    }))
}

export function addLeadTreeParticipant(
  details: Json,
  input: CrearParticipanteInput,
  id: string,
  now: string,
): Json {
  const item: Item = {
    id,
    contactoId: input.contactoId ?? '',
    nombre: input.nombre,
    rol: input.rol,
    tipo: input.rol,
    ref: input.ref ?? '',
    descripcion: input.descripcion ?? '',
    orden: input.orden ?? 0,
    ...(input.titularId ? { titularId: input.titularId } : {}),
    ...(input.miembroId ? { miembroId: input.miembroId } : {}),
    creadoEn: now,
  }
  return withItems(details, [...items(details), item])
}

export function updateLeadTreeParticipant(
  details: Json,
  input: ActualizarParticipanteInput,
): Json {
  return withItems(
    details,
    items(details).map((item) =>
      item['id'] === input.id
        ? {
            ...item,
            contactoId: input.contactoId ?? '',
            nombre: input.nombre,
            rol: input.rol,
            tipo: input.rol,
            miembroId: input.miembroId ?? null,
            ref: input.ref ?? '',
            descripcion: input.descripcion ?? '',
          }
        : item,
    ),
  )
}

/** Removing from the Lead only drops the link; the person stays in Contactos. */
export function removeLeadTreeParticipants(details: Json, ids: string[]): Json {
  return withItems(
    details,
    items(details).filter((item) => !ids.includes(str(item['id']))),
  )
}

export function reorderLeadTreeParticipants(
  details: Json,
  changes: Array<{ id: string; orden: number }>,
): Json {
  const orders = new Map(changes.map((change) => [change.id, change.orden]))
  return withItems(
    details,
    items(details).map((item) =>
      orders.has(str(item['id'])) ? { ...item, orden: orders.get(str(item['id'])) } : item,
    ),
  )
}
