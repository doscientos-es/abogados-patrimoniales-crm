import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ rpc: mocks.rpc }),
}))

import { useRegistrarProformaEnviada } from './supabase-oportunidades'

const input = {
  opportunityId: 'lead',
  opportunityVersion: 3,
  onboardingId: 'onboarding',
  onboardingVersion: 4,
  proforma: { estado: 'enviada', fechaEnvio: '2026-11-24' },
}

function renderMutation() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return {
    client,
    result: renderHook(() => useRegistrarProformaEnviada('firm'), { wrapper }).result,
  }
}

beforeEach(() => vi.resetAllMocks())

describe('registro de proforma enviada', () => {
  it('guarda ambos registros con una sola llamada y actualiza la ficha', async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: 'lead', priority: 'medium', stage: 'won', details: { proforma: input.proforma } },
      error: null,
    })
    const { client, result } = renderMutation()
    await act(() => result.current.mutateAsync(input))
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith('crm_save_sent_proforma', {
      target_opportunity_id: 'lead',
      target_opportunity_version: 3,
      target_onboarding_id: 'onboarding',
      target_onboarding_version: 4,
      new_proforma: input.proforma,
    })
    expect(client.getQueryData(['crm', 'oportunidades', 'firm', 'lead'])).toMatchObject({
      id: 'lead',
      detalles: { proforma: input.proforma },
    })
  })

  it('avisa de conflictos sin actualizar la ficha', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001' } })
    const { client, result } = renderMutation()
    await expect(result.current.mutateAsync(input)).rejects.toThrow(/ha cambiado/)
    expect(client.getQueryData(['crm', 'oportunidades', 'firm', 'lead'])).toBeUndefined()
  })
})
