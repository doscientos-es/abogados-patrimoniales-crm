import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Suspense, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ contacts: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  createFileRoute: () => (options: object) => ({ options }),
  Link: ({
    children,
    to,
    params: _params,
    ...props
  }: {
    children: ReactNode
    to: string
    params?: unknown
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/contactos', () => ({
  SATISFACTION_LEVELS: ['Sin valorar', 'Bien'],
  useContactosPaginados: mocks.contacts,
  useOrígenesContacto: () => ({ data: [] }),
  useActualizarEstadoContacto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useEliminarContacto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

import { Route } from './contactos.index'

const ContactosPage = Route.options.component as ComponentType

beforeEach(() => {
  window.localStorage.clear()
  mocks.contacts.mockReturnValue({
    data: { count: 0, contacts: [] },
    isPending: false,
    isError: false,
  })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('configura columnas desde la cabecera y conserva la preferencia', async () => {
  await act(async () => {
    render(
      <Suspense fallback="Cargando">
        <ContactosPage />
      </Suspense>,
    )
  })
  const trigger = await screen.findByRole(
    'button',
    { name: 'Columnas visibles' },
    { timeout: 15000 },
  )
  expect(trigger.closest('th')).toBeTruthy()
  expect(trigger.textContent).toBe('')
  fireEvent.click(trigger)
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Origen' }))
  expect(window.localStorage.getItem('lex:contact-columns:user-1')).toBe('["source"]')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByRole('columnheader', { name: 'Origen' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Columnas visibles (1 ocultas)' })).toBeTruthy()
})

it('muestra el valor de orden sin el prefijo y permite cambiarlo', async () => {
  await act(async () => {
    render(
      <Suspense fallback="Cargando">
        <ContactosPage />
      </Suspense>,
    )
  })
  await screen.findByRole('button', { name: 'Columnas visibles' }, { timeout: 15000 })
  const sort = screen.getByLabelText('Ordenar contactos')
  expect(sort.textContent).toContain('Nombre')
  expect(sort.textContent).not.toContain('Ordenar')
  fireEvent.click(sort)
  fireEvent.click(await screen.findByRole('option', { name: 'Fecha de alta' }))
  await waitFor(() =>
    expect(mocks.contacts).toHaveBeenLastCalledWith(
      'firm-1',
      expect.objectContaining({ sortBy: 'created' }),
    ),
  )
})
