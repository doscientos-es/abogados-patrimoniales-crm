import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ functions: { invoke: mocks.invoke } }),
}))

import { TeamAccess } from './team-access'

function renderTeamAccess() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(
    <TeamAccess actorRole="owner" firmId="firm-1" members={[]} onChanged={vi.fn()} />,
    { wrapper },
  )
}

describe('TeamAccess', () => {
  it('sends a passwordless invitation email', async () => {
    mocks.invoke.mockResolvedValue({ error: null })
    renderTeamAccess()

    fireEvent.click(screen.getByRole('button', { name: 'Invitar a un nuevo miembro' }))
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'María García' } })
    fireEvent.change(screen.getByLabelText('Correo profesional'), {
      target: { value: 'maria@despacho.es' },
    })

    expect(screen.queryByLabelText('Contraseña')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('invite-firm-member', {
        body: {
          email: 'maria@despacho.es',
          firmId: 'firm-1',
          name: 'María García',
          role: 'lawyer',
        },
      }),
    )
  })
})