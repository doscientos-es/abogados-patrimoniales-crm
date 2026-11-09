import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

import { CaseCreateDialog } from './case-create-dialog'

afterEach(() => {
  cleanup()
  mocks.toastError.mockReset()
  mocks.toastSuccess.mockReset()
})

describe('CaseCreateDialog', () => {
  it('requests a contact before allowing a case to be created', () => {
    render(<CaseCreateDialog contactos={[]} miembros={[]} pending={false} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /nuevo expediente/i }))
    expect(screen.getByText('Primero necesitas un contacto')).toBeTruthy()
    expect(screen.getByRole('link', { name: /crear contacto/i }).getAttribute('href')).toBe(
      '/contactos/nuevo',
    )
  })

  it('keeps case identification visible and advanced settings collapsed', async () => {
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
    expect(screen.getByLabelText('Cliente *')).toBeTruthy()
    expect(screen.getByLabelText('Nombre del expediente *')).toBeTruthy()
    expect(screen.getByLabelText('Naturaleza *')).toBeTruthy()
    expect(screen.getByLabelText('Área de práctica')).toBeTruthy()
    expect(screen.getByLabelText('Tipo de asunto')).toBeTruthy()
    const advancedSettings = screen.getByText('Creación avanzada').closest('details')
    expect(advancedSettings?.open).toBe(false)

    fireEvent.change(screen.getByLabelText('Cliente *'), {
      target: { value: 'contact-1' },
    })
    fireEvent.change(screen.getByLabelText('Nombre del expediente *'), {
      target: { value: 'Herencia familiar' },
    })
    fireEvent.click(screen.getByText('Creación avanzada'))
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

  it('does not report a navigation rejection as a case creation error', async () => {
    const onCreated = vi.fn().mockRejectedValue(new Error('Navigation cancelled'))
    render(
      <CaseCreateDialog
        contactos={[{ id: 'contact-1', nombre: 'Ana López' }]}
        miembros={[]}
        pending={false}
        onCreate={vi.fn().mockResolvedValue({ id: 'case-1' })}
        onCreated={onCreated}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /nuevo expediente/i }))
    fireEvent.change(screen.getByLabelText('Cliente *'), { target: { value: 'contact-1' } })
    fireEvent.change(screen.getByLabelText('Nombre del expediente *'), {
      target: { value: 'Herencia familiar' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^crear expediente$/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('case-1'))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Expediente creado.')
    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})
