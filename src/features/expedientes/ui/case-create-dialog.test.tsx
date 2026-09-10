import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

import { CaseCreateDialog } from './case-create-dialog'

afterEach(cleanup)

describe('CaseCreateDialog', () => {
  it('requests a contact before allowing a case to be created', () => {
    render(<CaseCreateDialog contactos={[]} miembros={[]} pending={false} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo expediente/i }))
    expect(screen.getByText('Primero necesitas un contacto')).toBeTruthy()
    expect(screen.getByRole('link', { name: /crear contacto/i }).getAttribute('href')).toBe(
      '/contactos/nuevo',
    )
  })

  it('submits the essential values and keeps operational fields optional', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'case-1' })
    render(
      <CaseCreateDialog
        contactos={[{ id: 'contact-1', nombre: 'Ana López' }]}
        miembros={[]}
        pending={false}
        onCreate={onCreate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /nuevo expediente/i }))
    fireEvent.change(screen.getByLabelText(/contacto principal/i), {
      target: { value: 'contact-1' },
    })
    fireEvent.change(screen.getByLabelText('Asunto *'), { target: { value: 'Herencia familiar' } })
    fireEvent.change(screen.getByLabelText(/fecha de apertura/i), {
      target: { value: '2026-09-07' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^crear expediente$/i }))
    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          contactoPrincipalId: 'contact-1',
          titulo: 'Herencia familiar',
          fechaApertura: '2026-09-07',
          naturaleza: 'Extrajudicial',
          prioridad: 'Media',
        }),
      ),
    )
  })
})
