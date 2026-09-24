import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openTask: vi.fn().mockResolvedValue(undefined),
  changeStatus: vi.fn().mockResolvedValue(undefined),
  cancelTask: vi.fn().mockResolvedValue(undefined),
  rejectTask: vi.fn().mockResolvedValue(undefined),
  updateMeeting: vi.fn().mockResolvedValue(undefined),
  updateSpecialMeeting: vi.fn().mockResolvedValue(undefined),
  meetingDetails: {} as Record<string, unknown>,
  role: 'paralegal',
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params: _params,
    children,
    ...props
  }: {
    to: string
    params?: unknown
    children?: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1', role: mocks.role }, isPending: false }),
}))
vi.mock('@/features/crm', () => ({
  useMiembrosDespacho: () => ({
    data: [
      { id: 'user-1', nombre: 'Ana Responsable' },
      { id: 'user-2', nombre: 'Luis Encargante' },
    ],
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/features/expedientes', () => ({
  useExpedientesPersistentes: () => ({
    data: [{ id: 'case-1', referencia: 'EXP-001', titulo: 'Sucesión' }],
    isPending: false,
    isError: false,
  }),
  useParticipantesPersistentes: () => ({
    data: [{ id: 'participant-1', contactoId: 'contact-1', nombre: 'María Cliente' }],
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({
    data: [
      {
        id: 'task-1',
        expedienteId: 'case-1',
        oportunidadId: null,
        tipo: 'Evento',
        titulo: 'Preparar borrador',
        descripcion: 'Revisar la documentación.',
        estado: 'Pendiente',
        prioridad: 'Alta',
        venceEn: '2026-09-20T09:00:00Z',
        recordarEn: '2026-09-19T09:00:00Z',
        asignadoId: 'user-1',
        creadaPorId: 'user-2',
        esSiguienteAccion: true,
        motivoEspera: null,
        revisarEn: null,
        detalleEspera: '',
        resultadoCierre: '',
        motivoCancelacion: '',
        abiertaEn: null,
        abiertaPorId: null,
        motivoRechazo: '',
        rechazadaEn: null,
        tareaPadreId: null,
        reunion: mocks.meetingDetails,
        bloqueada: false,
        etiquetas: [{ id: 'label-1', nombre: 'Urgente', color: '#f00' }],
        version: 1,
      },
    ],
    isPending: false,
    isError: false,
  }),
  useMensajesTarea: () => ({
    data: [
      {
        id: 'message-1',
        body: 'Asignada para revisar.',
        author_id: 'user-2',
        created_at: '2026-09-18T09:00:00Z',
      },
    ],
  }),
  useEvidenciasTarea: () => ({ data: [] }),
  useEventosTarea: () => ({ data: [] }),
  useDependenciasTarea: () => ({ data: [] }),
  useDocumentosTarea: () => ({ data: [] }),
  useDocumentosExpedienteTarea: () => ({ data: [] }),
  useAbrirTarea: () => ({ mutateAsync: mocks.openTask }),
  useCambiarEstadoTarea: () => ({ mutateAsync: mocks.changeStatus, isPending: false }),
  useCancelarTarea: () => ({ mutateAsync: mocks.cancelTask, isPending: false }),
  useRechazarTarea: () => ({ mutateAsync: mocks.rejectTask, isPending: false }),
  useActualizarReunionTarea: () => ({ mutateAsync: mocks.updateMeeting, isPending: false }),
  useActualizarReunionEspecial: () => ({
    mutateAsync: mocks.updateSpecialMeeting,
    isPending: false,
  }),
  usePonerTareaEnEspera: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCompletarTarea: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMarcarSiguienteAccion: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAnadirMensajeTarea: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAnadirEvidenciaTarea: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCrearDependenciaTarea: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEliminarDependenciaTarea: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVincularDocumentoTarea: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDesvincularDocumentoTarea: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import { TaskDetail } from './task-detail'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.meetingDetails = {}
  mocks.role = 'paralegal'
})

describe('TaskDetail', () => {
  it('shows task traceability and lets the responsible user work without managing protected fields', async () => {
    render(<TaskDetail taskId="task-1" />)

    expect(screen.getAllByText('Ana Responsable')).not.toHaveLength(0)
    expect(screen.getAllByText('Luis Encargante')).not.toHaveLength(0)
    expect(screen.getByText('Urgente')).toBeTruthy()
    expect(screen.getByText('Asignada para revisar.')).toBeTruthy()
    expect(screen.getByText('Siguiente acción:')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Quitar siguiente acción' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancelar' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))
    await expect.poll(() => mocks.changeStatus.mock.calls.length).toBe(1)
    expect(mocks.changeStatus).toHaveBeenCalledWith(expect.objectContaining({ estado: 'En curso' }))

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    fireEvent.change(screen.getByLabelText('Motivo del rechazo'), {
      target: { value: 'Falta documentación' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await expect.poll(() => mocks.rejectTask.mock.calls.length).toBe(1)
    expect(mocks.rejectTask).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'Falta documentación' }),
    )
  })

  it('preselects case contacts and saves enriched meeting details for a manager', async () => {
    mocks.role = 'owner'
    render(<TaskDetail taskId="task-1" />)

    expect(screen.getByText('Datos de la reunión')).toBeTruthy()
    expect(
      (screen.getByRole('option', { name: 'María Cliente' }) as HTMLOptionElement).selected,
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-09-20T09:00' } })
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2026-09-20T10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar reunión' }))

    await expect.poll(() => mocks.updateMeeting.mock.calls.length).toBe(1)
    expect(mocks.updateMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          attendeeContactIds: ['contact-1'],
          mode: 'office_bilbao',
        }),
      }),
    )
  })

  it.each([
    ['preparation', 'Agendar reunión', 'scheduled', 'owner'],
    ['scheduled', 'Comenzar reunión', 'in_progress', 'paralegal'],
    ['in_progress', 'Finalizar reunión', 'finished', 'paralegal'],
  ])('transitions a special meeting from %s to %s', async (status, button, nextStatus, role) => {
    mocks.role = role
    mocks.meetingDetails = {
      specialType: 'meeting',
      status,
      startsAt: '2026-09-20T09:00:00.000Z',
      endsAt: '2026-09-20T10:00:00.000Z',
      mode: 'office_bilbao',
      location: 'Sala Bilbao',
      preferredLocation: 'Sala Bilbao',
      meetingUrl: '',
      preparation: 'Revisar documentación',
      internalInstructions: 'Llevar escritura',
      meetingType: 'Seguimiento',
      subject: 'Estado del expediente',
      attendeeContactIds: ['contact-1'],
      attendeeUserIds: ['user-2'],
      attendeeNames: ['Asistente externo'],
      durationMinutes: 60,
      preferredDate: '2026-09-20',
      preferredTimeSlot: 'Mañana',
      summary: 'Resumen guardado',
      decisions: 'Decisiones guardadas',
      outcome: 'Resultado guardado',
      transcription: 'Transcripción guardada',
    }
    render(<TaskDetail taskId="task-1" />)

    fireEvent.click(screen.getByRole('button', { name: button }))

    await expect.poll(() => mocks.updateSpecialMeeting.mock.calls.length).toBe(1)
    expect(mocks.updateSpecialMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          status: nextStatus,
          startsAt: '2026-09-20T09:00:00.000Z',
          endsAt: '2026-09-20T10:00:00.000Z',
          location: 'Sala Bilbao',
          attendeeContactIds: ['contact-1'],
          attendeeUserIds: ['user-2'],
          attendeeNames: ['Asistente externo'],
          summary: 'Resumen guardado',
          decisions: 'Decisiones guardadas',
          outcome: 'Resultado guardado',
          transcription: 'Transcripción guardada',
        }),
      }),
    )
  })
})
