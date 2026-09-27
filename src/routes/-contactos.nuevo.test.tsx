import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createContact: vi.fn().mockResolvedValue({ id: 'contact-1' }),
  createNote: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
  aiValues: {} as Record<string, string>,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({
    children,
    to,
    ...props
  }: { children: ReactNode; to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
}))

vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))

vi.mock('@/features/contactos', () => ({
  useContactos: () => ({ data: [] }),
  useCrearContacto: () => ({ isPending: false, mutateAsync: mocks.createContact }),
}))

vi.mock('@/features/contactos/ui/contact-ai-intake', () => ({
  ContactAIIntake: ({
    onApply,
  }: {
    firmId: string
    onApply: (values: Record<string, string>) => void
  }) => (
    <button type="button" onClick={() => onApply(mocks.aiValues)}>
      Aplicar datos de prueba
    </button>
  ),
}))

vi.mock('@/features/notas', () => ({
  useCrearNotaPersona: () => ({ mutateAsync: mocks.createNote }),
}))

import { NuevoContactoPage } from '@/features/contactos/ui/nuevo-contacto-page'

afterEach(() => {
  cleanup()
  mocks.createContact.mockReset().mockResolvedValue({ id: 'contact-1' })
  mocks.createNote.mockReset().mockResolvedValue(undefined)
  mocks.navigate.mockClear()
  mocks.aiValues = {}
})

