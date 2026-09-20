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
    params: _params,
    children,
    ...props
  }: { to: string; params?: unknown } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
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

import { CalendarPage } from './calendar-page'

afterEach(() => {
  cleanup()
  mocks.tasks = []
  mocks.createTask.mockClear()
  mocks.editTask.mockClear()
  vi.useRealTimers()
})

describe('CalendarPage', () => {
  it('opens an event form with the clicked day preselected', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 14, 12))
    render(<CalendarPage />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Crear evento el 14 de septiembre de 2026' }),
    )

    expect(screen.getByRole('dialog', { name: 'Crear evento' })).toBeTruthy()
    expect((screen.getByLabelText(/Fecha y hora/) as HTMLInputElement).value).toBe(
      '2026-09-14T09:00',
    )
  })

  it('opens event details, updates the shared task date, and links to its task detail', async () => {
    mocks.tasks = [
      {
        id: 'task-1',
        titulo: 'Reunión con cliente',
        descripcion: 'Revisar la estrategia.',
        tipo: 'Evento',
        estado: 'Pendiente',
        prioridad: 'Alta',
        venceEn: '2026-09-14T10:00:00',
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
    render(<CalendarPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles de Reunión con cliente' }))

    expect(screen.getByRole('dialog', { name: 'Reunión con cliente' })).toBeTruthy()
    expect(screen.getByText('Revisar la estrategia.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir tarea' }).getAttribute('href')).toBe(
      '/tareas/$taskId',
    )
    fireEvent.change(screen.getByLabelText('Fecha y hora'), {
      target: { value: '2026-09-15T11:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar fecha' }))

    await expect.poll(() => mocks.editTask.mock.calls.length).toBe(1)
    expect(mocks.editTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({ id: 'task-1' }),
        venceEn: new Date('2026-09-15T11:30').toISOString(),
      }),
    )
  })
})
