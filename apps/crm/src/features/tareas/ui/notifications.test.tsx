import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  markRead: vi.fn(),
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  history: vi.fn(),
  recent: vi.fn(),
}))

vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))
vi.mock('@/features/tareas', () => ({
  useNotificacionesTareas: () => mocks.recent(),
  useNotificacionesSinLeer: () => ({ data: 12 }),
  useHistorialNotificaciones: (userId: string, unreadOnly: boolean) =>
    mocks.history(userId, unreadOnly),
  useMarcarNotificacionesLeidas: () => ({ mutate: mocks.markRead, isPending: false }),
}))
vi.mock('@/features/tareas/ui/task-detail-dialog', () => ({
  TaskDetailDialog: ({ taskId }: { taskId: string | null }) =>
    taskId ? <div>Detalle: {taskId}</div> : null,
}))

import { NotificationsPage } from './notifications-page'
import { TaskNotificationsBell } from './task-notifications-bell'

const notification = (id: number, read = false) => ({
  id: String(id),
  task_id: `task-${id}`,
  task_title: `Tarea ${id}`,
  kind: 'task_reminder',
  body: 'Recordatorio al responsable: Revisar',
  actor_name: 'Ana',
  read_at: read ? '2026-01-02T12:00:00Z' : null,
  created_at: '2026-01-01T12:00:00Z',
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.recent.mockReturnValue({ data: Array.from({ length: 5 }, (_, i) => notification(i + 1)) })
  mocks.history.mockImplementation((_userId, unreadOnly) => ({
    data: { pages: [[notification(1), ...(unreadOnly ? [] : [notification(2, true)])]] },
    hasNextPage: true,
    fetchNextPage: mocks.fetchNextPage,
    refetch: mocks.refetch,
  }))
})
afterEach(cleanup)

it('muestra los avisos recientes, el total sin leer y un enlace al historial', async () => {
  const onNavigate = vi.fn()
  render(<TaskNotificationsBell onNavigate={onNavigate} />)
  fireEvent.click(screen.getByRole('button', { name: 'Avisos (12 sin leer)' }))
  const menu = await screen.findByRole('menu')
  expect(within(menu).getByText('Tarea 5')).toBeTruthy()
  expect(within(menu).queryByText('Tarea 6')).toBeNull()
  const link = within(menu).getByRole('menuitem', { name: 'Ver todas las notificaciones' })
  expect(link.getAttribute('href')).toBe('/notificaciones')
  fireEvent.click(link)
  expect(onNavigate).toHaveBeenCalledOnce()
})

it('filtra el historial completo, abre tareas y permite cargar más o marcar todo', () => {
  render(<NotificationsPage />)
  expect(screen.getByText('Tarea 2')).toBeTruthy()
  const firstNotification = screen.getByText('Tarea 1').closest('article') as HTMLElement
  expect(within(firstNotification).getByText('Ana: Revisar')).toBeTruthy()
  fireEvent.click(within(firstNotification).getByRole('button', { name: 'Abrir tarea' }))
  expect(mocks.markRead).toHaveBeenCalledWith('task-1', expect.any(Object))
  expect(screen.getByText('Detalle: task-1')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Sin leer (12)' }))
  expect(mocks.history).toHaveBeenLastCalledWith('user-1', true)
  expect(screen.queryByText('Tarea 2')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
  expect(mocks.fetchNextPage).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Marcar todo como leído' }))
  expect(mocks.markRead).toHaveBeenCalledWith(null, expect.any(Object))
})

it('permite reintentar si falla la carga inicial', () => {
  mocks.history.mockReturnValue({ isError: true, refetch: mocks.refetch })
  render(<NotificationsPage />)
  expect(screen.getByText('No se pudieron cargar las notificaciones.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(mocks.refetch).toHaveBeenCalledOnce()
})
