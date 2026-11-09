import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: LinkProps) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

import { LegalPage, type LegalPageKind } from './legal-page'

type LinkProps = {
  children: ReactNode
  to: string
} & AnchorHTMLAttributes<HTMLAnchorElement>

describe('LegalPage', () => {
  it.each([
    ['condiciones', 'Condiciones de uso'],
    ['privacidad', 'Política de privacidad'],
    ['cookies', 'Política de cookies'],
    ['terminos', 'Términos del servicio'],
  ] as const)('muestra el contenido de %s', (page, title) => {
    render(<LegalPage page={page as LegalPageKind} />)

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy()
    expect(screen.getByText('Última actualización: 15 de septiembre de 2026.')).toBeTruthy()
  })

  it('enlaza a todas las páginas legales públicas', () => {
    render(<LegalPage page="privacidad" />)

    const navigation = screen.getByRole('navigation', { name: 'Información legal' })
    expect(navigation.querySelectorAll('a')).toHaveLength(4)
    expect(screen.getByRole('link', { name: 'Condiciones' }).getAttribute('href')).toBe(
      '/condiciones',
    )
    expect(screen.getByRole('link', { name: 'Privacidad' }).getAttribute('href')).toBe(
      '/privacidad',
    )
    expect(screen.getByRole('link', { name: 'Cookies' }).getAttribute('href')).toBe('/cookies')
    expect(screen.getByRole('link', { name: 'Términos' }).getAttribute('href')).toBe('/terminos')
  })
})
