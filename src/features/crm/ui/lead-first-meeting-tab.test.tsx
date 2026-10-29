import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  appointments: [] as Array<Record<string, unknown>>,
  create: vi.fn().mockResolvedValue({ id: 'new-event' }),
  updateMeeting: vi.fn().mockImplementation(async ({ task, details }) => ({
    ...task,
    reunion: details,
    version: task.version + 1,
  })),
}))

vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({ data: mocks.appointments, isPending: false, isError: false }),
  useCrearTarea: () => ({ mutateAsync: mocks.create, isPending: false }),
  useActualizarReunionEspecial: () => ({ mutateAsync: mocks.updateMeeting, isPending: false }),
  MeetingInternalNotes: () => <div>Notas internas de la reunión</div>,
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

const meeting = (reunion: Record<string, unknown> = {}) =>
  ({
    id: 'event-1',
    oportunidadId: 'lead-1',
    tipo: 'Evento',
    estado: 'Pendiente',
    asignadoId: 'user-1',
    creadaPorId: 'user-1',
    venceEn: '2026-10-20T09:00:00.000Z',
    version: 1,
    reunion: {
      startsAt: '2026-10-20T09:00:00.000Z',
      endsAt: '2026-10-20T09:30:00.000Z',
      durationMinutes: 30,
      mode: 'office_recalde',
      abogadoPrimeraCita: 'Ana Responsable',
      specialType: 'meeting',
      status: 'scheduled',
      primeraCita: { estado: 'Programada' },
      ...reunion,
    },
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
  it('shows a compact appointment summary and the transcript workspace, without the long form', () => {
    mocks.appointments = [meeting()]
    renderTab()

    const block = screen.getByRole('region', { name: 'Datos de la cita' })
    for (const text of ['Ana Responsable', 'Despacho Rekalde', '30 min', 'Agendada'])
      expect(block.textContent).toContain(text)
    expect(screen.getByText('Transcripción de la Primera cita')).toBeTruthy()
    expect(screen.queryByText('Resultado y siguientes pasos')).toBeNull()
    expect(screen.queryByRole('button', { name: /Comenzar primera cita/i })).toBeNull()
  })

  it('reschedules with any minute and keeps the meeting lifecycle status', async () => {
    mocks.appointments = [meeting()]
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /Editar \/ reprogramar cita/ }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:37' } })
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))

    await waitFor(() => expect(mocks.updateMeeting).toHaveBeenCalledOnce())
    const details = mocks.updateMeeting.mock.calls[0]?.[0].details
    expect(details).toMatchObject({
      specialType: 'meeting',
      status: 'scheduled',
      durationMinutes: 45,
      abogadoPrimeraCita: 'Ana Responsable',
      primeraCita: { estado: 'Programada', duracion: '45 minutos' },
    })
    expect(Date.parse(details.startsAt)).toBe(new Date('2026-10-22T10:37').getTime())
    expect(Date.parse(details.endsAt) - Date.parse(details.startsAt)).toBe(45 * 60_000)
  })

  it('hides the edit action once the meeting is finished', () => {
    mocks.appointments = [meeting({ status: 'finished', primeraCita: { estado: 'Celebrada' } })]
    renderTab()
    expect(screen.queryByRole('button', { name: /Editar \/ reprogramar cita/ })).toBeNull()
  })

  it('offers to schedule a linked first meeting when none exists', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /Programar primera cita/i }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      tipo: 'Evento',
      oportunidadId: 'lead-1',
      detallesReunion: {
        specialType: 'meeting',
        meetingType: 'Primera cita',
        status: 'scheduled',
        attendeeContactIds: ['contact-1'],
      },
    })
  })
})