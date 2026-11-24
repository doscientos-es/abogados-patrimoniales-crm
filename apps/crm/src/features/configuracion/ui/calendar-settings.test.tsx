import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ functions: { invoke: mocks.invoke } }),
}))

import { CalendarSettings } from './calendar-settings'

afterEach(() => {
  cleanup()
  mocks.invoke.mockReset()
})

function show(role: 'owner' | 'lawyer' = 'owner') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CalendarSettings firmId="firm-1" actorRole={role} />
    </QueryClientProvider>,
  )
}

it('verifies without activation, then explicitly activates and shows queue status', async () => {
  mocks.invoke
    .mockResolvedValueOnce({ data: { code: 'ok', enabled: false, pending: 2, failed: 0 } })
    .mockResolvedValueOnce({ data: { code: 'ok', enabled: true, pending: 2, failed: 1 } })
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Probar conexión' }))
  await screen.findByText(/Sincronización no activada/)
  expect(mocks.invoke).toHaveBeenCalledWith('google-calendar-connection', {
    body: { firmId: 'firm-1', action: 'verify' },
  })
  expect(screen.getByText(/citas futuras ya confirmadas/)).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Activar sincronización' }))
  await screen.findByText(/Sincronización activa/)
  expect(screen.getByText(/Pendientes: 2. Con error: 1/)).not.toBeNull()
  expect(mocks.invoke).toHaveBeenLastCalledWith('google-calendar-connection', {
    body: { firmId: 'firm-1', action: 'activate' },
  })
})

it('shows a useful error and never offers activation after a failed check', async () => {
  mocks.invoke.mockResolvedValue({ data: { code: 'authorization' } })
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Probar conexión' }))
  await screen.findByText(/Google ha rechazado la autorización/)
  expect(screen.queryByRole('button', { name: 'Activar sincronización' })).toBeNull()
})

it('does not offer checks to non-administrators', async () => {
  show('lawyer')
  expect(screen.queryByRole('button', { name: 'Probar conexión' })).toBeNull()
  await waitFor(() => expect(mocks.invoke).not.toHaveBeenCalled())
})
