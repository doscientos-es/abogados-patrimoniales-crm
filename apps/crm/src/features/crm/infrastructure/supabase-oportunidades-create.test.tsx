import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ insert: vi.fn(), single: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    from: () => ({ insert: mocks.insert }),
  }),
}))

import { useCrearOportunidad } from './supabase-oportunidades'

const contact = '11111111-1111-4111-8111-111111111111'
const assignee = '22222222-2222-4222-8222-222222222222'
const input = { contactId: contact, title: 'Consulta', details: {} }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) })
  mocks.single.mockResolvedValue({
    data: { id: 'lead', priority: 'medium', stage: 'entry', details: {} },
    error: null,
  })
})

function renderCreate() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useCrearOportunidad('firm'), { wrapper }).result
}

describe('alta de oportunidad', () => {
  it('incluye el responsable seleccionado en la inserción y admite ausencia de responsable', async () => {
    const result = renderCreate()
    await act(() => result.current.mutateAsync({ ...input, assignedTo: assignee }))
    expect(mocks.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ assigned_to: assignee }),
    )
    await act(() => result.current.mutateAsync(input))
    expect(mocks.insert).toHaveBeenLastCalledWith(expect.objectContaining({ assigned_to: null }))
  })

  it('rechaza identificadores de responsable inválidos antes de insertar', async () => {
    const result = renderCreate()
    await expect(result.current.mutateAsync({ ...input, assignedTo: 'invalido' })).rejects.toThrow()
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
