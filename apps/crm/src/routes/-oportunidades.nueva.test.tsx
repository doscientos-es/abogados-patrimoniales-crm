import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { contactId: 'contact-1' },
  createOpportunity: vi.fn(),
  createTask: vi.fn(),
  markNextAction: vi.fn(),
  contactRefetch: vi.fn().mockResolvedValue({ isError: false }),
  advanceLead: vi.fn(),
  transition: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => mocks.search }),
  Link: ({
    children,
    to,
    ...props
  }: { children: ReactNode; to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
}))

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }))
vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))
vi.mock('@/features/contactos', () => ({
  useContactos: () => ({
    data: [{ id: 'contact-1', nombre: 'Ana', apellidos: 'López' }],
    isPending: false,
    refetch: mocks.contactRefetch,
  }),
}))
vi.mock('@/features/crm', () => ({
  useAvanzarLeadPorHito: () => ({ isPending: false, mutateAsync: mocks.advanceLead }),
  useCrearOportunidad: () => ({ isPending: false, mutateAsync: mocks.createOpportunity }),
  useLeadRoles: () => ({ data: [] }),
  useMiembrosDespacho: () => ({ data: [{ id: 'lawyer-jon', nombre: 'Jon' }] }),
  useTransicionarOportunidad: () => ({ isPending: false, mutateAsync: mocks.transition }),
}))
vi.mock('@/features/notas', () => ({ useCrearNotaOportunidad: () => ({ isPending: false }) }))
vi.mock('@/features/tareas', () => ({
  useCrearTarea: () => ({ isPending: false, mutateAsync: mocks.createTask }),
  useMarcarSiguienteAccion: () => ({ isPending: false, mutateAsync: mocks.markNextAction }),
}))

import { NuevaOportunidadPage } from './oportunidades.nueva'

afterEach(() => {
  cleanup()
  mocks.navigate.mockClear()
  mocks.createOpportunity.mockReset()
  mocks.createTask.mockReset()
  mocks.markNextAction.mockReset()
  mocks.contactRefetch.mockClear()
  mocks.advanceLead.mockReset()
  mocks.transition.mockReset()
  mocks.search = { contactId: 'contact-1' }
})

