import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PendingPanel } from './common'

describe('PendingPanel', () => {
  it('shows a page skeleton while a view is loading', () => {
    render(<PendingPanel title="Cargando contactos" description="Consultando el despacho…" />)

    const status = screen.getByRole('status')
    expect(status.textContent).toContain('Cargando contactos')
    expect(status.parentElement?.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByTestId('page-loading-skeleton')).toBeTruthy()
  })

  it('keeps non-loading statuses free of loading indicators', () => {
    render(<PendingPanel title="Contactos no disponibles" />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByTestId('page-loading-skeleton')).toBeNull()
  })
})
