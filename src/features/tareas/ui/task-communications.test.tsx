import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Deliberately NOT mocking '@/features/tareas': this test guards that every symbol the UI
// imports from the public barrel really exists (a missing export breaks the whole app at
// runtime with "does not provide an export named ...").
vi.mock('@/shared/infrastructure/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSupabaseBrowserClient: () => null,
}))

import * as tareas from '@/features/tareas'
import type { TareaPersistida } from '@/features/tareas'
import { TaskCommunications } from '@/features/tareas/ui/task-communications'

describe('barrel @/features/tareas', () => {
  it.each(['useComunicacionesTarea', 'useRegistrarComunicacionTarea'])(
    'exporta %s',
    (name) => {
      expect(typeof (tareas as Record<string, unknown>)[name]).toBe('function')
    },
  )
})

describe('TaskCommunications (sin mocks del barrel)', () => {
  it('se monta y muestra el estado vacío', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <TaskCommunications
          firmId="firm-1"
          task={{ id: 'task-1', expedienteId: 'case-1' } as TareaPersistida}
          canWork
        />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Sin comunicaciones vinculadas a la tarea.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Registrar llamada/ })).toBeTruthy()
  })
})
