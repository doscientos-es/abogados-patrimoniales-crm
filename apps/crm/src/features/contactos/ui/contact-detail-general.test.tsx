import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContactoPersistido } from '@/features/contactos'

const mocks = vi.hoisted(() => ({
  contact: {} as ContactoPersistido,
  contacts: [] as ContactoPersistido[],
  update: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original()),
  Link: ({ children }: { children: ReactNode }) => <a href="/contactos">{children}</a>,
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' } }),
}))
vi.mock('@/features/contactos', () => ({
  useContacto: () => ({ data: mocks.contact }),
  useContactos: () => ({ data: mocks.contacts }),
  useActualizarContacto: () => ({ mutateAsync: mocks.update }),
  useActualizarEstadoContacto: () => ({}),
}))
vi.mock('@/features/crm', () => ({
  useMiembrosDespacho: () => ({ data: [] }),
  useOportunidadesCompletas: () => ({ data: [] }),
}))
vi.mock('@/features/expedientes', () => ({ useExpedientesPersistentes: () => ({ data: [] }) }))
vi.mock('@/features/facturacion', () => ({
  formatCurrency: vi.fn(),
  useFacturas: () => ({ data: [] }),
}))
vi.mock('@/features/notas', () => ({
  notaDesdeRemota: vi.fn(),
  notesForContact: () => [],
  useCrearNotaPersona: () => ({}),
  useNotasRemotas: () => ({ data: [] }),
}))
vi.mock('@/features/onboarding', () => ({ useOnboardings: () => ({ data: [] }) }))
vi.mock('@/features/tareas', () => ({ useTareasPersistentes: () => ({ data: [] }) }))

import { ContactDetail } from './contact-detail'
import { CONTACT_ORIGINS } from './contact-origins'

beforeEach(() => {
  mocks.contact = {
    id: 'contact-1',
    nombre: 'Ana',
    tipoPersona: 'Persona física',
    relacion: 'Cliente',
    estado: 'Activo',
    origen: 'Página web',
    razonSocial: 'Dato anterior',
    nif: '',
    email: '',
    telefono: '',
    direccion: '',
    cp: '',
    municipio: '',
    provincia: '',
    pais: '',
    version: 1,
  } as ContactoPersistido
  mocks.contacts = []
  mocks.update.mockClear()
})
afterEach(cleanup)

describe('Datos generales del contacto', () => {
  it('oculta razón social y recomendación ausente sin borrar datos al guardar', async () => {
    render(<ContactDetail contactId="contact-1" activeTab="general" />)
    expect(screen.queryByLabelText('Razón social')).toBeNull()
    expect(screen.queryByLabelText('Recomendado por')).toBeNull()
    const origin = screen.getByLabelText('Origen') as HTMLSelectElement
    expect(Array.from(origin.options, (option) => option.value)).toEqual(['', ...CONTACT_ORIGINS])
    fireEvent.change(origin, { target: { value: 'Publicidad' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          contacto: expect.objectContaining({ razonSocial: 'Dato anterior', origen: 'Publicidad' }),
          version: 1,
        }),
      ),
    )
  })

  it('permite editar razón social y recomendación registradas', async () => {
    mocks.contact = { ...mocks.contact, tipoPersona: 'Persona jurídica', recomendadoPor: 'María' }
    render(<ContactDetail contactId="contact-1" activeTab="general" />)
    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Acme' } })
    fireEvent.change(screen.getByLabelText('Recomendado por'), { target: { value: 'Luis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          contacto: expect.objectContaining({ razonSocial: 'Acme', recomendadoPor: 'Luis' }),
        }),
      ),
    )
  })

  it('conserva un origen antiguo fuera de las opciones disponibles', async () => {
    mocks.contact = { ...mocks.contact, origen: 'Feria antigua', recommendedById: 'contact-2' }
    render(<ContactDetail contactId="contact-1" activeTab="general" />)
    expect((screen.getByLabelText('Origen') as HTMLSelectElement).value).toBe('Feria antigua')
    expect(screen.getByLabelText('Recomendado por')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          contacto: expect.objectContaining({
            origen: 'Feria antigua',
            recommendedById: 'contact-2',
          }),
        }),
      ),
    )
  })
})
