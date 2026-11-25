import type * as Router from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  appointments: [] as Array<Record<string, unknown>>,
  origins: {
    leads: [] as { id: string; reference: string }[],
    cases: [] as { id: string; reference: string }[],
  },
  notes: [] as Array<Record<string, unknown>>,
  create: vi.fn().mockResolvedValue({ id: 'new-event' }),
  invoke: vi.fn(),
  updateMeeting: vi.fn().mockImplementation(async ({ task, details }) => ({
    ...task,
    reunion: details,
    version: task.version + 1,
  })),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data:
      queryKey[1] === 'contact-appointment-origins'
        ? mocks.origins
        : queryKey[1] === 'notes'
          ? mocks.notes
          : [],
  }),
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: ComponentProps<'a'> & {
    to: string
    params: { id?: string; taskId?: string }
    search?: Record<string, string>
  }) => (
    <a
      {...props}
      href={`${to.replace('$id', params.id ?? '').replace('$taskId', params.taskId ?? '')}${search ? `?${new URLSearchParams(search)}` : ''}`}
    >
      {children}
    </a>
  ),
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ functions: { invoke: mocks.invoke } }),
}))

vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({ data: mocks.appointments, isPending: false, isError: false }),
  useCrearTarea: () => ({ mutateAsync: mocks.create, isPending: false }),
  useActualizarReunionEspecial: () => ({ mutateAsync: mocks.updateMeeting, isPending: false }),
  useMarcarSiguienteAccion: () => ({ isPending: false }),
  MeetingInternalNotes: () => <div>Notas internas de la reunión</div>,
}))

import { FirstMeetingTimer } from './first-meeting-workspace'
import { AppointmentsTab, LeadFirstMeetingTab } from './lead-first-meeting-tab'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  mocks.appointments = []
  mocks.origins = { leads: [], cases: [] }
  mocks.notes = []
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

function tabElement(members = [{ id: 'user-1', nombre: 'Ana Responsable' }]) {
  return (
    <LeadFirstMeetingTab
      opportunity={opportunity}
      firmId="firm-1"
      members={members}
      contactId="contact-1"
      contactName="María Cliente"
      currentUserId="user-1"
      memberRole="paralegal"
      canEdit
    />
  )
}

function renderTab() {
  return render(tabElement())
}

