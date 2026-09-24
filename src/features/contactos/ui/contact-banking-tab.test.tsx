import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

vi.mock('@/features/contactos', () => ({
  useContactBankAccounts: () => ({ data: [], isPending: false, isError: false }),
  useReplaceContactBankAccount: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}))

import { ContactBankingTab } from './contact-banking-tab'

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mutateAsync.mockResolvedValue(undefined)
})

function renderBankingTab() {
  const memberRole = 'lawyer' as const
  render(<ContactBankingTab firmId="firm-1" contactId="contact-1" role={memberRole} />)
}

describe('ContactBankingTab', () => {
  it('keeps the bank account form hidden until the CTA opens its dialog', () => {
    renderBankingTab()

    expect(screen.queryByLabelText('Titular')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevos datos bancarios' }))

    expect(screen.getByRole('dialog', { name: 'Nuevos datos bancarios' })).toBeTruthy()
    expect(screen.getByLabelText('Titular')).toBeTruthy()
  })

  it('saves the new account from the dialog and closes it', async () => {
    renderBankingTab()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevos datos bancarios' }))
    fireEvent.change(screen.getByLabelText('Titular'), { target: { value: 'Lucía Pérez' } })
    fireEvent.change(screen.getByLabelText('IBAN'), { target: { value: 'ES1234567890123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y archivar la cuenta anterior' }))

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ holder: 'Lucía Pérez', iban: 'ES1234567890123456' }),
      ),
    )
    expect(mocks.toastSuccess).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
