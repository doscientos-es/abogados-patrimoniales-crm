import type { Json } from '@/shared/infrastructure/supabase'

export type QuoteService = {
  id: string
  code: string
  name: string
  description: string
  family: string
  priceCents: number
  vatPct: number | null
  withholdingPct: number | null
  costCents: number
  active: boolean
  sourceData: Json
}

export type QuoteServiceDraft = Omit<QuoteService, 'id'>

export type EngagementBlock = {
  id: string
  title: string
  body: string
  order: number
  active: boolean
  includeByDefault: boolean
  reviewed: boolean
  archived: boolean
}

export type EngagementBlockDraft = Omit<EngagementBlock, 'id'> & { id?: string }

export type QuoteEmailTemplate = {
  id: string
  name: string
  subject: string
  body: string
  active: boolean
  isDefault: boolean
}

export type QuoteEmailTemplateDraft = Omit<QuoteEmailTemplate, 'id'> & { id?: string }

type HoldedRow = string[]

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

function cents(value: string): number {
  const normalized = value.replace(/€/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const amount = normalized === '' ? 0 : Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0
}

export function familyForService(code: string, name: string): string {
  const normalized = code.toUpperCase()
  if (normalized.startsWith('DCC')) return 'División de cosa común'
  if (normalized.startsWith('DJ')) return 'División judicial de herencia'
  if (normalized.startsWith('HE')) return 'Herencias'
  if (normalized.startsWith('CO') || normalized.startsWith('EXTRAN')) return 'Consultas'
  if (normalized.startsWith('AR')) return 'Arrendamientos'
  if (normalized.startsWith('MACS') || normalized.startsWith('MASC')) return 'MASC'
  if (normalized.startsWith('DE') && !normalized.startsWith('DERECHO'))
    return 'Desahucios y procedimientos'
  if (normalized.startsWith('PV')) return 'Desahucios y procedimientos'
  if (normalized.startsWith('PE')) return 'Valoraciones'
  if (normalized.startsWith('PP')) return 'Autorizaciones judiciales'
  if (normalized.startsWith('CV') || normalized.startsWith('BU')) return 'Compraventa'
  if (
    normalized.startsWith('GBAN') ||
    normalized === 'R.G' ||
    normalized === 'CLAUSULAE' ||
    normalized === 'DERECHOB'
  )
    return 'Derecho bancario'
  if (/NOTARIAL|REGISTRAL/i.test(name)) return 'Notarías y registros'
  return 'Otros'
}

function serviceFromHoldedRow(row: HoldedRow): QuoteServiceDraft | null {
  const code = text(row[4])
  const name = text(row[1])
  if (!code || !name) return null
  const description = text(row[2])
  const tags = text(row[3])
  const account = text(row[5])
  const priceCents = cents(text(row[6]))
  const costCents = cents(text(row[7]))
  const vatCents = cents(text(row[8]))
  const withholdingCents = cents(text(row[9]))
  const totalCents = cents(text(row[10]))
  const rate = (amount: number) =>
    priceCents > 0 ? Math.round((amount / priceCents) * 10000) / 100 : null
  return {
    code,
    name,
    description,
    family: familyForService(code, name),
    priceCents,
    vatPct: rate(vatCents),
    withholdingPct: rate(withholdingCents),
    costCents,
    active: true,
    sourceData: {
      system: 'Holded',
      tags,
      account,
      vatCents,
      withholdingCents,
      totalCents,
    },
  }
}

/** Parses the original Holded JSON export; malformed records are rejected rather than partially imported. */
export function parseHoldedServiceCatalog(value: unknown): QuoteServiceDraft[] {
  if (!Array.isArray(value))
    throw new Error('El archivo debe contener una lista JSON de servicios.')
  const rows = value.filter(
    (row): row is HoldedRow =>
      Array.isArray(row) && row.length >= 11 && row.every((cell) => typeof cell === 'string'),
  )
  if (rows.length !== value.length)
    throw new Error('El archivo contiene filas incompletas o con un formato no reconocido.')
  const services = rows.map(serviceFromHoldedRow)
  if (services.some((service) => service === null))
    throw new Error('Cada servicio debe incluir código y nombre.')
  const unique = new Map<string, QuoteServiceDraft>()
  for (const service of services) {
    if (service) unique.set(service.code.toLocaleLowerCase('es'), service)
  }
  return [...unique.values()]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Parses sandbox block exports without importing browser-generated IDs. */
export function parseEngagementBlockCatalog(value: unknown): Omit<EngagementBlock, 'id'>[] {
  if (!Array.isArray(value)) throw new Error('El archivo debe contener una lista JSON de bloques.')
  return value.map((value): Omit<EngagementBlock, 'id'> => {
    const row = record(value)
    const title = text(row?.['title'])
    const body = row?.['text'] ?? row?.['body']
    const order = row?.['order']
    if (
      !title ||
      typeof body !== 'string' ||
      typeof order !== 'number' ||
      !Number.isInteger(order) ||
      typeof row?.['active'] !== 'boolean' ||
      typeof row?.['includeByDefault'] !== 'boolean' ||
      typeof row?.['reviewed'] !== 'boolean'
    ) {
      throw new Error('El archivo contiene bloques incompletos o con un formato no reconocido.')
    }
    return {
      title,
      body,
      order,
      active: row['active'],
      includeByDefault: row['includeByDefault'],
      reviewed: row['reviewed'],
      archived: false,
    }
  })
}

/** Parses sandbox email-template exports without importing browser-generated IDs. */
export function parseQuoteEmailTemplateCatalog(value: unknown): Omit<QuoteEmailTemplate, 'id'>[] {
  if (!Array.isArray(value))
    throw new Error('El archivo debe contener una lista JSON de plantillas.')
  const templates = value.map((value): Omit<QuoteEmailTemplate, 'id'> => {
    const row = record(value)
    const name = text(row?.['nombre'] ?? row?.['name'])
    const subject = row?.['asunto'] ?? row?.['subject']
    const body = row?.['cuerpo'] ?? row?.['body']
    const active = row?.['activa'] ?? row?.['active']
    const isDefault = row?.['predeterminada'] ?? row?.['isDefault']
    if (
      !name ||
      typeof subject !== 'string' ||
      typeof body !== 'string' ||
      typeof active !== 'boolean' ||
      typeof isDefault !== 'boolean'
    ) {
      throw new Error('El archivo contiene plantillas incompletas o con un formato no reconocido.')
    }
    return { name, subject, body, active, isDefault: isDefault && active }
  })
  const normalizedNames = new Set<string>()
  for (const template of templates) {
    const key = template.name.toLocaleLowerCase('es')
    if (normalizedNames.has(key))
      throw new Error('El archivo contiene nombres de plantilla duplicados.')
    normalizedNames.add(key)
  }
  if (templates.filter((template) => template.isDefault).length > 1)
    throw new Error('El archivo no puede tener más de una plantilla predeterminada.')
  return templates
}

export function defaultQuoteTemplate(templates: QuoteEmailTemplate[]) {
  return templates.find((template) => template.active && template.isDefault) ?? null
}
