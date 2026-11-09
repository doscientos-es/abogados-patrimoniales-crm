import { describe, expect, it } from 'vitest'

import {
  ensureRequiredLeadDocumentRequests,
  reconcileRequestedLeadDocuments,
  type LeadContactDocument,
} from './lead-document-reconciliation'

const documents: LeadContactDocument[] = [
  {
    id: 'identity-1',
    document_type: 'identification',
    name: 'Identificación',
    original_name: 'DNI.pdf',
    document_status: 'current',
  },
  {
    id: 'privacy-1',
    document_type: 'privacy',
    name: 'Protección de datos',
    original_name: 'consentimiento.pdf',
    document_status: 'current',
  },
  {
    id: 'expired-1',
    document_type: 'authority',
    name: 'Representación',
    original_name: 'poder.pdf',
    document_status: 'expired',
  },
  {
    id: 'other-1',
    document_type: 'other',
    name: 'Justificante de domicilio',
    original_name: 'domicilio.pdf',
    document_status: 'current',
  },
]

describe('reconcileRequestedLeadDocuments', () => {
  it('adds the standard identity and privacy requests without duplicating existing variants', () => {
    expect(ensureRequiredLeadDocumentRequests(['DNI/NIE', 'Consentimiento RGPD'])).toEqual([
      'DNI/NIE',
      'Consentimiento RGPD',
    ])
    expect(ensureRequiredLeadDocumentRequests(['Justificante de domicilio'])).toEqual([
      'Identificación',
      'Protección de datos',
      'Justificante de domicilio',
    ])
  })

  it('matches received identity and privacy documents by their managed category', () => {
    const reconciled = reconcileRequestedLeadDocuments(
      ['DNI/NIE por ambas caras', 'Protección de datos'],
      documents,
    )

    expect(reconciled.map(({ receivedDocument }) => receivedDocument?.id)).toEqual([
      'identity-1',
      'privacy-1',
    ])
  })

  it('matches other requirements only by an exact normalized document name', () => {
    const reconciled = reconcileRequestedLeadDocuments(
      ['Justificante de domicilio', 'Documentación específica del asunto'],
      documents,
    )

    expect(reconciled.map(({ receivedDocument }) => receivedDocument?.id ?? null)).toEqual([
      'other-1',
      null,
    ])
  })

  it('accepts either managed representation category for a power-of-attorney requirement', () => {
    const reconciled = reconcileRequestedLeadDocuments(
      ['Poder de representación'],
      [
        {
          id: 'power-1',
          document_type: 'power',
          name: 'Poder',
          original_name: 'poder.pdf',
          document_status: 'current',
        },
      ],
    )

    expect(reconciled[0]?.receivedDocument?.id).toBe('power-1')
  })

  it('does not count expired, revoked, or pending documents as received', () => {
    const reconciled = reconcileRequestedLeadDocuments(
      ['Acreditación de representación', 'DNI'],
      [
        ...documents,
        {
          id: 'pending-identity',
          document_type: 'identification',
          name: 'Identificación nueva',
          original_name: 'dni-nuevo.pdf',
          document_status: 'pending',
        },
      ],
    )

    expect(reconciled.map(({ receivedDocument }) => receivedDocument)).toEqual([null, documents[0]])
  })
})
