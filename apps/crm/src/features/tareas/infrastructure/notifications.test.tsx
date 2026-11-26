import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  range: vi.fn(),
  channel: vi.fn(),
}))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: vi.fn(),
  }),
}))

import {
  useHistorialNotificaciones,
  useNotificacionesSinLeer,
  useNotificacionesTareas,
} from './supabase-tareas'

beforeEach(() => {
  vi.clearAllMocks()
  const builder = {
    select: mocks.select,
    eq: mocks.eq,
    is: mocks.is,
    order: mocks.order,
    limit: mocks.limit,
    range: mocks.range,
    // oxlint-disable-next-line unicorn/no-thenable -- Supabase query builders are thenable.
    then: (resolve: (value: unknown) => void) => resolve({ count: 12, error: null }),
  }
  mocks.from.mockReturnValue(builder)
  mocks.select.mockReturnValue(builder)
  mocks.eq.mockReturnValue(builder)
  mocks.is.mockReturnValue(builder)
  mocks.order.mockReturnValue(builder)
  mocks.limit.mockResolvedValue({ data: [], error: null })
  mocks.range.mockImplementation(async (start: number) => ({
    data: start === 0 ? Array.from({ length: 30 }, (_, id) => ({ id })) : [{ id: 30 }],
    error: null,
  }))
  const channel = { on: () => channel, subscribe: () => channel }
  mocks.channel.mockReturnValue(channel)
})
afterEach(cleanup)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

it('consulta solo cinco recientes y cuenta todos los avisos sin leer del usuario', async () => {
  const { result } = renderHook(
    () => ({
      recent: useNotificacionesTareas('user-1'),
      unread: useNotificacionesSinLeer('user-1'),
    }),
    { wrapper },
  )
  await waitFor(() => expect(result.current.unread.data).toBe(12))
  await waitFor(() => expect(result.current.recent.isSuccess).toBe(true))
  expect(mocks.limit).toHaveBeenCalledWith(5)
  expect(mocks.select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  expect(mocks.eq).toHaveBeenCalledWith('recipient_id', 'user-1')
  expect(mocks.is).toHaveBeenCalledWith('read_at', null)
})

it('pagina y filtra el historial en el servidor', async () => {
  const { result } = renderHook(() => useHistorialNotificaciones('user-1', true), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mocks.eq).toHaveBeenCalledWith('recipient_id', 'user-1')
  expect(mocks.is).toHaveBeenCalledWith('read_at', null)
  expect(mocks.order).toHaveBeenCalledWith('created_at', { ascending: false })
  expect(mocks.order).toHaveBeenCalledWith('id', { ascending: false })
  expect(mocks.range).toHaveBeenCalledWith(0, 29)
  expect(result.current.data?.pages.flat()).toHaveLength(30)
  await act(async () => {
    await result.current.fetchNextPage()
  })
  expect(mocks.range).toHaveBeenCalledWith(30, 59)
  await waitFor(() => expect(result.current.data?.pages.flat()).toHaveLength(31))
  expect(result.current.hasNextPage).toBe(false)
})
