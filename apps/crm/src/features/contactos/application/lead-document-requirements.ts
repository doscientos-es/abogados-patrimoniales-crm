import { ensureRequiredLeadDocumentRequests } from '@/features/crm/application/lead-document-reconciliation'

type LeadDetails = { detalles: unknown }

/** Collects all document requirements saved in a contact's Leads. */
export function requiredDocumentsForContact(
  opportunities: LeadDetails[],
  isLead: boolean,
): string[] {
  if (!isLead) return []

  const requests = opportunities.flatMap((opportunity) => {
    const details = opportunity.detalles
    if (!details || typeof details !== 'object' || Array.isArray(details)) return []
    const requested = (details as Record<string, unknown>)['documentacionSolicitada']
    return Array.isArray(requested)
      ? requested.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : []
  })

  return ensureRequiredLeadDocumentRequests([...new Set(requests)])
}
