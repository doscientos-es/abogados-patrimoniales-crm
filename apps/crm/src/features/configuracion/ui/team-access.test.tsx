import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { type ComponentProps, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ functions: { invoke: mocks.invoke }, rpc: mocks.rpc }),
}))

import { TeamAccess } from './team-access'

function renderTeamAccess(
  members: ComponentProps<typeof TeamAccess>['members'] = [],
  actorRole: ComponentProps<typeof TeamAccess>['actorRole'] = 'owner',
) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(
    <TeamAccess
      actorRole={actorRole}
      actorUserId="actor-1"
      firmId="firm-1"
      members={members}
      onChanged={vi.fn()}
    />,
    {
      wrapper,
    },
  )
}

describe('TeamAccess', () => {
  it('offers only abogado and administrativo while preserving existing administrative access', () => {
    renderTeamAccess([
      { userId: 'user-2', role: 'paralegal', status: 'active', displayName: 'María' },
      { userId: 'user-3', role: 'admin', status: 'active', displayName: 'Carlos' },
    ])
    const existing = screen.getByRole('combobox', { name: 'Rol de María' }) as HTMLSelectElement
    expect(existing.value).toBe('paralegal')
    expect(within(existing).getByRole('option', { name: 'Administrativo' })).toBeTruthy()
    expect(
      (screen.getByRole('combobox', { name: 'Rol de Carlos' }) as HTMLSelectElement).value,
    ).toBe('admin')

    fireEvent.click(screen.getByRole('button', { name: 'Invitar a un nuevo miembro' }))
    const role = screen.getByRole('combobox', { name: 'Rol' })
    expect(
      within(role)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Abogado', 'Administrativo'])
  })

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
    mocks.invoke.mockResolvedValue({ data: { releasedAssignments: 2 }, error: null })
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
        actorUserId="actor-1"
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
    const dialog = screen.getByRole('alertdialog', { name: 'Eliminar usuario definitivamente' })
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(dialog.className).toContain('overflow-y-auto')
    expect(
      screen
        .getByRole('button', { name: 'Eliminar usuario' })
        .closest('[data-slot="alert-dialog-footer"]')?.className,
    ).toContain('sticky')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar usuario' }))

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('delete-disabled-firm-member', {
        body: { firmId: 'firm-1', userId: 'user-2' },
      }),
    )
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('lets an administrator remove another administrator but not an owner or themselves', async () => {
    mocks.rpc.mockResolvedValue({ data: 0, error: null })
    mocks.invoke.mockResolvedValue({ data: { releasedAssignments: 0 }, error: null })
    renderTeamAccess(
      [
        { userId: 'actor-1', role: 'admin', status: 'active', displayName: 'Yo' },
        { userId: 'owner-1', role: 'owner', status: 'disabled', displayName: 'Propietario' },
        { userId: 'admin-2', role: 'admin', status: 'disabled', displayName: 'Otro admin' },
      ],
      'admin',
    )
    expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(1)
    expect(screen.queryByRole('combobox', { name: 'Rol de Yo' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await screen.findByRole('alertdialog', { name: 'Eliminar usuario definitivamente' })
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar usuario' }))
    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('delete-disabled-firm-member', {
        body: { firmId: 'firm-1', userId: 'admin-2' },
      }),
    )
  })
})
