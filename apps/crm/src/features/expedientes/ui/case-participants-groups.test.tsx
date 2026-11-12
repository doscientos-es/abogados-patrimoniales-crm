import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import type { ContactoPersistido } from '@/features/contactos'
import type { ParticipantePersistido } from '@/features/expedientes/application/case-types'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/contactos">{children}</a>,
}))
vi.mock('@/features/contactos', () => ({
  useCrearContacto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useContactPhoneCandidates: () => ({ data: [] }),
}))
vi.mock('@/features/expedientes', () => ({
  useParticipantRoles: () => ({
    data: ['Representante legal', 'Mediador'],
    isPending: false,
    isError: false,
  }),
}))

import { CaseParticipantsPanel } from './case-participants-groups'

afterEach(cleanup)

it('mantiene el árbol y guarda el rol elegido para un contacto interno', async () => {
  const update = vi.fn().mockResolvedValue(undefined)
  const contacts = [
    { id: 'c1', nombre: 'Empresa' },
    { id: 'c2', nombre: 'Ana' },
  ] as ContactoPersistido[]
  const participants: ParticipantePersistido[] = [
    {
      id: 'p1',
      expedienteId: 'e1',
      contactoId: 'c1',
      nombre: 'Empresa',
      rol: 'Cliente',
      tipo: 'Cliente',
      confidencialidad: 'Normal',
    },
    {
      id: 'p2',
      expedienteId: 'e1',
      contactoId: 'c2',
      nombre: 'Ana',
      rol: 'Representante legal',
      tipo: 'Representante legal',
      titularId: 'p1',
      detalles: { titularId: 'p1' },
      confidencialidad: 'Normal',
    },
  ]
  render(
    <CaseParticipantsPanel
      firmId="firm"
      expedienteId="e1"
      principalId="c1"
      clienteNombre="Empresa"
      participantes={participants}
      contactos={contacts}
      miembros={[]}
      currentUserId={null}
      pending={false}
      onCreateParticipant={vi.fn()}
      onUpdateParticipant={update}
      onRemoveParticipant={vi.fn()}
      onReorderParticipants={vi.fn()}
    />,
  )
  const children = screen.getByRole('list', { name: 'Contactos de Empresa' })
  expect(within(children).getByText('Representante legal')).toBeTruthy()
  fireEvent.click(within(children).getByRole('button', { name: 'Editar intervención' }))
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Mediador' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2', rol: 'Mediador', detallesActuales: { titularId: 'p1' } }),
    ),
  )
})
