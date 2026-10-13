import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({}),
  createContact: vi.fn().mockResolvedValue({ id: 'new-1' }),
}))

vi.mock('@/features/contactos', () => ({
  useContactos: () => ({
    data: [
      { id: 'c-main', nombre: 'Ana', apellidos: 'López' },
      { id: 'c-2', nombre: 'Luis', apellidos: 'López Ruiz', email: 'luis@x.es' },
    ],
  }),
  useCrearContacto: () => ({ isPending: false, mutateAsync: mocks.createContact }),
}))
vi.mock('@/features/crm/infrastructure/supabase-oportunidades', () => ({
  useActualizarDetallesOportunidad: () => ({ isPending: false, mutateAsync: mocks.save }),
}))

import { LeadParticipants } from './lead-participants'

const opportunity = {
  id: 'op-1',
  version: 3,
  contactoId: 'c-main',
  detalles: { resultadoCualificacion: 'x', otrosIntervinientes: [] },
} as never

function renderParticipants() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<LeadParticipants firmId="f" opportunity={opportunity} canEdit />, { wrapper })
}

afterEach(() => {
  cleanup()
  mocks.save.mockClear()
  mocks.createContact.mockClear()
})

describe('Intervinientes del Lead', () => {
  it('vincula un contacto existente sin crear un duplicado', async () => {
    renderParticipants()
    fireEvent.click(screen.getByRole('button', { name: /Añadir interviniente/ }))
    fireEvent.change(screen.getByLabelText('Buscar en Contactos'), { target: { value: 'luis' } })
    expect(screen.queryByText('Ana López')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Luis López Ruiz/ }))
    fireEvent.change(screen.getByLabelText('Relación / condición *'), {
      target: { value: 'Hermano' },
    })
    fireEvent.change(screen.getByLabelText('Posición en el asunto'), {
      target: { value: 'Parte contraria' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular interviniente' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.createContact).not.toHaveBeenCalled()
    expect(mocks.save.mock.calls[0]?.[0]).toMatchObject({
      versionEsperada: 3,
      detalles: {
        resultadoCualificacion: 'x',
        otrosIntervinientes: [
          {
            contactoId: 'c-2',
            nombre: 'Luis López Ruiz',
            rol: 'Hermano',
            posicion: 'Parte contraria',
          },
        ],
      },
    })
  })

  it('crea un contacto nuevo y lo vincula al Lead', async () => {
    renderParticipants()
    fireEvent.click(screen.getByRole('button', { name: /Añadir interviniente/ }))
    fireEvent.change(screen.getByLabelText('Buscar en Contactos'), { target: { value: 'Marta' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear contacto nuevo/ }))
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Gil' } })
    fireEvent.change(screen.getByLabelText('Relación / condición *'), {
      target: { value: 'Coheredera' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular interviniente' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.createContact.mock.calls[0]?.[0].valores).toEqual({
      nombre: 'Marta',
      apellidos: 'Gil',
    })
    expect(mocks.save.mock.calls[0]?.[0].detalles.otrosIntervinientes[0]).toMatchObject({
      contactoId: 'new-1',
      rol: 'Coheredera',
    })
  })
})
