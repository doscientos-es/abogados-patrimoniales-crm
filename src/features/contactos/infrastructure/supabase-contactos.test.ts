import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  in: vi.fn(),
  order: vi.fn(),
  or: vi.fn(),
  range: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@/shared/infrastructure/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/infrastructure/supabase')>()),
  getSupabaseBrowserClient: () => ({ from: mocks.from }),
}))

import type { ContactRow } from '@/shared/infrastructure/supabase'

import { contactoFromRow, useContactosPaginados } from './supabase-contactos'

const row = {
  id: 'contact-1',
  firm_id: 'firm-1',
  reference: 'CT-0005',
  nature: 'person',
  relationship: 'client',
  status: 'active',
  display_name: 'Ana López',
  first_name: 'Ana',
  last_name: 'López',
  legal_name: null,
  tax_id: '12345678A',
  email: 'ana@example.com',
  phone: '600 000 000',
  source: 'Web',
  details: {},
  version: 1,
  created_by: null,
  updated_by: null,
  created_at: '2026-08-20T12:00:00Z',
  updated_at: '2026-09-04T12:00:00Z',
} satisfies ContactRow

beforeEach(() => {
  const builder = {
    eq: mocks.eq,
    in: mocks.in,
    order: mocks.order,
    or: mocks.or,
    range: mocks.range,
    select: mocks.select,
  }
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.from.mockReturnValue(builder)
  mocks.select.mockReturnValue(builder)
  mocks.eq.mockReturnValue(builder)
  mocks.in.mockReturnValue(builder)
  mocks.order.mockReturnValue(builder)
  mocks.or.mockReturnValue(builder)
})

describe('contactoFromRow', () => {
  it('preserva la referencia y las fechas sin formato para el listado operativo', () => {
    const contact = contactoFromRow(row)

    expect(contact).toMatchObject({
      referencia: 'CT-0005',
      creadoEn: '2026-08-20T12:00:00Z',
      modificadoEn: '2026-09-04T12:00:00Z',
      creado: '20/08/2026',
      modificado: '04/09/2026',
    })
  })
})

describe('useContactosPaginados', () => {
  it('aplica filtros, orden y rango en Supabase sin descargar el listado completo', async () => {
    mocks.range.mockResolvedValue({ data: [row], count: 21, error: null })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(
      () =>
        useContactosPaginados('firm-1', {
          query: 'Ana',
          archived: false,
          relationship: 'Cliente',
          nature: 'Persona física',
          status: 'all',
          source: 'Web',
          sortBy: 'modified',
          page: 2,
          pageSize: 10,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mocks.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(mocks.in).toHaveBeenCalledWith('status', ['active', 'inactive'])
    expect(mocks.eq).toHaveBeenCalledWith('relationship', 'client')
    expect(mocks.eq).toHaveBeenCalledWith('nature', 'person')
    expect(mocks.or).toHaveBeenCalledWith(
      'display_name.ilike.%Ana%,tax_id.ilike.%Ana%,email.ilike.%Ana%,phone.ilike.%Ana%,source.ilike.%Ana%',
    )
    expect(mocks.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(mocks.range).toHaveBeenCalledWith(10, 19)
    expect(result.current.data).toMatchObject({ count: 21, contacts: [{ id: 'contact-1' }] })
  })
})
