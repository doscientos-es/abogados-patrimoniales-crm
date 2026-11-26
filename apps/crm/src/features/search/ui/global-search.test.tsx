import { readFileSync } from 'node:fs'

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useSearch: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ navigate: mocks.navigate }) }))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' } }),
}))
vi.mock('../infrastructure/supabase-global-search', () => ({
  useGlobalSearch: mocks.useSearch,
}))

import { GlobalSearch, GlobalSearchTrigger } from './global-search'

function SearchHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <GlobalSearchTrigger onOpen={() => setOpen(true)} />
      <GlobalSearch open={open} onOpenChange={setOpen} />
    </>
  )
}

afterEach(() => {
  cleanup()
  mocks.navigate.mockClear()
  mocks.useSearch.mockReturnValue({ data: [], isPending: false, isError: false })
  window.localStorage.clear()
})

describe('GlobalSearch', () => {
  it('opens search from the compact icon', () => {
    const onOpen = vi.fn()
    render(<GlobalSearchTrigger compact onOpen={onOpen} />)
    const trigger = screen.getByRole('button', { name: 'Buscar en LEX' })
    expect(trigger.parentElement?.getAttribute('title')).toBe('Buscar en LEX')
    fireEvent.click(trigger)
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('opens from the sidebar search button and focuses the search field', async () => {
    render(<SearchHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en LEX' }))
    const dialog = screen.getByRole('dialog', { name: 'Buscar en LEX' })
    expect(dialog.className).toContain('global-search-dialog')
    const input = within(dialog).getByRole('textbox', { name: 'Buscar en todo LEX' })
    await waitFor(() => expect(document.activeElement).toBe(input))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar diálogo' }))
    expect(screen.queryByRole('dialog', { name: 'Buscar en LEX' })).toBeNull()
  })

  it('uses a content-sized desktop dialog and keeps results scrollable', () => {
    const css = readFileSync('src/styles.css', 'utf8')
    expect(css).toMatch(/\.global-search-dialog\s*\{[^}]*height:\s*100dvh/s)
    expect(css).toMatch(
      /@media\s*\(min-width:\s*48rem\)\s*\{\s*\.global-search-dialog\s*\{[^}]*height:\s*auto/s,
    )
    expect(css).toMatch(/\.global-search-results\s*\{\s*max-height:\s*min\(60dvh, 30rem\)/)
    render(<SearchHarness />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(
      screen.getByText('↑↓ para navegar · ↵ para abrir').closest('footer')?.className,
    ).toContain('global-search-footer')
  })

  it('opens with Ctrl+K, focuses the field and saves a selected module as a recent item', async () => {
    render(<SearchHarness />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Buscar en LEX' })).toBeTruthy()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: 'Buscar en todo LEX' }),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: /contactos.*personas y entidades/i }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/contactos' })

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(within(screen.getByLabelText('Recientes')).getByText('Contactos')).toBeTruthy()
  })

  it('shows remote results and opens the keyboard-selected result', () => {
    mocks.useSearch.mockReturnValue({
      data: [
        {
          id: 'opportunity-1',
          entity_type: 'opportunity',
          title: 'Reparto de herencia',
          subtitle: 'OP-001000 · Sucesiones',
          href: '/oportunidades/opportunity-1',
          rank: 100,
        },
      ],
      isPending: false,
      isError: false,
    })
    render(<SearchHarness />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = screen.getByRole('textbox', { name: 'Buscar en todo LEX' })
    fireEvent.change(input, { target: { value: 'herencia' } })

    expect(screen.getByText('Reparto de herencia')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/oportunidades/opportunity-1' })
  })

  it('translates a case status in search results and recent items', () => {
    mocks.useSearch.mockReturnValue({
      data: [
        {
          id: 'case-1',
          entity_type: 'case',
          title: 'Herencia',
          subtitle: 'AP_8 · Sucesiones · active',
          href: '/expedientes/case-1',
          rank: 100,
        },
      ],
      isPending: false,
      isError: false,
    })
    render(<SearchHarness />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en todo LEX' }), {
      target: { value: 'herencia' },
    })
    expect(screen.getByText('AP_8 · Sucesiones · Activo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /herencia.*activo/i }))
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(
      within(screen.getByLabelText('Recientes')).getByText('AP_8 · Sucesiones · Activo'),
    ).toBeTruthy()
  })

  it('finds matching application modules while searching', () => {
    render(<SearchHarness />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByRole('textbox', { name: 'Buscar en todo LEX' })
    fireEvent.change(input, { target: { value: 'CRM' } })

    fireEvent.click(screen.getByRole('button', { name: /crm.*cockpit comercial/i }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/crm' })
  })

  it('finds modules regardless of accents and case', () => {
    render(<SearchHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar en LEX' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar en todo LEX' }), {
      target: { value: 'FACTURACION' },
    })
    fireEvent.click(screen.getByRole('button', { name: /facturación.*facturas y cobros/i }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/facturacion' })
  })
})
