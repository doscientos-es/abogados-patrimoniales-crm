import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({
    status: 'signed-in',
    user: { id: 'me', email: null, displayName: null },
  }),
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

  it('crea una solicitud de reunión sin fecha confirmada y vinculada al expediente elegido', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    renderDialog(
      <TaskCreateDialog
        cases={[{ id: 'case-1', referencia: 'EXP-1', titulo: 'Consulta' }]}
        members={members}
        defaultAssigneeId="other"
        defaultKind="Plazo"
        defaultDueDate="2026-12-01"
        pending={false}
        onCreate={onCreate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    fireEvent.change(screen.getByLabelText('Expediente *'), { target: { value: 'case-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tareas preestablecidas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reunión' }))
    fireEvent.change(screen.getByLabelText('Objeto de la reunión *'), {
      target: { value: 'Seguimiento' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir compañero' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Mi nombre' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear reunión' }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          expedienteId: 'case-1',
          tipo: 'Evento',
          asignadoId: 'other',
          venceEn: null,
          clasePlazo: null,
          detallesReunion: expect.objectContaining({
            specialType: 'meeting',
            status: 'preparation',
            startsAt: '',
            attendeeUserIds: ['me'],
          }),
        }),
      ),
    )
  })

  it('identifica al abogado elegido por su identificador aunque haya nombres iguales', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    renderDialog(
      <TaskCreateDialog
        oportunidadId="lead-1"
        contextLabel="OP-1"
        members={[
          { id: 'a', nombre: 'Ana' },
          { id: 'b', nombre: 'Ana' },
        ]}
        pending={false}
        onCreate={onCreate}
        meetingPreset={{
          meetingType: 'Primera cita',
          subject: 'Consulta',
          contactIds: ['contact-1'],
          contactLabel: 'María',
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    const dialog = screen.getByRole('dialog', { name: 'Programar primera cita' })
    expect(dialog.className).toContain('first-meeting-dialog')
    expect(screen.getByText('OP-1 · María')).toBeTruthy()
    expect(screen.queryByText(/Sólo el título es obligatorio/)).toBeNull()
    const [, lawyer] = screen.getAllByRole('radio', { name: 'Ana' })
    if (!lawyer) throw new Error('No aparece el segundo abogado con el mismo nombre.')
    fireEvent.click(lawyer)
    fireEvent.change(screen.getByLabelText('Fecha de la cita *'), {
      target: { value: '2026-12-02' },
    })
    fireEvent.change(screen.getByLabelText('Hora *'), { target: { value: '10:30' } })
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Modalidad / lugar'), { target: { value: 'phone' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear primera cita' }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          asignadoId: 'b',
          detallesReunion: expect.objectContaining({
            abogadoPrimeraCita: 'Ana',
            abogadoPrimeraCitaId: 'b',
            durationMinutes: 45,
            mode: 'phone',
          }),
        }),
      ),
    )
  })

  it('explica y bloquea la creación de la primera cita si no hay miembros disponibles', () => {
    renderDialog(
      <TaskCreateDialog
        oportunidadId="lead-1"
        members={[]}
        pending={false}
        onCreate={vi.fn()}
        meetingPreset={{ meetingType: 'Primera cita', subject: 'Consulta', contactIds: [] }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    expect(screen.getByText('No hay miembros disponibles para atender la cita.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Crear primera cita' })).toHaveProperty(
      'disabled',
      true,
    )
  })
})
