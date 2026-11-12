import { describe, expect, it } from 'vitest'

import { findContactPhoneDuplicates } from './contact-phone-duplicates'

describe('findContactPhoneDuplicates', () => {
  const contacts = [
    { id: '1', name: 'Ana', phone: '+34 600 123 456', alternatePhone: '911 123 456' },
    { id: '2', name: 'Luis', phone: null, alternatePhone: null },
  ]
  it('matches both numbers despite Spanish prefixes and formatting', () => {
    expect(findContactPhoneDuplicates(contacts, ['0034 600123456', '911123456']).map((c) => c.id)).toEqual(['1'])
    expect(findContactPhoneDuplicates(contacts, ['', ''])).toEqual([])
    expect(findContactPhoneDuplicates(contacts, ['600123457'])).toEqual([])
  })
})