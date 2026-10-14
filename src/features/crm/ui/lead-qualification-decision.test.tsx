import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tasks: [] as unknown[],
  save: vi.fn().mockResolvedValue({}),
  transition: vi.fn().mockResolvedValue({}),
  createTask: vi.fn().mockResolvedValue({ id: 'task-new' }),
  markNext: vi.fn().mockResolvedValue({}),
  advance: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/features/crm/infrastructure/supabase-oportunidades', () => ({
  useActualizarDetallesOportunidad: () => ({ isPending: false, mutateAsync: mocks.save }),
  useTransicionarOportunidad: () => ({ isPending: false, mutateAsync: mocks.transition }),
  useMiembrosDespacho: () => ({
    data: [
      { id: 'u-jon', nombre: 'Jon' },
      { id: 'u-igor', nombre: 'Igor' },
    ],
  }),
  useAvanzarLeadPorHito: () => ({ isPending: false, mutateAsync: mocks.advance }),
}))
vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({ data: mocks.tasks, isPending: false }),
  useCrearTarea: () => ({ isPending: false, mutateAsync: mocks.createTask }),
  useMarcarSiguienteAccion: () => ({ isPending: false, mutateAsync: mocks.markNext }),
}))

import { LeadQualificationDecision } from './lead-qualification-decision'

const lead = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'op-1',
    version: 4,
    fase: 'first_meeting',
    archivadoEn: null,
    asignadoId: null,
    titulo: 'Herencia familia Pérez',
    detalles: { resultadoCualificacion: 'previo' },
    ...extra,
  }) as never

afterEach(() => {
  cleanup()
  mocks.tasks = []
  for (const mock of [
    mocks.save,
    mocks.transition,
    mocks.createTask,
    mocks.markNext,
    mocks.advance,
  ])
    mock.mockClear()
})

describe('Cualificación · decisión del despacho', () => {
  it('presenta las decisiones nuevas en lugar de los campos comerciales anteriores', () => {
    render(<LeadQualificationDecision firmId="f" opportunity={lead()} canEdit />)
    for (const label of [
      'Cliente no continúa',
      'Pendiente del cliente',
      'En análisis por el despacho',
      'No atendible por el despacho',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeTruthy()
    }
    expect(screen.queryByText('Probabilidad de conversión')).toBeNull()
  })

  it('registra motivo y cierra el Lead cuando el cliente no continúa', async () => {
    render(<LeadQualificationDecision firmId="f" opportunity={lead()} canEdit />)
    fireEvent.click(screen.getByRole('button', { name: /Cliente no continúa/i }))
    fireEvent.change(screen.getByLabelText('Motivo *'), {
      target: { value: 'Ha elegido otro profesional' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Cerrar Lead · Cliente no continúa/i }))
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledOnce())
    expect(mocks.transition.mock.calls[0]?.[0]).toMatchObject({ id: 'op-1', fase: 'lost' })
    expect(mocks.save.mock.calls[0]?.[0].detalles).toMatchObject({
      resultadoCualificacion: 'previo',
      decisionCualificacion: { tipo: 'cliente_no_continua', motivo: 'Ha elegido otro profesional' },
    })
    expect(mocks.createTask).not.toHaveBeenCalled()
  })

  it('crea y marca como siguiente acción la tarea de preparar presupuesto', async () => {
    const onOpenQuote = vi.fn()
    render(
      <LeadQualificationDecision
        firmId="f"
        opportunity={lead()}
        canEdit
        currentUserId="u-igor"
        onOpenQuote={onOpenQuote}
      />,
    )
    fireEvent.click(screen.getByTestId('decision-presupuesto'))
    fireEvent.change(screen.getByLabelText('Responsable de preparación *'), {
      target: { value: 'u-igor' },
    })
    fireEvent.change(screen.getByLabelText('Fecha objetivo *'), { target: { value: '2026-11-12' } })
    fireEvent.change(screen.getByLabelText('Instrucciones del abogado para el presupuesto'), {
      target: { value: 'Fases separadas' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y asignar preparación →' }))
    await waitFor(() => expect(onOpenQuote).toHaveBeenCalledOnce())
    expect(mocks.createTask.mock.calls[0]?.[0]).toMatchObject({
      oportunidadId: 'op-1',
      titulo: 'PREPARAR PRESUPUESTO',
      asignadoId: 'u-igor',
      descripcion: expect.stringContaining('Fases separadas'),
    })
    expect(mocks.markNext).toHaveBeenCalledWith({ task: { id: 'task-new' }, enabled: true })
    expect(mocks.save.mock.calls[0]?.[0].detalles.decisionCualificacion).toMatchObject({
      tipo: 'preparar_presupuesto',
      motivo: 'Herencia familia Pérez',
      tareaId: 'task-new',
    })
    expect(mocks.transition).not.toHaveBeenCalled()
  })
})
