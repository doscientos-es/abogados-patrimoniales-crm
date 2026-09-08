import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

import { GlobalSearch } from './global-search'

afterEach(() => {
  cleanup()
  mocks.navigate.mockClear()
  mocks.useSearch.mockReturnValue({ data: [], isPending: false, isError: false })
  window.localStorage.clear()
})

describe('GlobalSearch', () => {
  it('opens with Ctrl+K and saves a selected module as a recent item', () => {
    render(<GlobalSearch />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Buscar en LEX' })).toBeTruthy()

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
    render(<GlobalSearch />)

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const input = screen.getByRole('textbox', { name: 'Buscar en todo LEX' })
    fireEvent.change(input, { target: { value: 'herencia' } })

    expect(screen.getByText('Reparto de herencia')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/oportunidades/opportunity-1' })
  })

  it('finds matching application modules while searching', () => {
    render(<GlobalSearch />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const input = screen.getByRole('textbox', { name: 'Buscar en todo LEX' })
    fireEvent.change(input, { target: { value: 'CRM' } })

    fireEvent.click(screen.getByRole('button', { name: /crm.*cockpit comercial/i }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/crm' })
  })
})
