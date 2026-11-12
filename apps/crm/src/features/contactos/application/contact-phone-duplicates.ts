export type ContactPhoneCandidate = {
  id: string
  name: string
  phone: string | null
  alternatePhone: string | null
}

export function normalizeContactPhone(value: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('34')) return digits.slice(2)
  if (digits.length === 13 && digits.startsWith('0034')) return digits.slice(4)
  return digits
}

export function findContactPhoneDuplicates(
  contacts: ContactPhoneCandidate[],
  values: readonly string[],
): ContactPhoneCandidate[] {
  const phones = new Set(values.map(normalizeContactPhone).filter(Boolean))
  return contacts.filter((contact) =>
    [contact.phone, contact.alternatePhone].some((phone) => {
      const normalized = normalizeContactPhone(phone)
      return normalized !== '' && phones.has(normalized)
    }),
  )
}