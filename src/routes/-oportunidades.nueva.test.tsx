import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { contactId: 'contact-1' },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => mocks.search }),
  Link: ({
    children,
    to,
    ...props
  }: { children: ReactNode; to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
}))

vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [] }) }))
vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))
vi.mock('@/features/contactos', () => ({
  useContactos: () => ({
    data: [{ id: 'contact-1', nombre: 'Ana', apellidos: 'López' }],
    isPending: false,
  }),
}))
vi.mock('@/features/crm', () => ({ useCrearOportunidad: () => ({ isPending: false }) }))
vi.mock('@/features/notas', () => ({ useCrearNotaOportunidad: () => ({ isPending: false }) }))
vi.mock('@/features/tareas', () => ({ useCrearTarea: () => ({ isPending: false }) }))

import { NuevaOportunidadPage } from './oportunidades.nueva'

afterEach(() => {
  cleanup()
  mocks.navigate.mockClear()
  mocks.search = { contactId: 'contact-1' }
})

describe('NuevaOportunidadPage', () => {
  it('preselecciona el contacto indicado al abrir el formulario', async () => {
    render(<NuevaOportunidadPage />)

    await waitFor(() =>
      expect((screen.getByLabelText('Contacto principal') as HTMLInputElement).value).toBe(
        'Ana López',
      ),
    )
    expect((screen.getByRole('button', { name: 'Crear Lead' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })
})
