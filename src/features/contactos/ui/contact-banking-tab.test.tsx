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
    fireEvent.change(screen.getByLabelText('IBAN'), {
      target: { value: 'ES12 3456 7890 1234 56' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y archivar la cuenta anterior' }))

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ holder: 'Lucía Pérez', iban: 'ES1234567890123456' }),
      ),
    )
    expect(mocks.toastSuccess).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('rejects IBANs outside the supported length before calling persistence', async () => {
    renderBankingTab()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevos datos bancarios' }))
    fireEvent.change(screen.getByLabelText('Titular'), { target: { value: 'Lucía Pérez' } })
    const iban = screen.getByLabelText('IBAN') as HTMLInputElement
    fireEvent.change(iban, { target: { value: 'ES123' } })

    expect(iban.validity.patternMismatch).toBe(true)
    expect(iban.closest('form')?.checkValidity()).toBe(false)
    fireEvent.submit(iban.closest('form') as HTMLFormElement)
    expect(mocks.mutateAsync).not.toHaveBeenCalled()
    expect(mocks.toastError).toHaveBeenCalledWith(
      'El IBAN debe tener entre 15 y 34 caracteres, sin contar espacios.',
    )
  })

  it('validates BIC / SWIFT using its native 8- or 11-character pattern', () => {
    renderBankingTab()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevos datos bancarios' }))
    const bic = screen.getByLabelText('BIC / SWIFT') as HTMLInputElement

    fireEvent.change(bic, { target: { value: '1234' } })
    expect(bic.validity.patternMismatch).toBe(true)
    fireEvent.change(bic, { target: { value: 'CAIXESBB' } })
    expect(bic.checkValidity()).toBe(true)
  })

  it('translates the bank RPC invalid-IBAN error', async () => {
    mocks.mutateAsync.mockRejectedValueOnce({ message: 'IBAN is invalid' })
    renderBankingTab()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevos datos bancarios' }))
    fireEvent.change(screen.getByLabelText('Titular'), { target: { value: 'Lucía Pérez' } })
    fireEvent.change(screen.getByLabelText('IBAN'), { target: { value: 'ES1234567890123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y archivar la cuenta anterior' }))

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'El IBAN debe tener entre 15 y 34 caracteres, sin contar espacios.',
      ),
    )
    expect(screen.getByRole('dialog', { name: 'Nuevos datos bancarios' })).toBeTruthy()
  })
})
