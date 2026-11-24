import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ complete: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params: _params,
    children,
    ...props
  }: {
    to: string
    params?: unknown
    children: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/contactos', () => ({ useContactos: () => ({ data: [] }) }))
vi.mock('@/features/crm', () => ({
  OPPORTUNITY_STAGE_LABELS: { entry: 'Entrada', lost: 'Perdida' },
  useOportunidades: () => ({
    data: [
      {
        id: 'lead-1',
        referencia: 'OP-1',
        titulo: 'Consulta',
        contactoId: 'contact-1',
        fase: 'entry',
        actualizada: '2026-01-01',
      },
      { id: 'lead-2', fase: 'lost' },
    ],
  }),
}))
vi.mock('@/features/expedientes', () => ({
  useExpedientesPersistentes: () => ({
    data: [
      { id: 'case-1', referencia: 'EX-1', fechaCierre: null },
      { id: 'case-2', referencia: 'EX-2', fechaCierre: '2026-01-01' },
    ],
  }),
  useActuacionesRecientes: () => ({ data: [] }),
}))
vi.mock('@/features/facturacion', () => ({
  formatCurrency: (amount: number) => `${amount} €`,
  useFacturas: () => ({
    data: [
      {
        id: 'invoice-1',
        referencia: 'F-1',
        cliente: 'Cliente',
        estado: 'issued',
        importePendiente: 100,
        moneda: 'EUR',
      },
      { id: 'invoice-2', estado: 'draft', importePendiente: 100 },
    ],
  }),
}))
vi.mock('@/features/onboarding', () => ({ useOnboardings: () => ({ data: [] }) }))
vi.mock('@/features/tareas', () => ({
  useTareasPersistentes: () => ({
    data: [
      {
        id: 'task-1',
        titulo: 'Revisar plazo',
        estado: 'Pendiente',
        tipo: 'Tarea',
        venceEn: '2020-01-01T12:00:00Z',
        critico: false,
      },
      { id: 'task-2', estado: 'Completada' },
    ],
  }),
  useCambiarEstadoTarea: () => ({ isPending: false, mutateAsync: mocks.complete }),
}))
vi.mock('./requires-attention', () => ({ RequiresAttention: () => <div>Requiere atención</div> }))
vi.mock('./pending-handoffs', () => ({ PendingHandoffs: () => <div>Traspasos pendientes</div> }))

import { Dashboard } from './dashboard'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('muestra los totales reales y enlaza cada indicador con su sección', () => {
  render(<Dashboard />)

  const summary = within(screen.getByRole('region', { name: 'Resumen del despacho' }))
  for (const [label, destination] of [
    ['Tareas pendientes', '/tareas'],
    ['Expedientes activos', '/expedientes'],
    ['Oportunidades activas', '/oportunidades'],
    ['Facturas pendientes de cobro', '/facturacion'],
  ]) {
    const link = summary.getByRole('link', { name: `1 ${label}` })
    expect(link.getAttribute('href')).toBe(destination)
  }
})

it('mantiene la acción de completar una tarea prioritaria', async () => {
  render(<Dashboard />)
  fireEvent.click(screen.getByRole('button', { name: 'Completar' }))
  await waitFor(() =>
    expect(mocks.complete).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: 'task-1' }),
      estado: 'Completada',
    }),
  )
})
