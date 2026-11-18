import { normalizeContactPhone } from './contact-phone-duplicates'

export const DUPLICATE_CONTACT_FIELDS = [
  'documento',
  'email',
  'email2',
  'telefono',
  'telefono2',
] as const

export type DuplicateContactField = (typeof DUPLICATE_CONTACT_FIELDS)[number]
export type DuplicateContactValues = Record<DuplicateContactField, string>

export type DuplicateContactCandidate = {
  id: string
  name: string
  taxId: string | null
  email: string | null
  alternateEmail: string | null
  phone: string | null
  alternatePhone: string | null
}

export type DuplicateContactMatch = {
  contact: DuplicateContactCandidate
  fields: DuplicateContactField[]
}

const normalizeDocument = (value: string | null) =>
  (value ?? '')
    .trim()
    .toLocaleUpperCase('es-ES')
    .replace(/[\s.-]/g, '')
const normalizeEmail = (value: string | null) => (value ?? '').trim().toLocaleLowerCase('es-ES')

export function findContactDuplicates(
  contacts: DuplicateContactCandidate[],
  values: DuplicateContactValues,
): DuplicateContactMatch[] {
  return contacts.flatMap((contact) => {
    const fields = DUPLICATE_CONTACT_FIELDS.filter((field) => {
      const value = values[field]
      if (!value.trim()) return false

      if (field === 'documento')
        return normalizeDocument(contact.taxId) === normalizeDocument(value)

      const candidates =
        field === 'email' || field === 'email2'
          ? [contact.email, contact.alternateEmail]
          : [contact.phone, contact.alternatePhone]
      const normalize =
        field === 'email' || field === 'email2' ? normalizeEmail : normalizeContactPhone
      const normalizedValue = normalize(value)
      return Boolean(
        normalizedValue && candidates.some((candidate) => normalize(candidate) === normalizedValue),
      )
    })
    return fields.length ? [{ contact, fields }] : []
  })
}
