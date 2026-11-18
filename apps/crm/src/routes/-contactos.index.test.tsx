import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userId: 'user-1',
  success: vi.fn(),
  error: vi.fn(),
}))

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

vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: mocks.userId } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/contactos', () => ({
  SATISFACTION_LEVELS: ['Sin valorar', 'Bien'],
  useContactosPaginados: () => ({
    data: {
      count: 1,
      contacts: [
        {
          id: 'contact-1',
          referencia: 'CT-0005',
          nombre: 'Ana',
          apellidos: 'López',
          relacion: 'Cliente',
          tipoPersona: 'Persona física',
          telefono: '600000000',
          email: 'ana@example.test',
          origen: 'Web',
          estado: 'Activo',
          modificado: '01/01/2026',
          profile: { satisfaction: 'Sin valorar' },
        },
      ],
    },
    isPending: false,
    isError: false,
  }),
  useOrígenesContacto: () => ({ data: [] }),
  useActualizarEstadoContacto: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useEliminarContacto: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

import { Route } from './contactos.index'

const ContactosPage = Route.options.component as ComponentType

beforeEach(() => {
  mocks.userId = 'user-1'
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('tabla de contactos', () => {
  it('copia la referencia y comunica tanto el éxito como un fallo', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<ContactosPage />)
    const button = screen.getByRole('button', { name: 'Copiar referencia CT-0005' })
    fireEvent.click(button)
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Referencia copiada.'))
    expect(writeText).toHaveBeenCalledWith('CT-0005')
    fireEvent.click(button)
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('No se pudo copiar la referencia.'),
    )
  })

  it('oculta cabecera y datos, guarda por usuario y permite restablecerlos', async () => {
    const view = render(<ContactosPage />)
    fireEvent.click(screen.getByRole('button', { name: /Columnas/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Origen' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Referencia' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('columnheader', { name: 'Origen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copiar referencia CT-0005' })).toBeNull()
    expect(screen.queryByText('Web')).toBeNull()
    expect(screen.getByRole('link', { name: /Ana López/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir acciones de Ana López' })).toBeTruthy()
    view.unmount()

    mocks.userId = 'user-2'
    const secondUser = render(<ContactosPage />)
    expect(screen.getByRole('columnheader', { name: 'Origen' })).toBeTruthy()
    secondUser.unmount()

    mocks.userId = 'user-1'
    render(<ContactosPage />)
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'Origen' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Columnas/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restablecer' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('columnheader', { name: 'Origen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copiar referencia CT-0005' })).toBeTruthy()
  })

  it('mantiene uniforme la fila y la celda fija, sin fondos extra en los controles', () => {
    render(<ContactosPage />)
    const row = screen.getByRole('link', { name: /Ana López/ }).closest('tr')
    expect(row?.className).toContain('contact-table-row')
    expect(
      within(row as HTMLElement)
        .getByRole('button', { name: 'Abrir acciones de Ana López' })
        .closest('td')?.className,
    ).toContain('contact-table-actions')
    expect(screen.getByRole('link', { name: /Ana López/ }).className).not.toContain('hover:bg')
  })
})
