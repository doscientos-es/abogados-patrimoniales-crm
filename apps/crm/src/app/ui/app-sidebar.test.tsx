import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef, forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => '/contactos',
  Link: forwardRef<HTMLAnchorElement, { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>>(
    ({ to, children, ...props }, ref) => <a ref={ref} href={to} {...props}>{children}</a>,
  ),
}))
vi.mock('@/features/auth', () => ({ AccountMenu: () => <button>Cuenta</button> }))
vi.mock('@/features/search', () => ({ GlobalSearch: () => <button>Buscar</button> }))
vi.mock('@/features/tareas/ui/task-notifications-bell', () => ({ TaskNotificationsBell: () => <button>Avisos</button> }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))

import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'

afterEach(cleanup)

it('sitúa búsqueda arriba y cuenta, calendario y avisos en el pie', () => {
  const onNavigate = vi.fn()
  render(<SidebarProvider><AppSidebar open onClose={vi.fn()} onNavigate={onNavigate} closeButtonRef={createRef()} /></SidebarProvider>)
  const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' })
  const header = sidebar.querySelector('[data-sidebar="header"]') as HTMLElement
  const footer = sidebar.querySelector('[data-sidebar="footer"]') as HTMLElement
  expect(within(header).getByRole('button', { name: 'Buscar' })).toBeTruthy()
  expect(within(footer).getByRole('button', { name: 'Cuenta' })).toBeTruthy()
  expect(within(footer).getByRole('button', { name: 'Avisos' })).toBeTruthy()
  const calendar = within(footer).getByRole('link', { name: 'Abrir calendario' })
  expect(calendar.getAttribute('href')).toBe('/calendario')
  fireEvent.click(calendar)
  expect(onNavigate).toHaveBeenCalledOnce()
})