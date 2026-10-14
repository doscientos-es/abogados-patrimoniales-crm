// Tipos de intervención en un expediente (modelo «Implicados»).
// La persona vive una sola vez en Contactos; su papel en ESTE expediente
// (tipo, ref., descripción, orden, contacto subordinado) vive en la intervención.

export const PARTICIPANT_TYPES = [
  'Cliente',
  'Contrario',
  'Letrado',
  'Procurador',
  'Responsable',
  'Tercero',
  'Colaborador',
  'Colitigante',
  'Notario',
  'Perito',
  'Profesional',
  'Proveedor',
  'Empleado',
  'Arrendatario',
] as const

export type ParticipantType = (typeof PARTICIPANT_TYPES)[number]

/** Tipo fijo de los contactos subordinados a un interviniente. */
export const INTERNAL_CONTACT_ROLE = 'Contacto interno'

const LEGACY: Array<[ParticipantType, RegExp]> = [
  ['Letrado', /abogad|letrad/i],
  ['Procurador', /procurador/i],
  ['Notario', /notari/i],
  ['Perito', /perit/i],
  ['Colitigante', /colitigant/i],
  ['Contrario', /contrari|contraparte|demandad/i],
  ['Cliente', /cliente|contacto principal|heredero|representad|apoderad/i],
]

/** Clasifica roles guardados antes (texto libre o «Grupo · detalle»). */
export function participantTypeFromRole(rol: string): { tipo: ParticipantType; detalle: string } {
  const text = rol.trim()
  const [head, ...rest] = text.split(' · ')
  const exact = PARTICIPANT_TYPES.find((t) => t.toLowerCase() === (head ?? '').toLowerCase())
  if (exact) return { tipo: exact, detalle: rest.join(' · ').trim() }
  if (/^abogado contrario/i.test(text)) return { tipo: 'Letrado', detalle: rest.join(' · ').trim() }
  if (/^otros intervinientes/i.test(text))
    return { tipo: 'Tercero', detalle: rest.join(' · ').trim() }
  for (const [tipo, re] of LEGACY) if (re.test(text)) return { tipo, detalle: text }
  return { tipo: 'Tercero', detalle: text }
}

export type OrderableParticipant = { id: string; orden: number; creadoEn: string }

export function sortParticipants<T extends OrderableParticipant>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.orden - b.orden || a.creadoEn.localeCompare(b.creadoEn))
}

/**
 * Mueve un interviniente entre sus hermanos y devuelve solo los cambios de orden
 * que hay que persistir (renumerados de 10 en 10).
 */
export function reorderParticipants<T extends OrderableParticipant>(
  siblings: readonly T[],
  id: string,
  direction: 'up' | 'down',
): Array<{ id: string; orden: number }> {
  const list = sortParticipants(siblings)
  const index = list.findIndex((p) => p.id === id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= list.length) return []
  const moved = [...list]
  const [item] = moved.splice(index, 1)
  if (!item) return []
  moved.splice(target, 0, item)
  return moved
    .map((p, i) => ({ id: p.id, orden: (i + 1) * 10, previo: p.orden }))
    .filter((p) => p.orden !== p.previo)
    .map(({ id: pid, orden }) => ({ id: pid, orden }))
}

/** Posibles duplicados en el directorio por identificador o email. */
export function possibleDuplicates<
  C extends { id: string; nif?: string | null; email?: string | null },
>(contacts: readonly C[], nif: string, email: string): C[] {
  const n = nif.replace(/[\s.-]/g, '').toUpperCase()
  const e = email.trim().toLowerCase()
  if (!n && !e) return []
  return contacts.filter(
    (c) =>
      (n && (c.nif ?? '').replace(/[\s.-]/g, '').toUpperCase() === n) ||
      (e && (c.email ?? '').trim().toLowerCase() === e),
  )
}
