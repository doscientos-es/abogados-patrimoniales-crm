import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue({
    data: {
      fields: [
        {
          field: 'nombre',
          label: 'Nombre',
          value: 'Ana',
          excerpt: 'Nombre: Ana',
        },
      ],
    },
    error: null,
  }),
}))

vi.mock('@/shared/infrastructure/supabase', () => ({
  getSupabaseBrowserClient: () => ({ functions: { invoke: mocks.invoke } }),
}))

import { ContactAIIntake } from './contact-ai-intake'

afterEach(() => {
  cleanup()
  mocks.invoke.mockReset().mockResolvedValue({
    data: {
      fields: [{ field: 'nombre', label: 'Nombre', value: 'Ana', excerpt: 'Nombre: Ana' }],
    },
    error: null,
  })
})

describe('ContactAIIntake', () => {
  it('requires consent, reviews extracted fields, then applies only confirmed values', async () => {
    const onApply = vi.fn()
    render(<ContactAIIntake firmId="firm-1" onApply={onApply} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dar de alta con IA' }))
    const dialog = screen.getByRole('dialog', { name: 'Leer documentos para el contacto' })
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(dialog.className).toContain('overflow-y-auto')
    expect(
      screen
        .getByRole('button', { name: 'Aplicar datos confirmados' })
        .closest('[data-slot="dialog-footer"]')?.className,
    ).toContain('sticky')
    expect(screen.getByText(/los enviará a OpenAI/)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Añadir PDF o imagen' }).hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))

    const file = new File([new Uint8Array([37, 80, 68, 70, 45])], 'dni.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new Uint8Array([37, 80, 68, 70, 45]).buffer),
    })
    fireEvent.change(screen.getByLabelText('Seleccionar documentos PDF o imágenes'), {
      target: { files: [file] },
    })

    await waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith(
        'extract-contact-document',
        expect.objectContaining({ body: expect.objectContaining({ firmId: 'firm-1' }) }),
      ),
    )
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(onApply).not.toHaveBeenCalled()

    const proposalCheckbox = screen.getAllByRole('checkbox')[1]
    if (!proposalCheckbox) throw new Error('No se encontró la casilla para confirmar el dato.')
    fireEvent.click(proposalCheckbox)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar datos confirmados' }))

    expect(onApply).toHaveBeenCalledWith({ nombre: 'Ana' })
  })
})
