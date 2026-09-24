import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  markNextAction: vi.fn(),
  onFinish: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))
vi.mock('@/features/crm', () => ({ useMiembrosDespacho: () => ({ data: [] }) }))
vi.mock('@/features/tareas', () => ({
  useCrearTarea: () => ({ isPending: false, mutateAsync: mocks.createTask }),
  useMarcarSiguienteAccion: () => ({ isPending: false, mutateAsync: mocks.markNextAction }),
}))

import { LeadNextActionDialog } from './lead-next-action-dialog'

const task = { id: 'task-1', version: 1 }

beforeEach(() => {
  mocks.createTask.mockReset().mockResolvedValue(task)
  mocks.markNextAction.mockReset().mockResolvedValue(task)
  mocks.onFinish.mockReset()
  mocks.toastError.mockReset()
  mocks.toastSuccess.mockReset()
})

afterEach(cleanup)

describe('LeadNextActionDialog', () => {
  it('crea una tarea vinculada al Lead y la marca como siguiente acción', async () => {
    render(
      <LeadNextActionDialog
        open
        firmId="firm-1"
        opportunityId="opportunity-1"
        reference="LD-1"
        onFinish={mocks.onFinish}
      />,
    )

    const form = screen.getByRole('dialog').querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de siguiente acción.')
    fireEvent.submit(form)

    await waitFor(() => expect(mocks.createTask).toHaveBeenCalledOnce())
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        oportunidadId: 'opportunity-1',
        tipo: 'Tarea',
        titulo: 'Llamar al contacto',
        asignadoId: null,
      }),
    )
    expect(mocks.markNextAction).toHaveBeenCalledWith({ task, enabled: true })
    expect(mocks.onFinish).toHaveBeenCalledOnce()
  })

  it('reintenta el marcado sin duplicar una tarea ya creada', async () => {
    mocks.markNextAction.mockRejectedValueOnce(new Error('No se pudo marcar.'))
    render(
      <LeadNextActionDialog
        open
        firmId="firm-1"
        opportunityId="opportunity-1"
        reference="LD-1"
        onFinish={mocks.onFinish}
      />,
    )

    const form = screen.getByRole('dialog').querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de siguiente acción.')
    fireEvent.submit(form)
    expect(await screen.findByText(/La tarea ya está creada/)).toBeTruthy()
    fireEvent.submit(form)

    await waitFor(() => expect(mocks.onFinish).toHaveBeenCalledOnce())
    expect(mocks.createTask).toHaveBeenCalledOnce()
    expect(mocks.markNextAction).toHaveBeenCalledTimes(2)
  })
})
