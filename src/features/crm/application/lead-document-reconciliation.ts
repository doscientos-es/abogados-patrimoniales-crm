import type { ContactDocumentRow } from '@/shared/infrastructure/supabase'

export type LeadContactDocument = Pick<
  ContactDocumentRow,
  'id' | 'document_type' | 'name' | 'original_name' | 'document_status'
>

export type ReconciledLeadDocument = {
  requirement: string
  receivedDocument: LeadContactDocument | null
}

const REQUIRED_LEAD_DOCUMENTS = [
  { requirement: 'Identificación', category: 'identification' },
  { requirement: 'Protección de datos', category: 'privacy' },
] as const

function normalizeDocumentLabel(value: string) {
  return value
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function categoriesForRequirement(requirement: string): ContactDocumentRow['document_type'][] {
  const normalized = normalizeDocumentLabel(requirement)
  const words = new Set(normalized.split(' '))
  const categories: ContactDocumentRow['document_type'][] = []

  if (
    ['identificacion', 'identificativo', 'dni', 'nie', 'cif', 'pasaporte'].some((word) =>
      words.has(word),
    )
  ) {
    categories.push('identification')
  }
  if (
    ['privacidad', 'privacy', 'rgpd', 'lopd'].some((word) => words.has(word)) ||
    normalized.includes('proteccion de datos')
  ) {
    categories.push('privacy')
  }
  if (
    words.has('representacion') ||
    words.has('representante') ||
    words.has('poder') ||
    words.has('autorizacion')
  ) {
    categories.push('authority', 'power')
  }
  return categories
}

export function reconcileRequestedLeadDocuments(
  requirements: string[],
  receivedDocuments: LeadContactDocument[],
): ReconciledLeadDocument[] {
  const currentDocuments = receivedDocuments.filter(
    (document) => document.document_status === 'current',
  )

  return requirements.map((requirement) => {
    const categories = categoriesForRequirement(requirement)
    const normalizedRequirement = normalizeDocumentLabel(requirement)
    const receivedDocument = currentDocuments.find((document) =>
      categories.length > 0
        ? categories.includes(document.document_type)
        : [document.name, document.original_name].some(
            (name) => normalizeDocumentLabel(name) === normalizedRequirement,
          ),
    )

    return { requirement, receivedDocument: receivedDocument ?? null }
  })
}

export function ensureRequiredLeadDocumentRequests(requirements: string[]) {
  const existingCategories = requirements.flatMap(categoriesForRequirement)
  const missingRequirements = REQUIRED_LEAD_DOCUMENTS.filter(
    ({ category }) => !existingCategories.includes(category),
  ).map(({ requirement }) => requirement)

  return [...missingRequirements, ...requirements]
}
