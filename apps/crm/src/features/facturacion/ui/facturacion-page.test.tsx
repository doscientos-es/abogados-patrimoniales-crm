import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as FacturacionApplication from '@/features/facturacion/application'

const mocks = vi.hoisted(() => ({ cases: [] as unknown[] }))

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
  useContactos: () => ({
    data: [{ id: 'contact-1', nombre: 'Ana', apellidos: 'López', razonSocial: null }],
    isPending: false,
    isError: false,
  }),
}))

vi.mock('@/features/expedientes', () => ({
  useExpedientesPersistentes: () => ({ data: mocks.cases, isPending: false, isError: false }),
}))

vi.mock('@/features/onboarding', () => ({
  useOnboardings: () => ({ data: [], isPending: false, isError: false }),
}))

vi.mock('@/features/facturacion/application', async (importOriginal) => {
  const actual = await importOriginal<typeof FacturacionApplication>()
  return {
    ...actual,
    useFacturas: () => ({ data: [], isLoading: false, isError: false }),
    useGuardarBorradorFactura: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useEmitirFactura: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useDescartarBorradorFactura: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useRegistrarCobroFactura: () => ({ isPending: false, mutateAsync: vi.fn() }),
    useRectificarFactura: () => ({ isPending: false, mutateAsync: vi.fn() }),
  }
})

import { FacturacionPage } from './facturacion-page'

afterEach(() => {
  cleanup()
  mocks.cases = []
})

describe('FacturacionPage', () => {
  it('explains the draft-to-collection workflow and opens the invoice draft form', () => {
    mocks.cases = [
      {
        id: 'case-1',
        referencia: 'EXP-001',
        titulo: 'Herencia de Ana',
        fechaCierre: null,
        contactoPrincipalId: 'contact-1',
      },
    ]
    render(<FacturacionPage />)

    expect(screen.getByRole('heading', { name: '¿Dónde y cómo se crea una factura?' })).toBeTruthy()
    expect(screen.getByText(/El borrador todavía no está emitido/)).toBeTruthy()
    expect(screen.getByText(/Revisa y emite para asignar numeración fiscal/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Crear factura' }))
    expect(screen.getByRole('heading', { name: 'Crear borrador de factura' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeTruthy()
  })

  it('explains why invoice creation is unavailable when there are no open cases', () => {
    render(<FacturacionPage />)

    expect(
      (screen.getByRole('button', { name: 'Crear factura' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      screen.getByText(/No hay expedientes abiertos con contacto principal/).textContent,
    ).toContain('vincula un contacto para poder crear una factura.')
  })
})
