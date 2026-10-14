import { cleanup, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to = '/',
    params: _params,
    search: _search,
    children,
    ...props
  }: {
    to?: string
    params?: unknown
    search?: unknown
    children: ReactNode
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))

vi.mock('@/features/contactos', () => ({
  useContactos: () => ({ data: [], isPending: false, isError: false }),
}))

vi.mock('@/features/crm', () => ({
  useOportunidadesCompletas: () => ({ data: [], isPending: false, isError: false }),
}))

vi.mock('@/features/onboarding', () => ({
  useOnboardings: () => ({ data: [], isPending: false, isError: false }),
}))

import { QuotesPage } from './quotes-page'

afterEach(cleanup)

describe('QuotesPage', () => {
  it('explains the Lead quote, external-send, and acceptance workflow', () => {
    render(<QuotesPage />)

    expect(
      screen.getByRole('heading', { name: '¿Cómo se prepara y envía un presupuesto?' }),
    ).toBeTruthy()
    expect(screen.getByText(/En su ficha, entra en «Presupuesto»/)).toBeTruthy()
    expect(
      screen.getByText(/«Envío» para descargar el PDF y registrar el envío externo/),
    ).toBeTruthy()
    expect(screen.getByText(/«Aceptación» para registrar la respuesta del cliente/)).toBeTruthy()
    expect(screen.getByText(/El correo no se envía automáticamente desde LEX/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Crear Lead para presupuestar' }).getAttribute('href'),
    ).toBe('/oportunidades/nueva')
    expect(screen.getByRole('link', { name: 'Ver Leads' }).getAttribute('href')).toBe(
      '/oportunidades',
    )
  })
})
