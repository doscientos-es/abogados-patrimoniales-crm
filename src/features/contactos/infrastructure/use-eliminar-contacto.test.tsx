import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  firstFilter: vi.fn(),
  from: vi.fn(),
  secondFilter: vi.fn(),
}))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ from: mocks.from }),
}))

import { type ContactoPersistido, useEliminarContacto } from './supabase-contactos'

const contact = (id: string) => ({ id }) as ContactoPersistido

describe('useEliminarContacto', () => {
  it('borra únicamente el contacto del despacho activo y actualiza la caché', async () => {
    mocks.secondFilter.mockResolvedValue({ error: null })
    mocks.firstFilter.mockReturnValue({ eq: mocks.secondFilter })
    mocks.delete.mockReturnValue({ eq: mocks.firstFilter })
    mocks.from.mockReturnValue({ delete: mocks.delete })

    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    client.setQueryData<ContactoPersistido[]>(
      ['crm', 'contactos', 'firm-1'],
      [contact('contact-1'), contact('contact-2')],
    )
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useEliminarContacto('firm-1'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 'contact-1' })
    })

    expect(mocks.from).toHaveBeenCalledWith('crm_contacts')
    expect(mocks.firstFilter).toHaveBeenCalledWith('id', 'contact-1')
    expect(mocks.secondFilter).toHaveBeenCalledWith('firm_id', 'firm-1')
    expect(client.getQueryData<ContactoPersistido[]>(['crm', 'contactos', 'firm-1'])).toEqual([
      contact('contact-2'),
    ])
  })

  it('explica que un contacto vinculado debe archivarse', async () => {
    mocks.secondFilter.mockResolvedValue({ error: { code: '23503' } })
    mocks.firstFilter.mockReturnValue({ eq: mocks.secondFilter })
    mocks.delete.mockReturnValue({ eq: mocks.firstFilter })
    mocks.from.mockReturnValue({ delete: mocks.delete })
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useEliminarContacto('firm-1'), { wrapper })

    await expect(result.current.mutateAsync({ id: 'contact-1' })).rejects.toThrow(
      'Este contacto tiene registros vinculados. Archívalo en lugar de eliminarlo.',
    )
  })
})