describe('NuevaOportunidadPage', () => {
  it('preselecciona el contacto indicado al abrir el formulario', async () => {
    render(<NuevaOportunidadPage />)

    await waitFor(() =>
      expect((screen.getByLabelText('Contacto principal') as HTMLInputElement).value).toBe(
        'Ana López',
      ),
    )
    expect((screen.getByRole('button', { name: 'Crear Lead' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('keeps the Lead form in memory and refreshes contacts after creating one in another tab', async () => {
    render(<NuevaOportunidadPage />)

    const title = screen.getByLabelText('Título del Lead') as HTMLInputElement
    fireEvent.change(title, { target: { value: 'Consulta inicial' } })
    const createContact = screen.getByRole('link', { name: 'Crear contacto en otra pestaña' })
    expect(createContact.getAttribute('href')).toBe('/contactos/nuevo')
    expect(createContact.getAttribute('target')).toBe('_blank')
    expect(createContact.getAttribute('rel')).toContain('noopener')

    createContact.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(createContact)

    expect(title.value).toBe('Consulta inicial')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contactos' }))
    await waitFor(() => expect(mocks.contactRefetch).toHaveBeenCalledOnce())
    expect(screen.queryByRole('button', { name: 'Actualizar contactos' })).toBeNull()
  })

  it('pregunta por la siguiente acción tras guardar y permite continuar a la ficha', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const task = { id: 'task-1', oportunidadId: 'opportunity-1', version: 1 }
    mocks.createTask.mockResolvedValue(task)
    mocks.markNextAction.mockResolvedValue(task)
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), {
      target: { value: 'Consulta inicial' },
    })
    fireEvent.change(screen.getByLabelText('Materia'), {
      target: { value: 'SUCESIONES Y HERENCIAS' },
    })
    fireEvent.change(screen.getByLabelText('Nuevo documento'), {
      target: { value: 'Testamento' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    mocks.advanceLead.mockResolvedValue({ pasos: 2, fase: 'first_meeting', version: 3 })

    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)

    await waitFor(() =>
      expect(mocks.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ area: 'SUCESIONES Y HERENCIAS' }),
      ),
    )
    const details = mocks.createOpportunity.mock.calls[0]?.[0].details
    expect(details.informacionInicial.documentacionManifestada).toBe('TESTAMENTO')
    expect(details.documentosIniciales).toEqual([{ nombre: 'TESTAMENTO', estado: 'declarado' }])
    expect(details.viabilidadInicial.resultado).toBe('apto')
    await waitFor(() =>
      expect(mocks.advanceLead).toHaveBeenCalledWith({
        id: 'opportunity-1',
        hito: 'viabilidad_apta',
      }),
    )
    expect(await screen.findByText('Lead creado correctamente')).toBeTruthy()
    expect(mocks.navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Concertar primera cita' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Jon' }))
    fireEvent.change(screen.getByLabelText('Fecha de la cita *'), {
      target: { value: '2026-12-02' },
    })
    fireEvent.change(screen.getByLabelText('Hora *'), { target: { value: '10:37' } })
    expect((screen.getByLabelText('Hora *') as HTMLInputElement).step).toBe('60')
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Modalidad / lugar'), { target: { value: 'phone' } })
    fireEvent.click(screen.getByRole('button', { name: 'CREAR PRIMERA CITA' }))

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledOnce())
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        oportunidadId: 'opportunity-1',
        tipo: 'Evento',
        titulo: 'Reunión: PRIMERA CITA',
        asignadoId: 'lawyer-jon',
        venceEn: expect.any(String),
        detallesReunion: expect.objectContaining({
          meetingType: 'Primera cita',
          subject: 'PRIMERA CITA',
          attendeeContactIds: ['contact-1'],
          startsAt: expect.any(String),
          endsAt: expect.any(String),
          durationMinutes: 45,
          mode: 'phone',
          preferredDate: '2026-12-02',
          abogadoPrimeraCita: 'Jon',
          primeraCita: expect.objectContaining({ estado: 'Programada' }),
        }),
      }),
    )
    const meeting = mocks.createTask.mock.calls[0]?.[0].detallesReunion
    expect(meeting.startsAt).toBe(new Date('2026-12-02T10:37').toISOString())
    expect(Date.parse(meeting.endsAt) - Date.parse(meeting.startsAt)).toBe(45 * 60_000)
    expect(mocks.markNextAction).toHaveBeenCalledWith({ task, enabled: true })

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/oportunidades/$id',
        params: { id: 'opportunity-1' },
      }),
    )
  })

  it('guarda la viabilidad pendiente y mueve el Lead a cualificación', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    mocks.advanceLead.mockResolvedValue({ pasos: 1, fase: 'qualification', version: 2 })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), {
      target: { value: 'Consulta inicial' },
    })
    fireEvent.click(screen.getByLabelText('PENDIENTE DE REVISIÓN'))

    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)

    await waitFor(() => expect(mocks.advanceLead).toHaveBeenCalledOnce())
    expect(mocks.createOpportunity.mock.calls[0]?.[0].details.viabilidadInicial.resultado).toBe(
      'pendiente',
    )
    expect(mocks.advanceLead).toHaveBeenCalledWith({
      id: 'opportunity-1',
      hito: 'viabilidad_pendiente',
    })
    expect((screen.getByLabelText('Título *') as HTMLInputElement).value).toBe(
      'REVISAR VIABILIDAD',
    )
  })

  it('exige motivo para no apto y guarda el cierre del Lead con ese motivo', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    mocks.transition.mockResolvedValue({ id: 'opportunity-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), {
      target: { value: 'Consulta inicial' },
    })
    fireEvent.click(screen.getByLabelText('NO APTO / NO ATENDIBLE'))

    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)
    expect(mocks.createOpportunity).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Motivo *'), {
      target: { value: 'Fuera de nuestra especialidad' },
    })
    fireEvent.submit(form)

    await waitFor(() =>
      expect(mocks.transition).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'opportunity-1',
          fase: 'lost',
          subestado: 'No apto / no atendible',
          motivo: expect.stringContaining('Fuera de nuestra especialidad'),
        }),
      ),
    )
    expect(mocks.createOpportunity.mock.calls[0]?.[0].details.viabilidadInicial).toMatchObject({
      resultado: 'no_apto',
      motivo: 'Fuera de nuestra especialidad',
    })
    expect(await screen.findByText('Lead creado correctamente')).toBeTruthy()
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Concertar primera cita' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la ficha del Lead' }))
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/oportunidades/$id',
        params: { id: 'opportunity-1' },
      }),
    )
  })
})
