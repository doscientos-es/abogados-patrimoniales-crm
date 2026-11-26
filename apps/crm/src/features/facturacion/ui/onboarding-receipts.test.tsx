import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { FacturaPersistida } from '@/features/facturacion/application'
import type { OnboardingPersistido } from '@/features/onboarding/application/onboarding-types'

import { OnboardingReceipts } from './onboarding-receipts'

const mocks = vi.hoisted(() => ({ apply: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/features/facturacion/application', async (original) => ({
  ...(await original<typeof import('@/features/facturacion/application')>()),
  useApplyOnboardingReceipt: () => ({ mutateAsync: mocks.apply, isPending: false }),
  useOnboardingReceipts: () => ({
    data: [
      {
        id: 'receipt',
        onboarding_id: 'onb',
        amount: 50,
        received_on: '2026-11-24',
        payment_method: 'transfer',
        external_reference: '',
        invoice_payment_id: null,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}))

afterEach(() => {
  cleanup()
  mocks.apply.mockClear()
})

it('ofrece vincular un cobro existente sin crear uno nuevo', async () => {
  const onboarding = {
    id: 'onb',
    referencia: 'ONB-1',
    expedienteId: 'case',
    contactoId: 'contact',
  } as OnboardingPersistido
  const invoice = {
    id: 'invoice',
    referencia: 'A-1',
    asuntoId: 'case',
    contactoId: 'contact',
    moneda: 'EUR',
    tipo: 'standard',
    estado: 'partially_paid',
    importePendiente: 100,
    cobros: [
      { id: 'payment', importe: 50, fecha: '2026-11-24', metodo: 'transfer', referencia: 'TX' },
    ],
  } as FacturaPersistida
  render(<OnboardingReceipts firmId="firm" onboardings={[onboarding]} invoices={[invoice]} />)
  fireEvent.change(screen.getByLabelText('Factura para ONB-1'), { target: { value: 'invoice' } })
  fireEvent.change(screen.getByLabelText('Aplicación de ONB-1'), { target: { value: 'payment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar provisión' }))
  await waitFor(() =>
    expect(mocks.apply).toHaveBeenCalledWith({
      receiptId: 'receipt',
      invoiceId: 'invoice',
      paymentId: 'payment',
    }),
  )
})

it('impide seleccionar facturas de otro expediente', () => {
  const onboarding = {
    id: 'onb',
    referencia: 'ONB-1',
    expedienteId: 'case',
    contactoId: 'contact',
  } as OnboardingPersistido
  const invoice = {
    id: 'invoice',
    referencia: 'A-1',
    asuntoId: 'other',
    contactoId: 'contact',
    moneda: 'EUR',
    tipo: 'standard',
    cobros: [],
  } as unknown as FacturaPersistida
  render(<OnboardingReceipts firmId="firm" onboardings={[onboarding]} invoices={[invoice]} />)
  expect(screen.queryByRole('option', { name: /A-1/ })).toBeNull()
  expect(screen.getByText(/No hay facturas del expediente/)).toBeTruthy()
})
