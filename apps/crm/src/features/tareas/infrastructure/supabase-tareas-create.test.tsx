import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }),
  }),
}))

import { useCrearTarea } from './supabase-tareas'

it('envía el vínculo con la cita al crear la tarea', async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      id: 'task-1',
      parent_task_id: 'meeting-1',
      kind: 'task',
      status: 'pending',
      priority: 'medium',
    },
    error: null,
  })
  const client = new QueryClient()
  const { result } = renderHook(() => useCrearTarea('firm-1'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  let created: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
  await act(async () => {
    created = await result.current.mutateAsync({
      expedienteId: null,
      oportunidadId: 'lead-1',
      tareaPadreId: 'meeting-1',
      tipo: 'Tarea',
      titulo: 'Revisar escritura',
      descripcion: '',
      prioridad: 'Media',
      venceEn: null,
      recordarEn: null,
      clasePlazo: null,
      critico: false,
      asignadoId: null,
    })
  })
  expect(mocks.rpc).toHaveBeenCalledWith(
    'crm_create_task',
    expect.objectContaining({
      target_opportunity_id: 'lead-1',
      new_parent_task_id: 'meeting-1',
      new_title: 'Revisar escritura',
    }),
  )
  expect(created?.tareaPadreId).toBe('meeting-1')
})

it('actualiza la campana al crear una solicitud de cita autoasignada', async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      id: 'meeting-1',
      kind: 'event',
      status: 'pending',
      priority: 'medium',
      assigned_to: 'user-1',
      created_by: 'user-1',
      meeting_details: { specialType: 'meeting', status: 'preparation' },
    },
    error: null,
  })
  const client = new QueryClient()
  client.setQueryData(['notificaciones', 'user-1', 'sin-leer'], 0)
  const { result } = renderHook(() => useCrearTarea('firm-1'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await act(async () => {
    await result.current.mutateAsync({
      expedienteId: null,
      oportunidadId: 'lead-1',
      tipo: 'Evento',
      titulo: 'Reunión',
      descripcion: '',
      prioridad: 'Media',
      venceEn: null,
      recordarEn: null,
      clasePlazo: null,
      critico: false,
      asignadoId: 'user-1',
    })
  })
  expect(client.getQueryState(['notificaciones', 'user-1', 'sin-leer'])?.isInvalidated).toBe(true)
})
