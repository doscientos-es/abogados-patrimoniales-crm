import { readFileSync } from 'node:fs'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef, forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => '/contactos',
  Link: forwardRef<
    HTMLAnchorElement,
    { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>
  >(({ to, children, ...props }, ref) => (
    <a ref={ref} href={to} {...props}>
      {children}
    </a>
  )),
}))
vi.mock('@/features/auth', () => ({
  AccountMenu: ({ compact }: { compact: boolean }) => (
    <button data-compact={compact}>Cuenta</button>
  ),
}))
vi.mock('@/features/search', () => ({
  GlobalSearchTrigger: ({ onOpen, compact }: { onOpen: () => void; compact: boolean }) => (
    <button data-compact={compact} onClick={onOpen}>
      Buscar
    </button>
  ),
}))
vi.mock('@/features/tareas/ui/task-notifications-bell', () => ({
  TaskNotificationsBell: () => <button>Avisos</button>,
}))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))

import { SidebarProvider } from '@/components/ui/sidebar'

import { AppSidebar } from './app-sidebar'

afterEach(cleanup)

it('sitúa búsqueda arriba y cuenta, calendario y avisos en el pie', () => {
  const onNavigate = vi.fn()
  render(
    <SidebarProvider>
      <AppSidebar
        open
        collapsed={false}
        isMobile={false}
        onClose={vi.fn()}
        onNavigate={onNavigate}
        onOpenSearch={vi.fn()}
        closeButtonRef={createRef()}
      />
    </SidebarProvider>,
  )
  const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' })
  expect(sidebar.className).toContain('app-sidebar')
  const header = sidebar.querySelector('[data-sidebar="header"]') as HTMLElement
  const footer = sidebar.querySelector('[data-sidebar="footer"]') as HTMLElement
  expect(within(header).getByRole('button', { name: 'Buscar' })).toBeTruthy()
  const navigation = within(sidebar).getByRole('navigation', { name: 'Secciones' })
  const contacts = within(navigation).getByRole('link', { name: 'Contactos' })
  expect(contacts.getAttribute('aria-current')).toBe('page')
  expect(
    within(navigation).getByRole('link', { name: 'Expedientes' }).getAttribute('aria-current'),
  ).toBeNull()
  fireEvent.click(contacts)
  expect(onNavigate).toHaveBeenCalledOnce()
  expect(within(footer).getByRole('button', { name: 'Cuenta' })).toBeTruthy()
  expect(within(footer).getByRole('button', { name: 'Avisos' })).toBeTruthy()
  const calendar = within(footer).getByRole('link', { name: 'Abrir calendario' })
  expect(calendar.getAttribute('href')).toBe('/calendario')
  fireEvent.click(calendar)
  expect(onNavigate).toHaveBeenCalledTimes(2)
})

it('mantiene accesibles las secciones, la búsqueda y el pie en modo compacto', () => {
  const onClose = vi.fn()
  const onOpenSearch = vi.fn()
  const { rerender } = render(
    <SidebarProvider>
      <AppSidebar
        open
        collapsed
        isMobile={false}
        onClose={onClose}
        onNavigate={vi.fn()}
        onOpenSearch={onOpenSearch}
        closeButtonRef={createRef()}
      />
    </SidebarProvider>,
  )
  const sidebar = screen.getByRole('complementary', { name: 'Navegación principal' })
  expect(sidebar.getAttribute('data-collapsed')).toBe('true')
  expect(sidebar.getAttribute('aria-hidden')).toBe('false')
  const contacts = within(sidebar).getByRole('link', { name: 'Contactos' })
  expect(contacts.getAttribute('title')).toBe('Contactos')
  expect(contacts.getAttribute('aria-current')).toBe('page')
  expect(within(sidebar).getByRole('link', { name: 'Facturación y cobros' })).toBeTruthy()
  expect(within(sidebar).getByRole('link', { name: 'Abrir calendario' })).toBeTruthy()
  expect(within(sidebar).getByRole('button', { name: 'Cuenta' }).getAttribute('data-compact')).toBe(
    'true',
  )
  expect(within(sidebar).getByRole('button', { name: 'Avisos' })).toBeTruthy()
  fireEvent.click(within(sidebar).getByRole('button', { name: 'Buscar' }))
  expect(onOpenSearch).toHaveBeenCalledOnce()
  fireEvent.click(within(sidebar).getByRole('button', { name: 'Expandir navegación' }))
  expect(onClose).toHaveBeenCalledOnce()
  rerender(
    <SidebarProvider>
      <AppSidebar
        open
        collapsed={false}
        isMobile
        onClose={onClose}
        onNavigate={vi.fn()}
        onOpenSearch={onOpenSearch}
        closeButtonRef={createRef()}
      />
    </SidebarProvider>,
  )
  expect(within(sidebar).getByRole('button', { name: 'Ocultar navegación' })).toBeTruthy()
  expect(within(sidebar).getByRole('link', { name: 'Contactos' }).getAttribute('title')).toBeNull()
})

it('mantiene el menú superpuesto en móvil y dentro del layout en escritorio', () => {
  const css = readFileSync('src/styles.css', 'utf8')
  expect(css).toMatch(/\.app-shell \.app-sidebar\s*\{\s*position:\s*fixed;/)
  expect(css).toMatch(
    /@media\s*\(min-width:\s*48rem\)\s*\{\s*\.app-shell \.app-sidebar\s*\{\s*position:\s*relative;/,
  )
  expect(css).toMatch(/\.app-shell \.app-mobile-header\s*\{\s*display:\s*none;/)
})
