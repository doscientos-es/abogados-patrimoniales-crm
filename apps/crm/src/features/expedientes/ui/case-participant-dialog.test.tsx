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
  Link: ({ children }: { children: ReactNode }) => <a href="/contactos">{children}</a>,
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
          descripcion: '',
        }}
        roles={['Representante legal']}
        contactos={[contact]}
        miembros={[]}
        pending={false}
        onCreateContact={mocks.create}
        onSubmit={mocks.save}
      />,
    )
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Representante legal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'Representante legal', contacto: contact }),
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
