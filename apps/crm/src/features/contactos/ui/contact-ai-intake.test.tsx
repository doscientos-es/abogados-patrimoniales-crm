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
  it('selects extracted fields by default and applies them after confirmation', async () => {
    const onApply = vi.fn()
    render(<ContactAIIntake firmId="firm-1" onApply={onApply} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dar de alta con LEXIA' }))
    const dialog = screen.getByRole('dialog', { name: 'Datos del contacto' })
    expect(dialog.className).toMatch(/max-h-/)
    expect(dialog.className).toContain('w-[calc(100vw-2rem)]')
    expect(dialog.className).toContain('max-w-5xl')
    expect(dialog.className).toContain('overflow-hidden')
    expect(dialog.querySelector('.overflow-y-auto')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Aplicar datos confirmados' })
        .closest('[data-slot="dialog-footer"]')?.className,
    ).toContain('sticky')
    expect(
      screen.getByRole('button', { name: 'Añadir PDF o imagen' }).hasAttribute('disabled'),
    ).toBe(false)
    expect(screen.queryByLabelText(/Autorizo enviar los documentos a OpenAI/)).toBeNull()

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
    expect(screen.getByLabelText('Documentos procesados').textContent).toContain('dni.pdf')
    expect(onApply).not.toHaveBeenCalled()

    const proposalCheckbox = screen.getByLabelText(/Nombre.*Ana/)
    if (!(proposalCheckbox instanceof HTMLInputElement)) {
      throw new Error('No se encontró la casilla para confirmar el dato.')
    }
    expect(proposalCheckbox.checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar datos confirmados' }))

    expect(onApply).toHaveBeenCalledWith({ nombre: 'Ana' }, [file])
  })

  it('allows excluding documents from the contact record', async () => {
    const onApply = vi.fn()
    render(<ContactAIIntake firmId="firm-1" onApply={onApply} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dar de alta con LEXIA' }))
    fireEvent.click(screen.getByLabelText(/Adjuntar los documentos a la ficha/))
    const file = new File(['data'], 'dni.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new Uint8Array([1]).buffer),
    })
    fireEvent.change(screen.getByLabelText('Seleccionar documentos PDF o imágenes'), {
      target: { files: [file] },
    })
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar datos confirmados' }))
    expect(onApply).toHaveBeenCalledWith({ nombre: 'Ana' }, [])
  })

  it('shows processing and allows attaching a document even when no data is found', async () => {
    let finish!: (value: unknown) => void
    mocks.invoke.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const onApply = vi.fn()
    render(<ContactAIIntake firmId="firm-1" onApply={onApply} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dar de alta con LEXIA' }))
    expect(screen.getByText('Todavía no hay datos')).toBeTruthy()

    const file = new File(['data'], 'documento.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new Uint8Array([1]).buffer),
    })
    fireEvent.change(screen.getByLabelText('Seleccionar documentos PDF o imágenes'), {
      target: { files: [file] },
    })
    expect(await screen.findByText('LEXIA está leyendo los documentos…')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Leyendo documentos…' }).hasAttribute('disabled'),
    ).toBe(true)

    finish({ data: { fields: [] }, error: null })
    expect(await screen.findByText('No hay datos propuestos')).toBeTruthy()
    expect(screen.getByLabelText('Documentos procesados').textContent).toContain('documento.pdf')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar datos confirmados' }))
    expect(onApply).toHaveBeenCalledWith({}, [file])
  })
})
