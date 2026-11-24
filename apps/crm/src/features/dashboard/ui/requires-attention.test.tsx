import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isError: false }) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children: ReactNode
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      {...props}
    >
      {children}
    </a>
  ),
}))
vi.mock('@/features/crm', () => ({
  useMiembrosDespacho: () => ({
    data: [
      { id: 'u1', nombre: 'Ana' },
      { id: 'u2', nombre: 'Luis' },
    ],
  }),
}))

import { RequiresAttention } from './requires-attention'

const task = (id: string, assignee: string) =>
  ({
    id,
    expedienteId: null,
    oportunidadId: null,
    titulo: `Tarea ${id}`,
    descripcion: '',
    estado: 'Pendiente',
    venceEn: '2026-01-01T12:00:00Z',
    asignadoId: assignee,
    esSiguienteAccion: true,
  }) as never

afterEach(cleanup)

it('muestra el motivo y enlaza al origen de cada incidencia', () => {
  render(
    <RequiresAttention
      firmId="firm-1"
      userId="u1"
      tasks={[task('1', 'u1')]}
      cases={[]}
      opportunities={[]}
      now={Date.parse('2026-02-01T12:00:00Z')}
    />,
  )
  const link = screen.getByRole('link', { name: /Tarea 1/ })
  expect(link.getAttribute('href')).toBe('/tareas/1')
  expect(within(link).getByText(/Venció el/)).toBeTruthy()
  expect(within(link).getByText(/Ana/)).toBeTruthy()
})

it('conserva los filtros y vuelve a la primera página al cambiarlos', () => {
  const tasks = Array.from({ length: 9 }, (_, index) =>
    task(String(index + 1), index === 0 ? 'u1' : 'u2'),
  )
  render(
    <RequiresAttention
      firmId="firm-1"
      userId="u1"
      tasks={tasks}
      cases={[]}
      opportunities={[]}
      now={Date.parse('2026-02-01T12:00:00Z')}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(screen.getByRole('link', { name: /Tarea 9/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mis tareas' }))
  expect(screen.getByRole('link', { name: /Tarea 1/ })).toBeTruthy()
  expect(screen.queryByRole('link', { name: /Tarea 9/ })).toBeNull()
  fireEvent.change(screen.getByRole('combobox', { name: 'Responsable' }), {
    target: { value: 'u2' },
  })
  expect(screen.getByText('Nada con estos filtros.')).toBeTruthy()
})
