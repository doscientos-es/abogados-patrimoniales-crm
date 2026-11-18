import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode, RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ mobile: false }))

vi.mock('@tanstack/react-query', () => ({ QueryClientProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('@tanstack/react-router', () => ({
  createRootRouteWithContext: () => (options: object) => ({ options, useRouteContext: () => ({ queryClient: {} }) }),
  useRouterState: ({ select }: { select: (state: object) => unknown }) => select({ location: { pathname: '/' }, status: 'idle' }),
  useRouter: () => ({}),
  Outlet: () => <div>Contenido</div>,
  Link: () => null,
  HeadContent: () => null,
  Scripts: () => null,
}))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }))
vi.mock('@/components/ui/sidebar', () => ({ SidebarProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/features/auth', () => ({ AccessGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: ({ open, onClose, onNavigate, closeButtonRef }: {
    open: boolean; onClose: () => void; onNavigate: () => void; closeButtonRef: RefObject<HTMLButtonElement | null>
  }) => (
    <aside id="navegacion-principal" aria-label="Navegación principal" aria-hidden={!open} inert={!open || undefined}>
      <button ref={closeButtonRef} onClick={onClose}>Ocultar navegación</button>
      <button onClick={onNavigate}>Contactos</button>
    </aside>
  ),
}))

import { Route } from './__root'

const Root = Route.options.component!

afterEach(() => { cleanup(); mocks.mobile = false })

describe('navegación principal', () => {
  it('permite plegar y volver a mostrar la navegación en escritorio', () => {
    render(<Root />)
    const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' })
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Ocultar navegación' }))
    expect(sidebar.getAttribute('aria-hidden')).toBe('true')
    const restore = screen.getAllByRole('button', { name: 'Mostrar navegación' }).find((button) => button.className.includes('absolute'))!
    expect(document.activeElement).toBe(restore)
    fireEvent.click(restore)
    expect(sidebar.getAttribute('aria-hidden')).toBe('false')
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
})