import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ rpc: mocks.rpc }),
}))

import { useEmitirFactura, useRectificarFactura } from './supabase-facturas'

const message =
  'Completa la razón social, el NIF, el domicilio y la colegiación del despacho en Configuración antes de emitir.'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('emisión y rectificación', () => {
  it('muestra el motivo concreto cuando el servidor rechaza el emisor incompleto', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'P0001', message } })
    const { result } = renderHook(
      () => ({ emitir: useEmitirFactura('firm'), rectificar: useRectificarFactura('firm') }),
      { wrapper },
    )
    await expect(
      result.current.emitir.mutateAsync({
        facturaId: 'invoice',
        versionEsperada: 1,
        emision: '2026-01-01',
        vencimiento: null,
      }),
    ).rejects.toThrow(message)
    await expect(
      result.current.rectificar.mutateAsync({
        facturaId: 'invoice',
        versionEsperada: 1,
        motivo: 'Corrección',
      }),
    ).rejects.toThrow(message)
  })
})