describe('LeadFirstMeetingTab', () => {
  it('avisa al cumplir 12 horas sin cerrar la cita', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-25T09:00:00Z'))
    const reunion = { status: 'in_progress', startedAt: '2026-11-24T21:00:01Z' }
    render(<FirstMeetingTimer reunion={reunion} />)
    expect(screen.queryByRole('status')).toBeNull()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('status').textContent).toContain('12 horas o más')
    expect(screen.getByLabelText('Tiempo transcurrido').textContent).toBe('12:00:00')
  })
  it('guarda notas breves en la reunión y permite seguir añadiendo sin esperar a la recarga', async () => {
    mocks.appointments = [
      meeting({
        status: 'in_progress',
        primeraCita: { estado: 'En curso', horaInicioReal: '2026-10-20T09:00:00Z' },
        internalNotes: ['Nota previa'],
      }),
    ]
    const tab = renderTab()
    expect(screen.queryByLabelText('Texto de la transcripción')).toBeNull()
    expect(screen.getByText('Notas internas de la reunión')).toBeTruthy()
    const input = screen.getByLabelText('Añadir notas durante la cita') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  Nueva nota  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('Nueva nota')).toBeTruthy())
    expect(input.value).toBe('')
    fireEvent.change(input, { target: { value: 'Segunda nota' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('Segunda nota')).toBeTruthy())
    expect(mocks.updateMeeting.mock.calls[1]?.[0]).toMatchObject({
      task: { version: 2 },
      details: { internalNotes: ['Nota previa', 'Nueva nota', 'Segunda nota'] },
    })
    mocks.appointments = [
      mocks.updateMeeting.mock.results[1]?.value
        ? await mocks.updateMeeting.mock.results[1]?.value
        : {},
    ]
    tab.rerender(tabElement())
    tab.unmount()
    renderTab()
    expect(screen.getByText('Nueva nota')).toBeTruthy()
    expect(screen.getByText('Segunda nota')).toBeTruthy()
  })

  it('conserva el borrador de la nota si falla su guardado', async () => {
    mocks.appointments = [meeting({ status: 'in_progress' })]
    mocks.updateMeeting.mockRejectedValueOnce(new Error('Error al guardar'))
    renderTab()
    const input = screen.getByLabelText('Añadir notas durante la cita') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Texto pendiente' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(mocks.updateMeeting).toHaveBeenCalledOnce())
    await waitFor(() => expect(input.disabled).toBe(false))
    expect(input.value).toBe('Texto pendiente')
    expect(screen.queryByText('Texto pendiente')).toBeNull()
  })

  it('shows the schedule and a manual Google Calendar link before the appointment starts', () => {
    mocks.appointments = [meeting()]
    renderTab()

    const block = screen.getByRole('region', { name: 'Datos de la cita' })
    for (const text of ['Ana Responsable', 'Despacho Rekalde', '30 min', 'Agendada'])
      expect(block.textContent).toContain(text)
    expect(screen.getByRole('link', { name: 'Añadir a Google Calendar' })).toBeTruthy()
    expect(screen.queryByLabelText('Texto de la transcripción')).toBeNull()
  })

  it('reschedules with any minute and keeps the meeting lifecycle status', async () => {
    mocks.appointments = [meeting()]
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /Editar \/ reprogramar cita/ }))
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-22' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:37' } })
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '45' } })
    expect((screen.getByLabelText('Abogado') as HTMLSelectElement).value).toBe('__legacy__')
    fireEvent.change(screen.getByLabelText('Abogado'), { target: { value: 'user-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))

    await waitFor(() => expect(mocks.updateMeeting).toHaveBeenCalledOnce())
    const details = mocks.updateMeeting.mock.calls[0]?.[0].details
    expect(details).toMatchObject({
      specialType: 'meeting',
      status: 'scheduled',
      durationMinutes: 45,
      abogadoPrimeraCita: 'Ana Responsable',
      abogadoPrimeraCitaId: 'user-1',
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

  it('conserva el nombre antiguo sin asignarlo automáticamente a otro usuario', async () => {
    mocks.appointments = [meeting({ abogadoPrimeraCita: 'Ana Responsable' })]
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /Editar \/ reprogramar cita/ }))
    expect((screen.getByLabelText('Abogado') as HTMLSelectElement).value).toBe('__legacy__')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))
    await waitFor(() => expect(mocks.updateMeeting).toHaveBeenCalledOnce())
    expect(mocks.updateMeeting.mock.calls[0]?.[0].details).toMatchObject({
      abogadoPrimeraCita: 'Ana Responsable',
      abogadoPrimeraCitaId: '',
    })
  })

  it('guarda el identificador del abogado elegido aunque sea distinto del responsable de la tarea', async () => {
    mocks.appointments = [meeting({ abogadoPrimeraCitaId: 'user-1' })]
    render(
      tabElement([
        { id: 'user-1', nombre: 'Ana Responsable' },
        { id: 'user-2', nombre: 'Otro abogado' },
      ]),
    )
    fireEvent.click(screen.getByRole('button', { name: /Editar \/ reprogramar cita/ }))
    fireEvent.change(screen.getByLabelText('Abogado'), { target: { value: 'user-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cita' }))
    await waitFor(() => expect(mocks.updateMeeting).toHaveBeenCalledOnce())
    expect(mocks.updateMeeting.mock.calls[0]?.[0].details).toMatchObject({
      abogadoPrimeraCita: 'Otro abogado',
      abogadoPrimeraCitaId: 'user-2',
    })
  })

  it('analyses a saved transcript without a separate authorization checkbox', async () => {
    mocks.appointments = [meeting({ status: 'finished', transcription: 'Transcripción de prueba' })]
    mocks.invoke.mockResolvedValue({
      data: { proposal: { resumen: 'Resumen propuesto' } },
      error: null,
    })
    renderTab()

    expect(screen.getAllByRole('heading', { name: 'Transcripción de la cita' })).toHaveLength(1)
    expect(screen.getByText('Incorporada')).toBeTruthy()
    expect(screen.getByText('Transcripción de prueba')).toBeTruthy()
    expect(screen.queryByLabelText(/Confirmo que puedo enviar/)).toBeNull()
    const analyze = screen.getByRole('button', { name: 'Analizar con LEXIA' })
    expect(analyze.hasAttribute('disabled')).toBe(false)
    fireEvent.click(analyze)

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith('analyze-first-meeting-transcript', {
        body: {
          firmId: 'firm-1',
          taskId: 'event-1',
          transcript: 'Transcripción de prueba',
          consent: true,
        },
      }),
    )
    await waitFor(() =>
      expect(mocks.updateMeeting).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            lexiaProposal: expect.objectContaining({
              resumen: 'Resumen propuesto',
              estado: 'pendiente_revision',
            }),
          }),
        }),
      ),
    )
  })

  it('keeps the lead appointments separate and opens the exact case appointment from a link', () => {
    mocks.appointments = [
      { ...meeting(), titulo: 'Consulta inicial' },
      { ...meeting(), id: 'case-event-1', expedienteId: 'case-1', titulo: 'Revisión' },
      { ...meeting(), id: 'case-event-2', expedienteId: 'case-1', titulo: 'Seguimiento' },
    ]
    const lead = renderTab()
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option', { name: /Consulta inicial/ })).toBeTruthy()
    lead.unmount()

    render(
      <AppointmentsTab
        scope="case"
        parent={{ id: 'case-1', titulo: 'Sucesión', referencia: 'EXP-001' }}
        firmId="firm-1"
        members={[]}
        contactId="contact-1"
        currentUserId="user-1"
        memberRole="paralegal"
        appointmentId="case-event-2"
        canEdit
      />,
    )
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect((screen.getByRole('combobox', { name: 'Cita' }) as HTMLSelectElement).value).toBe(
      'case-event-2',
    )
  })

  it('shows the same contact’s appointment history and final notes without leaving the active meeting', () => {
    mocks.origins = {
      leads: [{ id: 'previous-lead', reference: 'OP-002' }],
      cases: [{ id: 'case-1', reference: 'EXP-001' }],
    }
    mocks.appointments = [
      { ...meeting({ status: 'in_progress' }), titulo: 'Cita actual' },
      {
        ...meeting({ status: 'finished' }),
        id: 'past-event',
        oportunidadId: 'previous-lead',
        titulo: 'Consulta anterior',
      },
      {
        ...meeting({ startsAt: '2099-10-22T09:00:00Z' }),
        id: 'future-event',
        expedienteId: 'case-1',
        titulo: 'Próximo seguimiento',
      },
      {
        ...meeting({ status: 'preparation', attendeeContactIds: ['contact-1'] }),
        id: 'pending-event',
        expedienteId: 'case-2',
        titulo: 'Pendiente de llamada',
      },
      {
        ...meeting({ attendeeContactIds: ['other-contact'] }),
        id: 'unrelated-event',
        expedienteId: 'case-1',
        titulo: 'Cita de otra persona',
      },
      { ...meeting(), id: 'unknown-event', expedienteId: 'case-2', titulo: 'Cita sin vínculo' },
    ]
    mocks.notes = [
      {
        status: 'archived',
        details: { taskId: 'past-event', cierreCita: 'true' },
        content: 'Nota archivada',
      },
      {
        status: 'active',
        details: {
          taskId: 'past-event',
          cierrePrimeraCita: 'true',
          notasFinales: ['Revisar la documentación de la herencia'],
        },
        content: '',
      },
    ]
    renderTab()

    const liveNotes = screen.getByLabelText('Añadir notas durante la cita') as HTMLInputElement
    fireEvent.change(liveNotes, { target: { value: 'Borrador de la reunión actual' } })
    const history = within(screen.getByRole('complementary', { name: 'Historial de citas' }))
    const past = within(history.getByRole('region', { name: 'Anteriores' }))
    const upcoming = within(history.getByRole('region', { name: 'Próximas y en curso' }))
    fireEvent.click(past.getByText('Consulta anterior'))
    expect(past.getByText('Revisar la documentación de la herencia')).toBeTruthy()
    expect(past.queryByText('Nota archivada')).toBeNull()
    fireEvent.click(upcoming.getByText('Próximo seguimiento'))
    const link = upcoming.getByRole('link', { name: 'Abrir cita en otra pestaña' })
    expect(link.getAttribute('href')).toBe(
      '/expedientes/case-1?tab=appointments&appointmentId=future-event',
    )
    expect(link.getAttribute('target')).toBe('_blank')
    expect(
      within(history.getByRole('region', { name: 'Sin fecha confirmada' })).getByText(
        'Pendiente de llamada',
      ),
    ).toBeTruthy()
    expect(history.queryByText('Cita actual')).toBeNull()
    expect(history.queryByText('Cita de otra persona')).toBeNull()
    expect(history.queryByText('Cita sin vínculo')).toBeNull()
    expect(liveNotes.value).toBe('Borrador de la reunión actual')
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('offers to schedule a linked first meeting when none exists', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: /Programar primera cita/i }))
    expect(mocks.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'Ana Responsable' }))
    fireEvent.change(screen.getByLabelText('Fecha de la cita *'), {
      target: { value: '2026-12-02' },
    })
    fireEvent.change(screen.getByLabelText('Hora *'), { target: { value: '10:37' } })
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'CREAR PRIMERA CITA' }))

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce())
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      tipo: 'Evento',
      oportunidadId: 'lead-1',
      detallesReunion: {
        specialType: 'meeting',
        meetingType: 'Primera cita',
        status: 'scheduled',
        attendeeContactIds: ['contact-1'],
        abogadoPrimeraCitaId: 'user-1',
        startsAt: new Date('2026-12-02T10:37').toISOString(),
        durationMinutes: 45,
      },
    })
    const details = mocks.create.mock.calls[0]?.[0].detallesReunion
    expect(Date.parse(details.endsAt) - Date.parse(details.startsAt)).toBe(45 * 60_000)
  })
})
