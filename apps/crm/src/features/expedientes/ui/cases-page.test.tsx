import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params: _params,
    children,
    ...props
  }: { to: string; params?: unknown } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

import { CasesPage } from './cases-page'

const caseworkCase = {
  id: 'casework-1',
  referencia: 'EXP-001',
  contactoPrincipalId: 'contact-1',
  titulo: 'Planificación sucesoria',
  area: 'Sucesiones',
  naturaleza: 'Extrajudicial',
  estadoGeneral: 'active',
  fase: 'Diagnóstico – Objetivos – Estrategia',
  estadoOperativo: 'pending',
  prioridad: 'Media',
  asignadoId: 'member-2',
  proximaAccion: '',
  actualizadoEn: '2026-09-08T10:00:00Z',
} as never

const judicialCase = {
  id: 'judicial-1',
  referencia: 'EXP-002',
  contactoPrincipalId: 'contact-1',
  titulo: 'Reclamación de legítima',
  area: 'Sucesiones',
  naturaleza: 'Judicial',
  estadoGeneral: 'active',
  fase: 'Diagnóstico – Objetivos – Estrategia',
  estadoOperativo: 'pending',
  prioridad: 'Media',
  asignadoId: 'member-1',
  proximaAccion: '',
  actualizadoEn: '2026-09-08T10:00:00Z',
} as never

afterEach(cleanup)

describe('CasesPage', () => {
  it('groups the F3 and F4 subcolumns in one continuous control Kanban', () => {
    render(
      <CasesPage
        expedientes={[caseworkCase]}
        contactos={[{ id: 'contact-1', nombre: 'Elena Vargas' }] as never}
        miembros={[{ id: 'member-1', nombre: 'Laura García' }] as never}
        tareas={[]}
        actuaciones={[]}
        moving={false}
        onMove={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const board = screen.getByLabelText('Kanban de control de expedientes')
    expect(board.querySelector('div')?.className).toContain('grid-cols-5')
    expect(screen.getByRole('heading', { level: 2, name: 'F3 · CASEWORK' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'F4 · DELIVERY' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Diagnóstico – Objetivos – Estrategia' }),
    ).toBeTruthy()
    const caseCard = screen.getByText('Planificación sucesoria').closest('[draggable="true"]')
    expect(caseCard).toBeTruthy()
    expect(caseCard?.textContent).not.toContain('Diagnóstico – Objetivos – Estrategia')
    expect(screen.getByRole('heading', { level: 3, name: 'Propuesta o borrador' })).toBeTruthy()
    expect(screen.queryByLabelText('Mover EXP-001 a otra fase')).toBeNull()
    expect(screen.queryByLabelText('Vista rápida')).toBeNull()
    expect(screen.queryByText('1 expediente en la vista actual')).toBeNull()
    expect(
      screen.queryByText('Trabajo técnico, decisión, preparación y seguimiento activo.'),
    ).toBeNull()
    expect(screen.queryByText('Propuesta, entrega y formalización.')).toBeNull()
    expect(screen.queryByText('Trabajo técnico del expediente.')).toBeNull()
    expect(screen.queryByText('Entrega, propuesta y formalización.')).toBeNull()
  })

  it('filters the control board through nature tabs', () => {
    render(
      <CasesPage
        expedientes={[caseworkCase, judicialCase]}
        contactos={[{ id: 'contact-1', nombre: 'Elena Vargas' }] as never}
        miembros={[{ id: 'member-1', nombre: 'Laura García' }] as never}
        tareas={[]}
        actuaciones={[]}
        moving={false}
        onMove={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('tab', { name: /^Todos/ }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('tab', { name: /^Judicial/ }))

    expect(screen.getByRole('tab', { name: /^Judicial/ }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.getByText('EXP-002')).toBeTruthy()
    expect(screen.queryByText('EXP-001')).toBeNull()
  })

  it('applies a detailed filter from the filter panel', () => {
    render(
      <CasesPage
        expedientes={[caseworkCase, judicialCase]}
        contactos={[{ id: 'contact-1', nombre: 'Elena Vargas' }] as never}
        miembros={[{ id: 'member-1', nombre: 'Laura García' }] as never}
        tareas={[]}
        actuaciones={[]}
        moving={false}
        onMove={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    expect(screen.getByText('Filtros de expedientes')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Filtrar por responsable'), {
      target: { value: 'member-1' },
    })

    expect(screen.getByText('EXP-002')).toBeTruthy()
    expect(screen.queryByText('EXP-001')).toBeNull()
    expect(screen.getByText('1 activos')).toBeTruthy()
  })

  it('labels the stored status in the filter without changing its value', () => {
    render(
      <CasesPage
        expedientes={[caseworkCase]}
        contactos={[]}
        miembros={[]}
        tareas={[]}
        actuaciones={[]}
        moving={false}
        onMove={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const status = screen.getByLabelText('Filtrar por estado')
    expect(screen.getByRole('option', { name: 'Activo' }).getAttribute('value')).toBe('active')
    fireEvent.change(status, { target: { value: 'active' } })
    expect(screen.getByText('EXP-001')).toBeTruthy()
    expect(screen.getByLabelText('Quitar filtro Estado: Activo')).toBeTruthy()
  })

  it('shows the open next task instead of the stale case text and updates when it completes', () => {
    const item = { ...(caseworkCase as object), proximaAccion: 'Acción antigua' } as never
    const tasks = [
      {
        expedienteId: 'casework-1',
        titulo: 'Tarea completada',
        estado: 'Completada',
        esSiguienteAccion: true,
      },
      {
        expedienteId: 'other',
        titulo: 'Otro expediente',
        estado: 'Pendiente',
        esSiguienteAccion: true,
      },
      {
        expedienteId: 'casework-1',
        titulo: 'Continuación',
        estado: 'Pendiente',
        esSiguienteAccion: true,
      },
    ] as never[]
    const page = (tareas: never[]) => (
      <CasesPage
        expedientes={[item]}
        contactos={[]}
        miembros={[]}
        tareas={tareas}
        actuaciones={[]}
        moving={false}
        onMove={vi.fn()}
      />
    )
    const { rerender } = render(page(tasks))
    expect(screen.getByText('Continuación')).toBeTruthy()
    expect(screen.queryByText('Acción antigua')).toBeNull()
    rerender(page(tasks.slice(0, 2)))
    expect(screen.getByText('Sin próxima acción definida')).toBeTruthy()
  })

  it('advances a case to the next control phase from its card', () => {
    const onMove = vi.fn().mockResolvedValue(undefined)
    render(
      <CasesPage
        expedientes={[caseworkCase]}
        contactos={[{ id: 'contact-1', nombre: 'Elena Vargas' }] as never}
        miembros={[{ id: 'member-1', nombre: 'Laura García' }] as never}
        tareas={[]}
        actuaciones={[]}
        moving={false}
        onMove={onMove}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Avanzar' }))

    expect(onMove).toHaveBeenCalledWith(caseworkCase, 'Revisión y decisión')
  })
})
