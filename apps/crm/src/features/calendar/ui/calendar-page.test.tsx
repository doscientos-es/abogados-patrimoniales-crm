import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createTask: vi.fn().mockResolvedValue(undefined),
  editTask: vi.fn().mockResolvedValue(undefined),
  tasks: [] as unknown[],
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    search?: Record<string, string>
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={
        to.replace(/\$(\w+)/g, (match, key: string) => params?.[key] ?? match) +
        (search ? `?${new URLSearchParams(search)}` : '')
      }
      {...props}
    >
      {children}
    </a>
  ),
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({ data: mocks.tasks, isPending: false, isError: false }),
  useCrearTarea: () => ({ mutateAsync: mocks.createTask, isPending: false }),
  useEditarTarea: () => ({ mutateAsync: mocks.editTask, isPending: false }),
  useEtiquetasTarea: () => ({ data: [], isPending: false, isError: false }),
}))
vi.mock('@/features/expedientes', () => ({
  useExpedientesPersistentes: () => ({
    data: [{ id: 'case-1', referencia: 'EXP-001', titulo: 'Planificación patrimonial' }],
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/features/crm', () => ({
  useMiembrosDespacho: () => ({
    data: [{ id: 'member-1', nombre: 'Laura García' }],
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => null,
}))

import { CalendarPage } from './calendar-page'

afterEach(() => {
  cleanup()
  mocks.tasks = []
  mocks.createTask.mockClear()
  mocks.editTask.mockClear()
  vi.useRealTimers()
})

function renderCalendar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarPage />
    </QueryClientProvider>,
  )
}

describe('CalendarPage', () => {
  it('opens an event form with the clicked day preselected', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 14, 12))
    renderCalendar()

    fireEvent.click(
      screen.getByRole('button', { name: 'Crear evento el 14 de septiembre de 2026' }),
    )

    expect(screen.getByRole('dialog', { name: 'Crear evento' })).toBeTruthy()
    expect((screen.getByLabelText('Vencimiento') as HTMLInputElement).value).toBe('2026-09-14')
    expect((screen.getByLabelText('Hora límite') as HTMLInputElement).value).toBe('09:00')
    expect((screen.getByLabelText('Tipo') as HTMLSelectElement).value).toBe('Evento')
  })

  it('opens event details, updates the shared task date, and links to its task detail', async () => {
    const eventDate = new Date()
    eventDate.setHours(10, 0, 0, 0)
    mocks.tasks = [
      {
        id: 'task-1',
        titulo: 'Reunión con cliente',
        descripcion: 'Revisar la estrategia.',
        tipo: 'Evento',
        estado: 'Pendiente',
        prioridad: 'Alta',
        venceEn: eventDate.toISOString(),
        recordarEn: null,
        expedienteId: 'case-1',
        oportunidadId: null,
        lineaId: null,
        clasePlazo: null,
        validacion: 'No aplica',
        fuentePlazo: '',
        notaValidacion: '',
        validadoPor: null,
        validadoEn: null,
        critico: false,
        asignadoId: null,
        etiquetas: [],
        version: 1,
      },
    ]
    renderCalendar()

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Reunión con cliente' }))

    expect(screen.getByRole('dialog', { name: 'Reunión con cliente' })).toBeTruthy()
    expect(screen.getByText('Revisar la estrategia.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir tarea' }).getAttribute('href')).toBe(
      '/tareas/task-1',
    )
    const updatedDate = new Date(eventDate)
    updatedDate.setDate(updatedDate.getDate() + 1)
    updatedDate.setHours(11, 30, 0, 0)
    const localValue = `${updatedDate.getFullYear()}-${String(updatedDate.getMonth() + 1).padStart(2, '0')}-${String(updatedDate.getDate()).padStart(2, '0')}T11:30`
    fireEvent.change(screen.getByLabelText('Fecha y hora'), { target: { value: localValue } })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar fecha' }))

    await expect.poll(() => mocks.editTask.mock.calls.length).toBe(1)
    expect(mocks.editTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({ id: 'task-1' }),
        venceEn: updatedDate.toISOString(),
      }),
    )
  })

  it('opens the confirmed appointment directly from the host’s calendar without editing its task due date', () => {
    const startsAt = new Date().toISOString()
    mocks.tasks = [
      {
        id: 'appointment-1',
        expedienteId: 'case-1',
        tipo: 'Evento',
        titulo: 'Cita confirmada',
        estado: 'Pendiente',
        prioridad: 'Media',
        asignadoId: 'secretary-1',
        venceEn: null,
        reunion: {
          specialType: 'meeting',
          status: 'scheduled',
          startsAt,
          attendeeUserIds: ['user-1'],
        },
      },
      {
        id: 'appointment-2',
        tipo: 'Evento',
        titulo: 'Otra cita',
        estado: 'Pendiente',
        reunion: {
          specialType: 'meeting',
          status: 'scheduled',
          startsAt,
          attendeeUserIds: ['user-2'],
        },
      },
    ]
    renderCalendar()
    expect(screen.getByRole('button', { name: 'Ver detalles de Otra cita' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mis citas' }))
    expect(screen.queryByRole('button', { name: 'Ver detalles de Otra cita' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Cita confirmada' }))

    expect(screen.getByRole('link', { name: 'Abrir ficha de la cita' }).getAttribute('href')).toBe(
      '/expedientes/case-1?tab=appointments&appointmentId=appointment-1',
    )
    expect(screen.queryByRole('button', { name: 'Actualizar fecha' })).toBeNull()
  })
})
