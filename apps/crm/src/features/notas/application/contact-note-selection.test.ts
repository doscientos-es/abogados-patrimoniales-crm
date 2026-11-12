import { describe, expect, it } from 'vitest'

import { notesForContact } from './contact-note-selection'

describe('notesForContact', () => {
  it('shares contact, linked and legacy lead notes without mixing other contacts', () => {
    const notes = [
      { id: 'contact', scope: 'person', origin_id: 'c1', opportunity_id: null, contactIds: [] },
      { id: 'lead', scope: 'opportunity', origin_id: 'l1', opportunity_id: 'l1', contactIds: ['c1'] },
      { id: 'legacy', scope: 'opportunity', origin_id: 'l2', opportunity_id: null, contactIds: [] },
      { id: 'case', scope: 'case', origin_id: 'case1', opportunity_id: null, contactIds: ['c1'] },
      { id: 'other', scope: 'person', origin_id: 'c2', opportunity_id: 'other', contactIds: ['c2'] },
    ]
    const leadIds = new Set(['l1', 'l2'])
    expect(notesForContact(notes, 'c1', leadIds).map((note) => note.id)).toEqual([
      'contact', 'lead', 'legacy', 'case',
    ])
    expect(notesForContact(notes, '', leadIds)).toEqual([])
  })
})