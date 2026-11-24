import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  notes: [] as Array<Record<string, unknown>>,
  save: vi.fn(),
  archive: vi.fn(),
  update: vi.fn(),
  error: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }))
vi.mock('@/components/tareas/task-create-dialog', () => ({ TaskCreateDialog: () => null }))
vi.mock('@/features/contactos', () => ({
  CONTACT_DOCUMENT_CATEGORIES: [],
  uploadContactDocument: vi.fn(),
}))
vi.mock('@/features/crm', () => ({
  useMiembrosDespacho: () => ({ data: [{ id: 'secretary-1', nombre: 'Sara' }] }),
}))
vi.mock('@/features/notas', () => ({
  useNotasRemotas: () => ({ data: mocks.notes, isPending: false, isError: false }),
  useGuardarNota: () => ({ mutateAsync: mocks.save }),
  useActualizarEstadoNota: () => ({ mutateAsync: mocks.archive }),
}))
vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({ data: [] }),
  useCrearTarea: () => ({ isPending: false }),
  useMarcarSiguienteAccion: () => ({ isPending: false }),
  useActualizarReunionEspecial: () => ({ mutateAsync: mocks.update }),
}))

import { FirstMeetingClosingDialog } from './first-meeting-closing-dialog'

const task = {
  id: 'meeting-1',
  oportunidadId: 'lead-1',
  estado: 'Pendiente',
  reunion: {
    status: 'in_progress',
    primeraCita: { estado: 'En curso' },
    attendeeContactIds: ['contact-1'],
  },
} as unknown as React.ComponentProps<typeof FirstMeetingClosingDialog>['task']

beforeEach(() => {
  mocks.notes = []
  mocks.save.mockResolvedValue(undefined)
  mocks.archive.mockResolvedValue(undefined)
  mocks.update.mockResolvedValue({ reunion: {} })
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('Cierre de cita', () => {
  it('conserva notas antiguas y guarda las nuevas como lista, incluido el texto pendiente', async () => {
    mocks.notes = [
      {
        id: 'note-1',
        status: 'active',
        content: 'Conclusión anterior',
        details: {
          taskId: 'meeting-1',
          cierrePrimeraCita: 'true',
          triggers: ['abrir-lead'],
          extra: 'conservar',
        },
        visibility: 'restricted',
        permittedUserIds: ['lawyer-1'],
      },
    ]
    const onClose = vi.fn()
    render(
      <FirstMeetingClosingDialog
        firmId="firm-1"
        task={task}
        reference="LEAD-1"
        onClose={onClose}
      />,
    )
    expect(screen.getByText('Conclusión anterior')).toBeTruthy()
    const input = screen.getByLabelText('Añadir notas finales')
    fireEvent.change(input, { target: { value: 'Primera conclusión' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('Primera conclusión')).toBeTruthy())
    fireEvent.change(input, { target: { value: 'Otra conclusión' } })
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar cita' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: 'note-1',
        content: 'Conclusión anterior\nPrimera conclusión\nOtra conclusión',
        visibility: 'restricted',
        permittedUserIds: ['lawyer-1'],
        triggers: ['abrir-lead'],
        extraDetails: {
          taskId: 'meeting-1',
          cierrePrimeraCita: 'true',
          triggers: ['abrir-lead'],
          extra: 'conservar',
          notasFinales: ['Conclusión anterior', 'Primera conclusión', 'Otra conclusión'],
        },
      }),
    )
  })

  it('archiva la nota anterior solo si se quitan explícitamente todos sus textos', async () => {
    mocks.notes = [
      {
        id: 'note-1',
        status: 'active',
        content: 'Anterior',
        details: { taskId: 'meeting-1', cierrePrimeraCita: 'true', notasFinales: ['Anterior'] },
      },
    ]
    render(
      <FirstMeetingClosingDialog
        firmId="firm-1"
        task={task}
        reference="LEAD-1"
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Quitar nota 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar cita' }))
    await waitFor(() =>
      expect(mocks.archive).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: 'note-1', status: 'archived' }),
      ),
    )
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('no finaliza ni pierde las notas si falla su guardado', async () => {
    mocks.save.mockRejectedValue(new Error('No se pudo guardar'))
    const onClose = vi.fn()
    render(
      <FirstMeetingClosingDialog
        firmId="firm-1"
        task={task}
        reference="LEAD-1"
        onClose={onClose}
      />,
    )
    fireEvent.change(screen.getByLabelText('Añadir notas finales'), {
      target: { value: 'Borrador pendiente' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar cita' }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('No se pudo guardar'))
    expect(mocks.update).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Añadir notas finales') as HTMLInputElement).value).toBe(
      'Borrador pendiente',
    )
  })

  it('closes a case appointment with its derived tasks and administrative assignee', async () => {
    const caseTask = {
      ...task,
      expedienteId: 'case-1',
      reunion: { status: 'in_progress', attendeeContactIds: ['contact-1'] },
    }
    render(
      <FirstMeetingClosingDialog
        firmId="firm-1"
        task={caseTask}
        reference="EXP-1"
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText(/archivo de transcripción/i)).toBeNull()
    fireEvent.change(screen.getByLabelText('Añadir notas finales'), {
      target: { value: 'Cliente conforme' },
    })
    fireEvent.change(screen.getByLabelText('Añadir tareas derivadas'), {
      target: { value: 'Revisar escritura' },
    })
    fireEvent.change(screen.getByLabelText('Responsable administrativo'), {
      target: { value: 'secretary-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar cita' }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce())
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'case',
        caseId: 'case-1',
        opportunityId: null,
        content: 'Cliente conforme',
      }),
    )
    expect(mocks.update).toHaveBeenCalledWith({
      task: caseTask,
      details: expect.objectContaining({
        status: 'finished',
        followUpAssigneeId: 'secretary-1',
        derivedTaskTitles: ['Revisar escritura'],
      }),
    })
  })
})