describe('NuevoContactoPage', () => {
  it('configura valores iniciales, tipos de campo y ayudas accesibles', () => {
    render(<NuevoContactoPage />)

    expect(
      screen.getByRole('form', { name: 'Formulario de nuevo contacto' }).getAttribute('aria-busy'),
    ).toBe('false')
    expect(screen.getByText('Identificación')).toBeTruthy()
    expect(screen.getByText('Datos de contacto')).toBeTruthy()
    expect(screen.getAllByText('Origen del contacto').length).toBe(2)
    expect(screen.getByText('Notas internas')).toBeTruthy()
    expect((screen.getByLabelText(/^Nombre/) as HTMLInputElement).placeholder).toBe('Ej. Ana')
    expect((screen.getByLabelText('Correo') as HTMLInputElement).placeholder).toBe(
      'Ej. nombre@dominio.es',
    )
    expect((screen.getByLabelText('Teléfono') as HTMLInputElement).placeholder).toBe(
      'Ej. 600 000 000',
    )
    expect((screen.getByLabelText('Dirección') as HTMLInputElement).placeholder).toBe(
      'Ej. Calle, número, piso',
    )
    const country = screen.getByLabelText('País') as HTMLSelectElement
    expect(country.value).toBe('España')
    expect(Array.from(country.options).map((option) => option.value)).toEqual([
      'España',
      'Francia',
      'Portugal',
      'Reino Unido',
      'Andorra',
    ])
    const origin = screen.getByLabelText(/^Origen/) as HTMLSelectElement
    expect(origin.value).toBe('')
    expect(Array.from(origin.options).map((option) => option.value)).toEqual([
      '',
      'Recomendación de cliente',
      'Recomendación profesional',
      'Página web',
      'Redes sociales',
      'Publicidad',
      'Contacto directo',
      'Cliente anterior',
      'Colaborador',
      'Otro',
    ])
    fireEvent.change(origin, { target: { value: 'Recomendación de cliente' } })
    expect(screen.getByLabelText('Contacto que ha recomendado a esta persona')).toBeTruthy()
    fireEvent.change(origin, { target: { value: 'Página web' } })
    expect(screen.queryByLabelText('Contacto que ha recomendado a esta persona')).toBeNull()

    const postalCode = screen.getByLabelText('Código postal')
    expect(postalCode.getAttribute('inputmode')).toBe('numeric')
    expect(postalCode.getAttribute('pattern')).toBe('[0-9]{5}')
    expect(postalCode.getAttribute('maxlength')).toBe('5')
    expect(postalCode.getAttribute('aria-describedby')).toBe('contact-codigoPostal-description')
    expect(screen.getByText('Introduce los cinco dígitos del código postal.')).toBeTruthy()

    fireEvent.input(postalCode, { target: { value: '28A0-13' } })
    expect((postalCode as HTMLInputElement).value).toBe('28013')
  })

  it('envía los valores normalizados y abre la ficha creada', async () => {
    render(<NuevoContactoPage />)

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: ' Ana ' } })
    fireEvent.change(screen.getByLabelText(/^Origen/), { target: { value: 'Página web' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))

    await waitFor(() =>
      expect(mocks.createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoPersona: 'Persona física',
          relacion: 'Lead',
          valores: expect.objectContaining({ nombre: 'Ana', pais: 'España', origen: 'Página web' }),
        }),
      ),
    )
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/contactos/$id',
      params: { id: 'contact-1' },
    })
  })

  it('aplica los datos confirmados por IA al formulario sin crear el contacto automáticamente', async () => {
    mocks.aiValues = {
      naturaleza: 'Persona física',
      nombre: 'Ana',
      primerApellido: 'López García',
      documento: '12345678Z',
      codigoPostal: '28013',
      municipio: 'Madrid',
      fechaNacimiento: '1990-01-02',
      pais: 'Francia',
      origen: 'Redes sociales',
    }
    render(<NuevoContactoPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar datos de prueba' }))

    await waitFor(() =>
      expect((screen.getByLabelText(/^Nombre/) as HTMLInputElement).value).toBe('Ana'),
    )
    expect((screen.getByLabelText('Apellidos') as HTMLInputElement).value).toBe('López García')
    expect((screen.getByLabelText('NIF / CIF') as HTMLInputElement).value).toBe('12345678Z')
    expect((screen.getByLabelText('Código postal') as HTMLInputElement).value).toBe('28013')
    expect((screen.getByLabelText('Municipio') as HTMLInputElement).value).toBe('Madrid')
    expect((screen.getByLabelText('Fecha de nacimiento') as HTMLInputElement).value).toBe(
      '1990-01-02',
    )
    expect((screen.getByLabelText('País') as HTMLSelectElement).value).toBe('Francia')
    expect((screen.getByLabelText(/^Origen/) as HTMLSelectElement).value).toBe('Redes sociales')
    expect(mocks.createContact).not.toHaveBeenCalled()

    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))
    await waitFor(() =>
      expect(mocks.createContact).toHaveBeenCalledWith(
        expect.objectContaining({
          valores: expect.objectContaining({
            nombre: 'Ana',
            primerApellido: 'López García',
            documento: '12345678Z',
            codigoPostal: '28013',
            municipio: 'Madrid',
          }),
        }),
      ),
    )
  })

  it('cambia la naturaleza antes de aplicar los datos específicos de persona jurídica', () => {
    mocks.aiValues = { naturaleza: 'Persona jurídica', razonSocial: 'Acme S.L.' }
    render(<NuevoContactoPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar datos de prueba' }))

    expect((screen.getByLabelText('Naturaleza') as HTMLSelectElement).value).toBe(
      'Persona jurídica',
    )
    expect((screen.getByLabelText(/^Denominación/) as HTMLInputElement).value).toBe('Acme S.L.')
    expect(mocks.createContact).not.toHaveBeenCalled()
  })

  it('guarda la nota interna con sus marcas junto al contacto', async () => {
    render(<NuevoContactoPage />)

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Añadir nota' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Título de nota interna'), {
      target: { value: 'Preferencia de contacto' },
    })
    fireEvent.change(screen.getByLabelText('Contenido de nota interna'), {
      target: { value: 'Prefiere recibir llamadas por la tarde.' },
    })
    fireEvent.click(screen.getByLabelText('Destacada'))
    fireEvent.click(screen.getByLabelText('Advertencia crítica'))
    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }))
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))

    await waitFor(() =>
      expect(mocks.createNote).toHaveBeenCalledWith({
        contactoId: 'contact-1',
        etiquetaOrigen: 'Ana',
        titulo: 'Preferencia de contacto',
        contenido: 'Prefiere recibir llamadas por la tarde.',
        destacada: true,
        critica: true,
      }),
    )
  })

  it('abre la ficha creada si falla el guardado de una nota para evitar duplicar el contacto', async () => {
    mocks.createContact.mockResolvedValue({ id: 'contact-2' })
    mocks.createNote.mockRejectedValueOnce(new Error('Fallo de persistencia'))
    render(<NuevoContactoPage />)

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Ana' } })
    expect(screen.getByLabelText('Contenido de nota interna')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contenido de nota interna'), {
      target: { value: 'Información relevante' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }))
    fireEvent.submit(screen.getByRole('form', { name: 'Formulario de nuevo contacto' }))

    await waitFor(() => expect(mocks.createNote).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/contactos/$id',
        params: { id: 'contact-2' },
      }),
    )
    expect(mocks.createContact).toHaveBeenCalledOnce()
  })
})
