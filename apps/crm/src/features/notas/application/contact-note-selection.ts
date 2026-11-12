type ContactNoteLink = {
  contactIds: string[]
  scope: string
  origin_id: string
  opportunity_id: string | null
}

/** Select the same persisted notes for a contact and its related leads. */
export function notesForContact<T extends ContactNoteLink>(
  notes: T[],
  contactId: string,
  opportunityIds: ReadonlySet<string>,
): T[] {
  if (!contactId) return []
  return notes.filter(
    (note) =>
      note.contactIds.includes(contactId) ||
      (note.scope === 'person' && note.origin_id === contactId) ||
      (note.opportunity_id !== null && opportunityIds.has(note.opportunity_id)) ||
      (note.scope === 'opportunity' && opportunityIds.has(note.origin_id)),
  )
}