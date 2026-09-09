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

import { PersistentCasesPage } from './persistent-cases-page'

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

describe('PersistentCasesPage', () => {
  it('groups the F3 and F4 subcolumns in one continuous control Kanban', () => {
    render(
      <PersistentCasesPage
        expedientes={[caseworkCase]}
        contactos={[{ id: 'contact-1', nombre: 'Elena Vargas' }] as never}
        miembros={[{ id: 'member-1', nombre: 'Laura García' }] as never}
        tareas={[]}
        actuaciones={[]}
        usuarioId="member-1"
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
    expect(screen.getByRole('heading', { level: 3, name: 'Propuesta o borrador' })).toBeTruthy()
  })

  it('filters the control board through nature tabs', () => {
    render(
      <PersistentCasesPage
        expedientes={[caseworkCase, judicialCase]}
        contactos={[{ id: 'contact-1', nombre: 'Elena Vargas' }] as never}
        miembros={[{ id: 'member-1', nombre: 'Laura García' }] as never}
        tareas={[]}
        actuaciones={[]}
        usuarioId="member-1"
        moving={false}
        onMove={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('tab', { name: 'Todos' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('2 expedientes en la vista actual')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Judicial' }))

    expect(screen.getByRole('tab', { name: 'Judicial' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('1 expediente en la vista actual')).toBeTruthy()
    expect(screen.getByText('EXP-002')).toBeTruthy()
    expect(screen.queryByText('EXP-001')).toBeNull()
  })

  it('applies and removes a quick view', () => {
    render(
      <PersistentCasesPage
        expedientes={[caseworkCase, judicialCase]}
        contactos={[{ id: 'contact-1', nombre: 'Elena Vargas' }] as never}
        miembros={[{ id: 'member-1', nombre: 'Laura García' }] as never}
        tareas={[]}
        actuaciones={[]}
        usuarioId="member-1"
        moving={false}
        onMove={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    fireEvent.change(screen.getByLabelText('Vista rápida'), { target: { value: 'mine' } })

    expect(screen.getByText('1 expediente en la vista actual')).toBeTruthy()
    expect(screen.getByText('Vista:')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Vista: Mis expedientes' }))

    expect(screen.getByText('2 expedientes en la vista actual')).toBeTruthy()
  })
})
