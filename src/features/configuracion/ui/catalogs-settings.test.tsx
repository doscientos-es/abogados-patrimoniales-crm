import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

type Mode = 'error' | 'success'
type Response = { data: unknown[]; error: Error | null }
type Chain = {
  select: () => Chain
  eq: () => Chain | Promise<Response>
  is: () => Chain
  order: () => Chain | Promise<Response>
  insert: () => Promise<Response>
  update: () => Chain
  rpc: () => Promise<Response>
}

const mocks = vi.hoisted(() => ({
  mode: 'success' as Mode,
  releaseUpdate: null as (() => void) | null,
  updateCalls: 0,
  updatePending: false,
}))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    from: (table: string) => {
      let operation: 'query' | 'update' = 'query'
      let orderCalls = 0
      let filterCalls = 0
      const response: Response = {
        data:
          mocks.mode === 'error'
            ? []
            : table === 'crm_task_labels'
              ? [{ id: 'label-1', name: 'Urgente', color: 'red', archived: false }]
              : [],
        error: mocks.mode === 'error' ? new Error('offline') : null,
      }
      const mutationResponse = () => {
        if (operation === 'update' && mocks.updatePending) {
          return new Promise<Response>((resolve) => {
            mocks.releaseUpdate = () => resolve({ data: [], error: null })
          })
        }
        return Promise.resolve({ data: [], error: null })
      }
      const builder = {} as Chain
      Object.assign(builder, {
        select: () => builder,
        eq: () => {
          if (operation === 'update') {
            filterCalls += 1
            return filterCalls === 2 ? mutationResponse() : builder
          }
          return builder
        },
        is: () => builder,
        order: () => {
          orderCalls += 1
          return table === 'crm_task_labels' || orderCalls === 2
            ? Promise.resolve(response)
            : builder
        },
        update: () => {
          operation = 'update'
          mocks.updateCalls += 1
          filterCalls = 0
          return builder
        },
        insert: () => Promise.resolve({ data: [], error: null }),
        rpc: () => Promise.resolve({ data: [], error: null }),
      })
      return builder
    },
  }),
}))

import { CatalogsSettings } from './catalogs-settings'

function renderCatalogs() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<CatalogsSettings firmId="firm-1" />, { wrapper })
}

afterEach(() => {
  mocks.mode = 'success'
  mocks.releaseUpdate = null
  mocks.updateCalls = 0
  mocks.updatePending = false
})

describe('CatalogsSettings', () => {
  it('shows a recoverable error instead of an empty catalog when loading fails', async () => {
    mocks.mode = 'error'
    renderCatalogs()

    expect(await screen.findByText('No se han podido cargar los catálogos.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByText('Aún no hay elementos.')).toBeNull()
  })

  it('blocks repeated archive actions while the first mutation is pending', async () => {
    mocks.updatePending = true
    renderCatalogs()

    const archive = await screen.findByRole('button', { name: 'Archivar Urgente' })
    fireEvent.click(archive)
    await waitFor(() => expect((archive as HTMLButtonElement).disabled).toBe(true))
    fireEvent.click(archive)

    expect(mocks.updateCalls).toBe(1)
    mocks.releaseUpdate?.()
  })
})
