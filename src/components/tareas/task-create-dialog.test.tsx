import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'me', email: null, displayName: null } }),
}))

import { TaskCreateDialog } from './task-create-dialog'

const members = [
  { id: 'other', nombre: 'Otra persona' },
  { id: 'me', nombre: 'Mi nombre' },
]

const renderDialog = (dialog: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{dialog}</QueryClientProvider>)

describe('TaskCreateDialog', () => {
  it('muestra primero la autoasignación y la envía al crear la tarea', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    renderDialog(
      <TaskCreateDialog
        oportunidadId="lead-1"
        members={members}
        pending={false}
        onCreate={onCreate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    const assignee = screen.getByLabelText('Asignada a') as HTMLSelectElement
    expect(Array.from(assignee.options, (option) => [option.value, option.text])).toEqual([
      ['me', 'Asignarme a mí mismo'],
      ['other', 'Otra persona'],
      ['', 'Sin asignar'],
    ])
    expect(assignee.value).toBe('me')

    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Mi tarea' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ asignadoId: 'me' })),
    )
  })

  it('respeta el responsable explícito y permite dejar la tarea sin asignar', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    renderDialog(
      <TaskCreateDialog
        oportunidadId="lead-1"
        defaultAssigneeId="other"
        members={members}
        pending={false}
        onCreate={onCreate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    const assignee = screen.getByLabelText('Asignada a') as HTMLSelectElement
    expect(assignee.value).toBe('other')
    fireEvent.change(assignee, { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Sin responsable' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ asignadoId: null })),
    )
  })
})