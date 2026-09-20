import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  communications: [
    {
      id: 'event-1',
      leadId: 'lead-1',
      leadReferencia: 'OP-2026-0008',
      leadTitulo: 'Herencia familiar',
      tipo: 'phone_call' as const,
      resumen: 'Consulta sobre la partición de la herencia.',
      creadoEn: '2026-09-15T10:00:00Z',
    },
  ],
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  createFileRoute: () => (options: object) => ({ ...options }),
  Link: ({ children, params: _params, search: _search, ...props }: LinkProps) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))

vi.mock('@/features/crm', () => ({
  useMiembrosDespacho: () => ({ data: [], isPending: false, isError: false }),
  useComunicacionesOportunidad: () => ({
    data: mocks.communications,
    isPending: false,
    isError: false,
  }),
}))

vi.mock('@/features/notas', () => ({
  useConfirmarLectura: () => ({ isPending: false, mutate: vi.fn() }),
  useCrearConversacion: () => ({ isPending: false, mutate: vi.fn() }),
  useNotasRemotas: () => ({ data: [], isPending: false, isError: false }),
}))

import { ComunicacionesPage } from './comunicaciones'

type LinkProps = {
  children: ReactNode
  params?: unknown
  search?: unknown
} & AnchorHTMLAttributes<HTMLAnchorElement>

describe('ComunicacionesPage', () => {
  it('muestra las últimas llamadas registradas en los Leads', () => {
    render(<ComunicacionesPage />)

    expect(screen.getByRole('heading', { name: 'Comunicaciones' })).toBeTruthy()
    expect(screen.getByText('Llamada · OP-2026-0008 · Herencia familiar')).toBeTruthy()
    expect(screen.getByText('Consulta sobre la partición de la herencia.')).toBeTruthy()
  })
})
