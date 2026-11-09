export type NaturalezaAsunto = 'extrajudicial' | 'judicial' | 'pendiente'

export const NATURALEZA_LABEL: Record<NaturalezaAsunto, string> = {
  extrajudicial: 'Extrajudicial',
  judicial: 'Judicial',
  pendiente: 'Pendiente de determinar',
}

export type CambioNaturaleza = {
  valor: NaturalezaAsunto
  anterior: NaturalezaAsunto | null
  por: string
  en: string
  motivo: string
}

export type NaturalezaRegistro = { valor: NaturalezaAsunto; historial: CambioNaturaleza[] }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const VALORES: NaturalezaAsunto[] = ['extrajudicial', 'judicial', 'pendiente']

export function leerNaturaleza(details: unknown): NaturalezaRegistro | null {
  const nature = record(record(details)['naturalezaAsunto'])
  const value = nature['valor']
  if (typeof value !== 'string' || !VALORES.includes(value as NaturalezaAsunto)) return null
  const historial = Array.isArray(nature['historial'])
    ? (nature['historial'] as CambioNaturaleza[])
    : []
  return { valor: value as NaturalezaAsunto, historial }
}

/** Initial classification needs no reason; later changes require a reason and are audited. */
export function fijarNaturaleza(
  details: unknown,
  valor: NaturalezaAsunto,
  actorId: string,
  now: string,
  motivo = '',
): Record<string, unknown> {
  const base = record(details)
  const actual = leerNaturaleza(base)
  if (actual?.valor === valor) throw new Error('La naturaleza ya tiene ese valor.')
  if (actual && !motivo.trim()) throw new Error('Indica el motivo del cambio de naturaleza.')
  const cambio: CambioNaturaleza = {
    valor,
    anterior: actual?.valor ?? null,
    por: actorId,
    en: now,
    motivo: motivo.trim() || 'Clasificación inicial',
  }
  return { ...base, naturalezaAsunto: { valor, historial: [...(actual?.historial ?? []), cambio] } }
}

export function naturalezaDefinitiva(
  naturaleza: NaturalezaAsunto | null | undefined,
): naturaleza is 'judicial' | 'extrajudicial' {
  return naturaleza === 'judicial' || naturaleza === 'extrajudicial'
}
