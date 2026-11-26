import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render as renderUI,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  notes: [] as Array<Record<string, unknown>>,
  save: vi.fn(),
  archive: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  error: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'lawyer-1' } }),
}))
vi.mock('@/features/contactos', () => ({
  CONTACT_DOCUMENT_CATEGORIES: [],
  uploadContactDocument: vi.fn(),
}))
vi.mock('@/features/crm', () => ({
  useMiembrosDespacho: () => ({
    data: [
      { id: 'secretary-1', nombre: 'Sara', rol: 'paralegal' },
      { id: 'lawyer-1', nombre: 'Ana', rol: 'lawyer' },
      { id: 'admin-1', nombre: 'Luis', rol: 'admin' },
    ],
  }),
}))
vi.mock('@/features/notas', () => ({
  useNotasRemotas: () => ({ data: mocks.notes, isPending: false, isError: false }),
  useGuardarNota: () => ({ mutateAsync: mocks.save }),
  useActualizarEstadoNota: () => ({ mutateAsync: mocks.archive }),
}))
vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({ data: [] }),
  useCrearTarea: () => ({ isPending: false, mutateAsync: mocks.create }),
  useEtiquetasTarea: () => ({ data: [] }),
  useMarcarSiguienteAccion: () => ({ isPending: false }),
  useActualizarReunionEspecial: () => ({ mutateAsync: mocks.update }),
}))

import { FirstMeetingClosingDialog } from './first-meeting-closing-dialog'

const render = (element: ReactElement) =>
  renderUI(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>)

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
  mocks.create.mockResolvedValue(undefined)
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

  it('cierra una cita de expediente con el responsable administrativo seleccionado', async () => {
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
        derivedTaskTitles: [],
      }),
    })
  })

  it.each([
    ['lead', task, { expedienteId: null, oportunidadId: 'lead-1' }],
    [
      'expediente',
      { ...task, expedienteId: 'case-1', lineaId: 'line-1' },
      {
        expedienteId: 'case-1',
        oportunidadId: null,
        lineaId: 'line-1',
      },
    ],
  ])(
    'crea inmediatamente una tarea vinculada a la cita y al %s',
    async (_label, meeting, context) => {
      const onClose = vi.fn()
      render(
        <FirstMeetingClosingDialog
          firmId="firm-1"
          task={meeting}
          reference="REF-1"
          onClose={onClose}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
      const dialog = screen.getByRole('dialog', { name: 'Nueva tarea' })
      expect(within(dialog).getByText(/REF-1/)).toBeTruthy()
      fireEvent.change(within(dialog).getByLabelText('Título *'), {
        target: { value: 'Revisar escritura' },
      })
      fireEvent.change(within(dialog).getByLabelText('Asignada a'), {
        target: { value: 'secretary-1' },
      })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Crear tarea' }))
      await waitFor(() =>
        expect(mocks.create).toHaveBeenCalledWith(
          expect.objectContaining({
            ...context,
            tareaPadreId: 'meeting-1',
            titulo: 'Revisar escritura',
            asignadoId: 'secretary-1',
          }),
        ),
      )
      expect(mocks.update).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    },
  )

  it('solo ofrece administrativos y no preselecciona un abogado o administrador de sistema', async () => {
    render(
      <FirstMeetingClosingDialog
        firmId="firm-1"
        task={{ ...task, asignadoId: 'admin-1' }}
        reference="LEAD-1"
        onClose={vi.fn()}
      />,
    )
    const assignee = screen.getByLabelText('Responsable administrativo') as HTMLSelectElement
    expect(Array.from(assignee.options, (option) => option.value)).toEqual(['', 'secretary-1'])
    expect(assignee.value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar cita' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ followUpAssigneeId: '' }),
        }),
      ),
    )
  })

  it('preselecciona al administrativo que organizó la cita y permite no asignarlo', async () => {
    render(
      <FirstMeetingClosingDialog
        firmId="firm-1"
        task={{ ...task, asignadoId: 'secretary-1' }}
        reference="LEAD-1"
        onClose={vi.fn()}
      />,
    )
    const assignee = screen.getByLabelText('Responsable administrativo') as HTMLSelectElement
    expect(assignee.value).toBe('secretary-1')
    fireEvent.change(assignee, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar cita' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ followUpAssigneeId: '' }),
        }),
      ),
    )
  })
})
