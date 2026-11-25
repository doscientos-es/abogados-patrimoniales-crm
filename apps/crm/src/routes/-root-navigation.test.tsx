import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode, RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mobile: false,
  pathname: '/',
  getToasts: vi.fn(() => [] as Array<{ id: string; type: string; action?: object }>),
  dismiss: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { getToasts: mocks.getToasts, dismiss: mocks.dismiss } }))

vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@tanstack/react-router', () => ({
  createRootRouteWithContext: () => (options: object) => ({
    options,
    useRouteContext: () => ({ queryClient: {} }),
  }),
  useRouterState: ({ select }: { select: (state: object) => unknown }) =>
    select({ location: { pathname: mocks.pathname }, status: 'idle' }),
  useRouter: () => ({}),
  Outlet: () => <div>Contenido</div>,
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  HeadContent: () => null,
  Scripts: () => null,
}))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }))
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/features/auth', () => ({
  AccessGate: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/features/search', () => ({
  GlobalSearch: ({
    open,
    onOpenChange,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <dialog open aria-label="Buscar en LEX">
        <button onClick={() => onOpenChange(false)}>Cerrar búsqueda</button>
      </dialog>
    ) : null,
}))
vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: ({
    open,
    collapsed,
    isMobile,
    onClose,
    onNavigate,
    closeButtonRef,
  }: {
    open: boolean
    collapsed: boolean
    isMobile: boolean
    onClose: () => void
    onNavigate: () => void
    closeButtonRef: RefObject<HTMLButtonElement | null>
  }) => (
    <aside
      id="navegacion-principal"
      aria-label="Navegación principal"
      aria-hidden={!open}
      inert={!open || undefined}
      data-collapsed={collapsed}
    >
      <button ref={closeButtonRef} aria-expanded={isMobile ? open : !collapsed} onClick={onClose}>
        {isMobile
          ? 'Ocultar navegación'
          : collapsed
            ? 'Expandir navegación'
            : 'Contraer navegación'}
      </button>
      <button onClick={onNavigate}>Contactos</button>
    </aside>
  ),
}))

import { Route } from './__root'

const Root = Route.options.component
if (!Root) throw new Error('Falta el componente raíz')

afterEach(() => {
  cleanup()
  mocks.mobile = false
  mocks.pathname = '/'
  mocks.getToasts.mockReset().mockReturnValue([])
  mocks.dismiss.mockReset()
})

describe('navegación principal', () => {
  it('cierra confirmaciones al cambiar de página sin ocultar errores ni acciones', () => {
    mocks.getToasts.mockReturnValue([
      { id: 'success', type: 'success' },
      { id: 'error', type: 'error' },
      { id: 'warning', type: 'warning' },
      { id: 'action', type: 'success', action: {} },
    ])
    const { rerender } = render(<Root />)
    expect(mocks.getToasts).not.toHaveBeenCalled()
    rerender(<Root />)
    expect(mocks.dismiss).not.toHaveBeenCalled()
    mocks.pathname = '/contactos'
    rerender(<Root />)
    expect(mocks.dismiss).toHaveBeenCalledOnce()
    expect(mocks.dismiss).toHaveBeenCalledWith('success')
  })

  it('permite plegar y volver a mostrar la navegación en escritorio', () => {
    render(<Root />)
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' })
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Contraer navegación' }))
    expect(sidebar.getAttribute('aria-hidden')).toBe('false')
    expect(sidebar.getAttribute('data-collapsed')).toBe('true')
    expect(within(sidebar).getByRole('button', { name: 'Contactos' })).toBeTruthy()
    const expand = within(sidebar).getByRole('button', { name: 'Expandir navegación' })
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(expand)
    expect(sidebar.getAttribute('data-collapsed')).toBe('false')
    expect(
      within(sidebar)
        .getByRole('button', { name: 'Contraer navegación' })
        .getAttribute('aria-expanded'),
    ).toBe('true')
  })

  it('abre y cierra la navegación móvil, devuelve el foco y la cierra al navegar', () => {
    mocks.mobile = true
    render(<Root />)
    const trigger = screen.getByRole('button', { name: 'Mostrar navegación' })
    fireEvent.click(trigger)
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' })
    const close = within(sidebar).getByRole('button', { name: 'Ocultar navegación' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(sidebar.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger)
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Contactos' }))
    expect(sidebar.getAttribute('aria-hidden')).toBe('true')
  })

  it('ofrece cuatro accesos móviles y abre la búsqueda aunque el menú esté cerrado', () => {
    mocks.mobile = true
    mocks.pathname = '/expedientes/123'
    render(<Root />)
    const nav = screen.getByRole('navigation', { name: 'Navegación móvil' })
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    expect(
      within(nav).getByRole('link', { name: 'Expedientes' }).getAttribute('aria-current'),
    ).toBe('page')
    expect(
      within(nav).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current'),
    ).toBeNull()
    fireEvent.click(within(nav).getByRole('button', { name: 'Buscar en LEX' }))
    expect(screen.getByRole('dialog', { name: 'Buscar en LEX' })).toBeTruthy()
    expect(
      within(nav).getByRole('button', { name: 'Buscar en LEX' }).getAttribute('aria-expanded'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar búsqueda' }))
    expect(screen.queryByRole('dialog', { name: 'Buscar en LEX' })).toBeNull()
  })
})
