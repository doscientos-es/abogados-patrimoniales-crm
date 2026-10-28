/** Nombre visible normalizado del documento; nunca sustituye el nombre original almacenado. */

export const UNIDENTIFIED = 'SIN IDENTIFICAR'
export const MIN_CONFIDENCE = 0.6

export type DocumentType = {
  id: string
  name: string
  suggestions: string[]
  sort_order: number
  active: boolean
}

export const BUILTIN_DOCUMENT_TYPES = [
  'DEMANDA',
  'CONTESTACIÓN',
  'ESCRITO',
  'RECURSO',
  'SENTENCIA',
  'AUTO',
  'DECRETO',
  'PROVIDENCIA',
  'DILIGENCIA',
  'REQUERIMIENTO',
  'BUROFAX',
  'CONTRATO',
  'ESCRITURA',
  'TESTAMENTO',
  'PODER',
  'CERTIFICADO',
  'NOTA SIMPLE',
  'INFORME PERICIAL',
  'FACTURA',
  'JUSTIFICANTE',
  'CORRESPONDENCIA',
  'IDENTIFICACIÓN',
  'HOJA DE ENCARGO',
  'PRESUPUESTO',
  'ACTA',
]

export function normalizeTypeName(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleUpperCase('es-ES')
}

export function validateTypeName(
  value: string,
  existing: { id: string; name: string }[],
  selfId?: string,
) {
  const name = normalizeTypeName(value)
  if (!name) return 'Escribe el nombre del tipo.'
  if (name.length > 60) return 'Máximo 60 caracteres.'
  if (name === UNIDENTIFIED) return 'Ese nombre está reservado.'
  if (existing.some((type) => type.id !== selfId && normalizeTypeName(type.name) === name))
    return 'Ya existe un tipo con ese nombre.'
  return null
}

export function cleanDescription(value: string) {
  return value
    .replace(/\.(pdf|docx?|jpe?g|png|webp)$/i, '')
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, '')
    .replace(/\b(final|definitivo|v\d+|copia)\s*\d*\b/gi, '')
    .replace(/[_\s]+/g, ' ')
    .replace(/^[\s\-–]+|[\s\-–]+$/g, '')
    .slice(0, 120)
    .trim()
}

export function buildDisplayName(
  typeName: string | null | undefined,
  description: string,
  originalName: string,
) {
  const type = typeName ? normalizeTypeName(typeName) : UNIDENTIFIED
  const descriptionText = cleanDescription(description)
  const extension = /\.([a-z0-9]{1,5})$/i.exec(originalName)?.[0].toLowerCase() ?? ''
  return `${type}${descriptionText ? ` - ${descriptionText}` : ''}${extension}`
}

export type AiSuggestion = {
  typeId: string | null
  typeName: string | null
  confidence: number
  description: string
  documentDate: string | null
  parties: string[]
  court: string | null
  procedureNumber: string | null
}

export type RawAiSuggestion = Omit<AiSuggestion, 'typeId'>

export function sanitizeSuggestion(
  raw: RawAiSuggestion,
  catalog: { id: string; name: string }[],
): AiSuggestion {
  const confidence = Number.isFinite(raw.confidence)
    ? Math.min(1, Math.max(0, raw.confidence))
    : 0
  const match = raw.typeName
    ? catalog.find((type) => normalizeTypeName(type.name) === normalizeTypeName(raw.typeName ?? ''))
    : undefined
  const identified = Boolean(match && confidence >= MIN_CONFIDENCE)
  const date = raw.documentDate ?? ''
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))

  return {
    typeId: identified ? match!.id : null,
    typeName: identified ? match!.name : null,
    confidence,
    description: identified ? cleanDescription(raw.description ?? '') : '',
    documentDate: validDate ? date : null,
    parties: Array.isArray(raw.parties)
      ? raw.parties.filter((party) => typeof party === 'string').map((party) => party.trim()).filter(Boolean).slice(0, 6)
      : [],
    court: typeof raw.court === 'string' ? raw.court.trim().slice(0, 200) || null : null,
    procedureNumber:
      typeof raw.procedureNumber === 'string' ? raw.procedureNumber.trim().slice(0, 120) || null : null,
  }
}