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

import { PersistentPipelineBoard } from './persistent-pipeline-board'

const opportunity = {
  id: 'lead-1',
  referencia: 'OP-0001',
  contactoId: 'contact-1',
  titulo: 'Planificación patrimonial familiar',
  area: 'Sucesiones',
  fase: 'entry' as const,
  subestado: 'Pendiente de revisar',
  prioridad: 'Alta' as const,
  estadoOperativo: 'Requiere contacto',
  origen: 'Formulario web',
  creada: '2026-09-01T10:00:00Z',
  actualizada: '2026-09-08T10:00:00Z',
  asignadoId: null,
}

afterEach(cleanup)

describe('PersistentPipelineBoard', () => {
  it('presents the Lead details in its color-coded stage and preserves advancing', () => {
    const onAdvance = vi.fn().mockResolvedValue(undefined)
    render(
      <PersistentPipelineBoard
        oportunidades={[opportunity]}
        contactosPorId={new Map([['contact-1', 'Elena Vargas']])}
        isPending={false}
        onAdvance={onAdvance}
      />,
    )

    const entryColumn = screen.getByText('Entrada').closest('.fase-columna')
    expect(screen.getByLabelText('Pipeline de Leads').querySelector('div')?.className).toContain(
      'grid-flow-col',
    )
    expect(entryColumn?.className).toContain('fase-azul')
    expect(entryColumn?.className).toContain('h-full')
    expect(screen.getByText('OP-0001').closest('article')?.className).toContain('fase-tarjeta')
    expect(screen.getByText('Elena Vargas')).toBeTruthy()
    expect(screen.getByText('Sucesiones')).toBeTruthy()
    expect(screen.getByText(/origen:/i).textContent).toContain('Formulario web')

    fireEvent.click(screen.getByRole('button', { name: /avanzar op-0001 a cualificación/i }))
    expect(onAdvance).toHaveBeenCalledWith(opportunity, 'qualification')
  })
})
