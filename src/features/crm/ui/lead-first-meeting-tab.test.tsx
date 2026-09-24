import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  appointments: [] as Array<Record<string, unknown>>,
  create: vi.fn().mockResolvedValue({ id: 'new-event' }),
  edit: vi.fn(),
  updateMeeting: vi.fn().mockImplementation(async ({ task, details }) => ({
    ...task,
    reunion: details,
    version: task.version + 1,
  })),
  complete: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({ data: mocks.appointments, isPending: false, isError: false }),
  useCrearTarea: () => ({ mutateAsync: mocks.create, isPending: false }),
  useEditarTarea: () => ({ mutateAsync: mocks.edit, isPending: false }),
  useActualizarReunionTarea: () => ({ mutateAsync: mocks.updateMeeting, isPending: false }),
  useCompletarTarea: () => ({ mutateAsync: mocks.complete, isPending: false }),
}))

import { LeadFirstMeetingTab } from './lead-first-meeting-tab'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.appointments = []
})

const opportunity = {
  id: 'lead-1',
  referencia: 'OP-001',
  contactoId: 'contact-1',
  titulo: 'Consulta patrimonial',
  asignadoId: 'user-1',
  archivadoEn: null,
} as never

const scheduledTask = () =>
  ({
    id: 'event-1',
    expedienteId: null,
    oportunidadId: 'lead-1',
    tipo: 'Evento',
    titulo: 'Primera cita · Consulta patrimonial',
    descripcion: '',
    estado: 'Pendiente',
    prioridad: 'Media',
    venceEn: '2026-10-20T09:00:00.000Z',
    recordarEn: null,
    asignadoId: 'user-1',
    creadaPorId: 'user-1',
    esSiguienteAccion: false,
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
    reunion: {
      startsAt: '2026-10-20T09:00:00.000Z',
      endsAt: '2026-10-20T10:00:00.000Z',
      mode: 'office_bilbao',
      primeraCita: {
        estado: 'Programada',
        duracion: '60 minutos',
        asistentesAdicionales: '',
        resumen: '',
        documentacionAportada: '',
        resultado: '',
        observaciones: '',
        autorizadaPresupuesto: false,
        tipoServicioPreliminar: '',
      },
    },
    bloqueada: false,
    etiquetas: [],
    version: 1,
  }) as Record<string, unknown>

function renderTab() {
  return render(
    <LeadFirstMeetingTab
      opportunity={opportunity}
      firmId="firm-1"
      members={[{ id: 'user-1', nombre: 'Ana Responsable' }]}
      contactId="contact-1"
      contactName="María Cliente"
      currentUserId="user-1"
      memberRole="paralegal"
      canEdit
    />,
  )
}

describe('LeadFirstMeetingTab', () => {
  it('creates a persistent appointment event with its meeting details and calendar date', async () => {
    renderTab()
    fireEvent.change(screen.getByLabelText('Inicio'), {
      target: { value: '2026-10-20T09:00' },
    })
    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-10-20T10:00' },
    })
    fireEvent.change(screen.getByLabelText('Notas previas y preparación'), {
      target: { value: 'Revisar los antecedentes.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar programación' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    const created = mocks.create.mock.calls[0]?.[0]
    expect(created).toMatchObject({
      tipo: 'Evento',
      oportunidadId: 'lead-1',
      titulo: 'Primera cita · Consulta patrimonial',
      detallesReunion: {
        mode: 'office_bilbao',
        preparation: 'Revisar los antecedentes.',
        primeraCita: { estado: 'Programada' },
      },
    })
    expect(Date.parse(created.detallesReunion.startsAt)).toBe(Date.parse(created.venceEn))
  })

  it('records the meeting outcome and completes the scheduled event', async () => {
    mocks.appointments = [scheduledTask()]
    renderTab()
    fireEvent.change(screen.getByLabelText('Resultado'), {
      target: { value: 'Solicitar presupuesto' },
    })
    fireEvent.change(screen.getByLabelText('Resumen de la cita'), {
      target: { value: 'Se revisó el asunto con el contacto.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))

    await waitFor(() => expect(mocks.updateMeeting).toHaveBeenCalledOnce())
    expect(mocks.updateMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          primeraCita: expect.objectContaining({
            estado: 'Celebrada',
            resultado: 'Solicitar presupuesto',
            resumen: 'Se revisó el asunto con el contacto.',
          }),
        }),
      }),
    )
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledOnce())
    expect(mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: 'Solicitar presupuesto · Se revisó el asunto con el contacto.' }),
    )
  })
})