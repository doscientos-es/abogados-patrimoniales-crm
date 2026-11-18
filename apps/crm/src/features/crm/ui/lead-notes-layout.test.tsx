import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  notes: [
    {
      id: '1',
      ambito: 'persona',
      titulo: 'Primera',
      contenido: 'Nota uno',
      autor: 'Ana',
      creada: 'Hoy',
    },
    {
      id: '2',
      ambito: 'oportunidad',
      titulo: 'Segunda',
      contenido: 'Nota dos',
      autor: 'Ana',
      creada: 'Hoy',
    },
  ],
  query: { data: [], isPending: false, isError: false },
  mutation: { isPending: false, mutateAsync: vi.fn() },
}))

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<object>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' } }),
}))
vi.mock('@/features/crm', async (original) => ({
  ...(await original<object>()),
  useEventosOportunidad: () => mocks.query,
  useMiembrosDespacho: () => mocks.query,
  useOportunidadesCompletas: () => mocks.query,
  useActualizarDetallesOportunidad: () => mocks.mutation,
  useRegistrarComunicacionOportunidad: () => mocks.mutation,
}))
vi.mock('@/features/notas', async (original) => ({
  ...(await original<object>()),
  useNotasRemotas: () => ({ ...mocks.query, data: mocks.notes }),
  useCrearNotaOportunidad: () => mocks.mutation,
  notesForContact: (notes: unknown[]) => notes,
  notaDesdeRemota: (note: unknown) => note,
}))
vi.mock('@/features/onboarding', () => ({
  useOnboardings: () => mocks.query,
  useCrearOnboarding: () => mocks.mutation,
}))
vi.mock('@/features/tareas', async (original) => ({
  ...(await original<object>()),
  useTareasLead: () => mocks.query,
  useCrearTarea: () => mocks.mutation,
  useCompletarTarea: () => mocks.mutation,
}))
vi.mock('@/shared/infrastructure/supabase', async (original) => ({
  ...(await original<object>()),
  getSupabaseBrowserClient: () => null,
}))

import { LeadWorkspace } from './lead-workspace'

afterEach(cleanup)

describe('notas internas del lead', () => {
  it('usa todo el ancho para los post-its y mantiene las acciones disponibles', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <LeadWorkspace
          firmId="firm-1"
          section="notes"
          opportunity={{ id: 'lead-1', contactoId: 'contact-1', detalles: {} } as never}
        />
      </QueryClientProvider>,
    )

    const section = screen.getByRole('region', { name: 'Notas internas' })
    expect(section.className).toContain('lg:col-span-2')
    expect(section.querySelector('[data-slot="card"]')).toBeNull()
    const notes = within(section).getAllByRole('article')
    expect(notes).toHaveLength(2)
    expect(notes[0]?.parentElement?.className).toContain('xl:grid-cols-4')
    expect(within(section).getByRole('link', { name: 'Gestionar y editar notas' })).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: 'Crear nota interna' }))
    expect(screen.getByRole('dialog', { name: 'Nueva nota interna' })).toBeTruthy()
  })
})
