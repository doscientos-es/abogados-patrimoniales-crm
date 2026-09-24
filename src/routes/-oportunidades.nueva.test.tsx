import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { contactId: 'contact-1' },
  createOpportunity: vi.fn(),
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
vi.mock('@/features/crm', () => ({
  useCrearOportunidad: () => ({ isPending: false, mutateAsync: mocks.createOpportunity }),
  useMiembrosDespacho: () => ({ data: [] }),
}))
vi.mock('@/features/notas', () => ({ useCrearNotaOportunidad: () => ({ isPending: false }) }))
vi.mock('@/features/tareas', () => ({
  useCrearTarea: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useMarcarSiguienteAccion: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

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

  it('pregunta por la siguiente acción tras guardar y permite continuar a la ficha', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), {
      target: { value: 'Consulta inicial' },
    })

    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)

    expect(await screen.findByText(/El Lead LD-1 ya está guardado/)).toBeTruthy()
    expect(mocks.navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no procede' }))

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/oportunidades/$id',
        params: { id: 'opportunity-1' },
      }),
    )
  })
})
