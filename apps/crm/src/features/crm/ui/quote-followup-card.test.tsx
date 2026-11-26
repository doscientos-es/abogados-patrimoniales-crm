import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OportunidadPersistida } from '@/features/crm/application/opportunity-types'

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  error: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/tareas/test">{children}</a>,
}))
vi.mock('@/features/crm', () => ({
  buscarTareaRevisionAbierta: mocks.search,
  useActualizarDetallesOportunidad: () => ({ mutateAsync: mocks.save }),
  useMiembrosDespacho: () => ({
    data: [{ id: 'u1', nombre: 'Ana' }],
    isPending: false,
    isError: false,
  }),
}))
vi.mock('@/features/tareas', () => ({ useCrearTarea: () => ({ mutateAsync: mocks.create }) }))

import { QuoteFollowupCard } from './quote-followup-card'

const opportunity = {
  id: 'lead-1',
  version: 3,
  detalles: { presupuesto: { versionEnviada: 2 } },
} as unknown as OportunidadPersistida

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function openRecovery() {
  render(
    <QuoteFollowupCard
      firmId="firm-1"
      opportunity={opportunity}
      cliente="Ana"
      referencia="PR-1"
      canEdit
    />,
  )
  fireEvent.change(screen.getByLabelText('Responsable'), { target: { value: 'u1' } })
  fireEvent.change(screen.getByLabelText('Próxima fecha'), { target: { value: '2026-12-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Recuperar o crear seguimiento' }))
}

describe('recuperación del seguimiento', () => {
  it('reutiliza y vincula una tarea abierta sin crear otra', async () => {
    mocks.search.mockResolvedValue({
      id: 'task-1',
      asignadoId: 'u1',
      venceEn: null,
      creadaEn: '2026-11-01',
    })
    mocks.save.mockResolvedValue({})
    openRecovery()
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.save.mock.calls[0]?.[0]).toMatchObject({
      id: 'lead-1',
      versionEsperada: 3,
      detalles: { seguimientoCliente: { tarea: { tareaId: 'task-1', venceEn: null } } },
    })
  })

  it('no crea una tarea cuando falla la búsqueda previa', async () => {
    mocks.search.mockRejectedValue({ message: 'Sin permiso' })
    openRecovery()
    await waitFor(() => expect(mocks.error).toHaveBeenCalled())
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('avisa si se crea la tarea pero falla su vinculación', async () => {
    mocks.search.mockResolvedValue(null)
    mocks.create.mockResolvedValue({ id: 'task-1' })
    mocks.save.mockRejectedValue(new Error('Conflicto de versión'))
    openRecovery()
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('La tarea existe')),
    )
    expect(mocks.create).toHaveBeenCalledOnce()
  })
})
