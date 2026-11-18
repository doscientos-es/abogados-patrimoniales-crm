import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContactoPersistido } from '@/features/contactos'

const mocks = vi.hoisted(() => ({ refetch: vi.fn(), create: vi.fn(), save: vi.fn() }))
const existing = {
  id: 'existing',
  name: 'Contacto existente',
  phone: '+34 600 123 456',
  alternatePhone: null,
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
    target,
  }: {
    children: ReactNode
    to: string
    params?: { id: string }
    search?: { tab: string }
    target?: string
  }) => (
    <a
      href={`${params ? to.replace('$id', params.id) : to}${search ? `?tab=${search.tab}` : ''}`}
      target={target}
    >
      {children}
    </a>
  ),
}))
vi.mock('@/features/contactos', () => ({
  useContactPhoneCandidates: () => ({ data: [existing], refetch: mocks.refetch }),
}))

import { CaseParticipantDialog } from './case-participant-dialog'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('alta rápida de interviniente', () => {
  it('deja espacio para la lupa al buscar un contacto interno', () => {
    const contact = { id: 'contact', nombre: 'Ana' } as ContactoPersistido
    render(
      <CaseParticipantDialog
        firmId="firm-1"
        open
        onOpenChange={vi.fn()}
        titular="Empresa"
        contactos={[contact]}
        miembros={[]}
        pending={false}
        onCreateContact={mocks.create}
        onSubmit={mocks.save}
      />,
    )

    const search = screen.getByLabelText('Implicado') as HTMLInputElement
    const icon = search.parentElement?.querySelector('svg')
    expect(search.className).toContain('!pl-10')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(icon?.getAttribute('class')).toContain('pointer-events-none')
    fireEvent.change(search, { target: { value: 'Ana' } })
    expect(screen.getByRole('button', { name: 'Ana' })).toBeTruthy()
  })

  it('permite crear con teléfono compartido solo tras confirmar la coincidencia', async () => {
    mocks.refetch.mockResolvedValue({ data: [existing], isError: false })
    mocks.create.mockResolvedValue({ id: 'new', nombre: 'Ana' })
    mocks.save.mockResolvedValue(undefined)
    render(
      <CaseParticipantDialog
        firmId="firm-1"
        open
        onOpenChange={vi.fn()}
        contactos={[]}
        miembros={[]}
        pending={false}
        onCreateContact={mocks.create}
        onSubmit={mocks.save}
      />,
    )
    expect(screen.queryByLabelText('Descripción')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Crear persona/ }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '600123456' } })
    expect(screen.getByText('Contacto existente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Crear persona y guardar' }))
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalled())
    expect(mocks.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText(/He revisado las coincidencias/))
    fireEvent.click(screen.getByRole('button', { name: 'Crear persona y guardar' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ descripcion: '' }))
    expect(mocks.create).toHaveBeenCalledOnce()
  })

  it('permite elegir y guardar un rol personalizado para un contacto interno', async () => {
    const contact = { id: 'contact', nombre: 'Ana' } as ContactoPersistido
    render(
      <CaseParticipantDialog
        firmId="firm-1"
        open
        onOpenChange={vi.fn()}
        titular="Empresa"
        initial={{
          tipo: 'Contacto interno',
          contactoId: 'contact',
          miembroId: null,
          ref: '',
          descripcion: 'Descripción guardada anteriormente',
        }}
        roles={['Representante legal']}
        contactos={[contact]}
        miembros={[]}
        pending={false}
        onCreateContact={mocks.create}
        onSubmit={mocks.save}
      />,
    )
    expect(screen.queryByLabelText('Descripción')).toBeNull()
    const editLink = screen.getByRole('link', { name: 'Editar contacto' })
    expect(editLink.getAttribute('href')).toBe('/contactos/contact?tab=general')
    expect(editLink.getAttribute('target')).toBe('_blank')
    expect(
      screen.getByRole('button', { name: 'Guardar' }).closest('[data-slot="dialog-footer"]')
        ?.className,
    ).toContain('border-t-0')
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Representante legal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'Representante legal',
          contacto: contact,
          descripcion: 'Descripción guardada anteriormente',
        }),
      ),
    )
  })

  it('conserva un rol ya guardado aunque se haya archivado', () => {
    const contact = { id: 'contact', nombre: 'Ana' } as ContactoPersistido
    render(
      <CaseParticipantDialog
        firmId="firm-1"
        open
        onOpenChange={vi.fn()}
        titular="Empresa"
        initial={{
          tipo: 'Rol anterior',
          contactoId: 'contact',
          miembroId: null,
          ref: '',
          descripcion: '',
        }}
        roles={[]}
        contactos={[contact]}
        miembros={[]}
        pending={false}
        onCreateContact={mocks.create}
        onSubmit={mocks.save}
      />,
    )
    expect((screen.getByLabelText('Tipo') as HTMLSelectElement).value).toBe('Rol anterior')
  })
})
