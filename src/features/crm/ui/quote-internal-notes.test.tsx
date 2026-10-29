import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: string; to: string; className: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('@/features/notas', () => ({
  useGuardarNota: () => ({ isPending: false, mutateAsync: mocks.save }),
  useNotasRemotas: () => ({ data: [], isPending: false }),
}))

import { QuoteInternalNotes } from './quote-internal-notes'

afterEach(() => {
  cleanup()
  mocks.save.mockClear()
})

describe('notas privadas del presupuesto', () => {
  it('saves notes in the opportunity scope with the budget-only marker', async () => {
    render(
      <QuoteInternalNotes
        firmId="firm-1"
        opportunityId="lead-1"
        label="PR-1"
        contactId="contact-1"
      />,
    )
    fireEvent.change(screen.getByLabelText('Título de nota interna'), {
      target: { value: 'Riesgo' },
    })
    fireEvent.change(screen.getByLabelText('Contenido de nota interna'), {
      target: { value: 'Revisar alcance.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.save.mock.calls[0]?.[0]).toMatchObject({
      scope: 'opportunity',
      opportunityId: 'lead-1',
      contactIds: ['contact-1'],
      visibility: 'team',
      extraDetails: { area: 'presupuesto' },
      content: 'Revisar alcance.',
    })
  })
})
