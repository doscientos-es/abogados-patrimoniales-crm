import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type ComponentProps, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ functions: { invoke: mocks.invoke }, rpc: mocks.rpc }),
}))

import { TeamAccess } from './team-access'

function renderTeamAccess(members: ComponentProps<typeof TeamAccess>['members'] = []) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(
    <TeamAccess actorRole="owner" firmId="firm-1" members={members} onChanged={vi.fn()} />,
    {
      wrapper,
    },
  )
}

describe('TeamAccess', () => {
  it('sends a passwordless invitation email', async () => {
    mocks.invoke.mockResolvedValue({ error: null })
    renderTeamAccess()

    fireEvent.click(screen.getByRole('button', { name: 'Invitar a un nuevo miembro' }))
    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'María García' },
    })
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

  it('warns about assignments and removes a disabled member', async () => {
    mocks.rpc.mockImplementation((functionName: string) => {
      if (functionName === 'crm_get_firm_member_assignment_count')
        return Promise.resolve({ data: 2, error: null })
      return Promise.resolve({ data: 2, error: null })
    })
    const onChanged = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    render(
      <TeamAccess
        actorRole="owner"
        firmId="firm-1"
        members={[
          { userId: 'user-2', role: 'lawyer', status: 'disabled', displayName: 'María García' },
        ]}
        onChanged={onChanged}
      />,
      { wrapper },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    await screen.findByText(/tiene 2 registros asignados/i)
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar acceso' }))

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith('crm_delete_firm_member', {
        target_firm_id: 'firm-1',
        target_user_id: 'user-2',
      }),
    )
    expect(onChanged).toHaveBeenCalledOnce()
  })
})
