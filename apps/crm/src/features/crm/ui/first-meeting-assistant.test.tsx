import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ update: vi.fn(), error: vi.fn() }))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: mocks.error } }))
vi.mock('@/features/crm', () => ({ useRegistrarComunicacionOportunidad: vi.fn() }))
vi.mock('@/features/crm/ui/first-meeting-closing-dialog', () => ({
  FirstMeetingClosingDialog: () => null,
}))
vi.mock('@/features/tareas', () => ({
  useActualizarReunionEspecial: () => ({ mutateAsync: mocks.update, isPending: false }),
  useCrearTarea: () => ({ isPending: false }),
  useMarcarSiguienteAccion: () => ({ isPending: false }),
  useTareasPersistentes: () => ({ data: [] }),
}))

import { FirstMeetingAssistant } from './first-meeting-assistant'

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

function renderAssistant(onStarted: () => void) {
  render(
    <FirstMeetingAssistant
      firmId="firm-1"
      task={{ reunion: { status: 'scheduled', primeraCita: { estado: 'Programada' } } } as never}
      reference="LEAD-1"
      contactName="Cliente"
      canEdit
      onStarted={onStarted}
    />,
  )
}

describe('FirstMeetingAssistant', () => {
  it('abre la primera cita solo después de guardar el inicio', async () => {
    let resolveUpdate: () => void = () => {}
    mocks.update.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve
        }),
    )
    const onStarted = vi.fn()
    renderAssistant(onStarted)
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar primera cita' }))

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ status: 'in_progress' }),
      }),
    )
    expect(onStarted).not.toHaveBeenCalled()
    resolveUpdate()
    await waitFor(() => expect(onStarted).toHaveBeenCalledOnce())
  })

  it('no cambia de pestaña si falla el inicio', async () => {
    mocks.update.mockRejectedValue(new Error('No se pudo guardar'))
    const onStarted = vi.fn()
    renderAssistant(onStarted)
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar primera cita' }))

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('No se pudo guardar', { duration: 10000 }),
    )
    expect(onStarted).not.toHaveBeenCalled()
  })
})
