import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

import { useTransicionarOnboarding } from './supabase-onboardings'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ rpc: mocks.rpc }),
}))

beforeEach(() => vi.resetAllMocks())

function renderTransition() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useTransicionarOnboarding('firm'), { wrapper })
}

it('confirma con una sola RPC transaccional y no usa la transición antigua', async () => {
  mocks.rpc.mockResolvedValue({ data: { id: 'onb', phase: 'payment' }, error: null })
  const { result } = renderTransition()
  await act(() =>
    result.current.mutateAsync({
      id: 'onb',
      version: 2,
      accion: 'payment_confirmed',
      fecha: '2026-11-24',
      cobro: { importe: 50, metodo: 'card', referencia: 'TX' },
    }),
  )
  expect(mocks.rpc).toHaveBeenCalledOnce()
  expect(mocks.rpc).toHaveBeenCalledWith('crm_confirm_onboarding_receipt', {
    target_onboarding_id: 'onb',
    target_expected_version: 2,
    new_amount: 50,
    new_received_on: '2026-11-24',
    new_payment_method: 'card',
    new_external_reference: 'TX',
  })
})

it('no confirma si faltan los datos del cobro', async () => {
  const { result } = renderTransition()
  await expect(
    result.current.mutateAsync({ id: 'onb', version: 2, accion: 'payment_confirmed' }),
  ).rejects.toThrow(/importe/)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
