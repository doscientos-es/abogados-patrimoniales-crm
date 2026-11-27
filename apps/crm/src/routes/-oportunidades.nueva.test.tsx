import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { contactId: 'contact-1' },
  contactOrigin: 'Recomendación',
  membersError: false,
  practiceAreas: ['SUCESIONES Y HERENCIAS'],
  areasError: false,
  areasPending: false,
  areaRefetch: vi.fn(),
  createOpportunity: vi.fn(),
  contactRefetch: vi.fn().mockResolvedValue({ isError: false }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => mocks.search }),
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

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mocks.practiceAreas,
    isError: mocks.areasError,
    isPending: mocks.areasPending,
    refetch: mocks.areaRefetch,
  }),
}))
vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
}))
vi.mock('@/features/contactos', () => ({
  useContactos: () => ({
    data: [{ id: 'contact-1', nombre: 'Ana', apellidos: 'López', origen: mocks.contactOrigin }],
    isPending: false,
    refetch: mocks.contactRefetch,
  }),
}))
vi.mock('@/features/contactos/ui/nuevo-contacto-page', () => ({
  NuevoContactoPage: ({ onCreated }: { onCreated: (contact: object) => void }) => (
    <button
      type="button"
      onClick={() =>
        onCreated({ id: 'contact-2', nombre: 'Koldo', apellidos: 'Arregi', origen: 'Web' })
      }
    >
      Guardar contacto de prueba
    </button>
  ),
}))
vi.mock('@/features/crm', () => ({
  useCrearOportunidad: () => ({ isPending: false, mutateAsync: mocks.createOpportunity }),
  useLeadRoles: () => ({ data: [] }),
  useMiembrosDespacho: () => ({
    data: [{ id: 'lawyer-jon', nombre: 'Jon' }],
    isError: mocks.membersError,
  }),
}))
import { NuevaOportunidadPage } from './oportunidades.nueva'

afterEach(() => {
  cleanup()
  mocks.navigate.mockClear()
  mocks.createOpportunity.mockReset()
  mocks.contactRefetch.mockClear()
  mocks.search = { contactId: 'contact-1' }
  mocks.contactOrigin = 'Recomendación'
  mocks.membersError = false
  mocks.practiceAreas = ['SUCESIONES Y HERENCIAS']
  mocks.areasError = false
  mocks.areasPending = false
  mocks.areaRefetch.mockReset()
})

describe('NuevaOportunidadPage', () => {
  it('crea y selecciona un contacto en el diálogo sin perder el formulario del Lead', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), {
      target: { value: 'Consulta inicial' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear contacto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contacto de prueba' }))
    expect((screen.getByLabelText('Título del Lead') as HTMLInputElement).value).toBe(
      'Consulta inicial',
    )
    expect((screen.getByLabelText('Contacto principal') as HTMLInputElement).value).toBe(
      'Koldo Arregi',
    )
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    chooseDate()
    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)
    await waitFor(() =>
      expect(mocks.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'contact-2', source: 'Web' }),
      ),
    )
  })

  it('preselecciona el contacto indicado al abrir el formulario', async () => {
    render(<NuevaOportunidadPage />)

    await waitFor(() =>
      expect((screen.getByLabelText('Contacto principal') as HTMLInputElement).value).toBe(
        'Ana López',
      ),
    )
    expect((screen.getByRole('button', { name: 'Crear Lead' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect(screen.queryByLabelText('Origen del Lead')).toBeNull()
    expect(screen.queryByLabelText('Otras personas o entidades relacionadas')).toBeNull()
  })

  it('keeps the Lead form in memory and refreshes contacts after creating one in another tab', async () => {
    render(<NuevaOportunidadPage />)

    const title = screen.getByLabelText('Título del Lead') as HTMLInputElement
    fireEvent.change(title, { target: { value: 'Consulta inicial' } })
    const createContact = screen.getByRole('link', { name: 'Crear contacto en otra pestaña' })
    expect(createContact.getAttribute('href')).toBe('/contactos/nuevo')
    expect(createContact.getAttribute('target')).toBe('_blank')
    expect(createContact.getAttribute('rel')).toContain('noopener')

    createContact.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(createContact)

    expect(title.value).toBe('Consulta inicial')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contactos' }))
    await waitFor(() => expect(mocks.contactRefetch).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Actualizar contactos' })).toBeNull(),
    )
  })

  it('avisa cuando no hay contactos que coincidan con la búsqueda', async () => {
    render(<NuevaOportunidadPage />)
    const input = screen.getByLabelText('Contacto principal')
    fireEvent.change(input, { target: { value: 'Koldo Arregi' } })
    expect(await screen.findByText(/Sin resultados\. Puedes crear el contacto/)).toBeTruthy()
    fireEvent.change(input, { target: { value: 'Ana' } })
    expect(screen.queryByText(/Sin resultados\. Puedes crear el contacto/)).toBeNull()
  })

  it('allows creating a Lead when the contact origin exceeds the Lead limit', async () => {
    mocks.contactOrigin = 'A'.repeat(170)
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), { target: { value: 'Consulta' } })
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    chooseDate()
    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)

    await waitFor(() => expect(mocks.createOpportunity).toHaveBeenCalledOnce())
    expect(mocks.createOpportunity.mock.calls[0]?.[0].source).toBe('A'.repeat(160))
  })

  it('hereda el origen del contacto sin pedirlo de nuevo', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), { target: { value: 'Consulta' } })
    expect(screen.queryByLabelText('Origen del Lead')).toBeNull()
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    chooseDate()
    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)
    await waitFor(() =>
      expect(mocks.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'Recomendación' }),
      ),
    )
  })

  it('explica un catálogo vacío sin inventar materias', () => {
    mocks.practiceAreas = []
    render(<NuevaOportunidadPage />)
    expect((screen.getByLabelText('Materia') as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByRole('option', { name: 'No hay materias activas' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Catálogos → Materias/ }).getAttribute('target')).toBe(
      '_blank',
    )
  })

  it('distingue una consulta pendiente de un error y permite reintentar', () => {
    mocks.areasPending = true
    const { rerender } = render(<NuevaOportunidadPage />)
    expect(screen.getByRole('option', { name: 'Cargando materias…' })).toBeTruthy()
    mocks.areasPending = false
    mocks.areasError = true
    rerender(<NuevaOportunidadPage />)
    expect(screen.getByRole('option', { name: 'Materias no disponibles' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(mocks.areaRefetch).toHaveBeenCalledOnce()
  })

  it('guarda el responsable elegido y por defecto usa el usuario activo', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container, unmount } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), { target: { value: 'Consulta' } })
    fireEvent.change(screen.getByLabelText('Responsable del Lead'), {
      target: { value: 'lawyer-jon' },
    })
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    chooseDate()
    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)
    await waitFor(() =>
      expect(mocks.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'lawyer-jon' }),
      ),
    )

    unmount()
    mocks.createOpportunity.mockClear()
    const second = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), { target: { value: 'Consulta' } })
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    chooseDate()
    const secondForm = second.container.querySelector('form')
    if (!secondForm) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(secondForm)
    await waitFor(() =>
      expect(mocks.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'user-1' }),
      ),
    )
  })

  it('no pierde un responsable elegido si falla la consulta de miembros', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container, rerender } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), { target: { value: 'Consulta' } })
    fireEvent.change(screen.getByLabelText('Responsable del Lead'), {
      target: { value: 'lawyer-jon' },
    })
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    chooseDate()
    mocks.membersError = true
    rerender(<NuevaOportunidadPage />)
    const form = container.querySelector('form')
    if (!form) throw new Error('No se encontró el formulario de alta.')
    fireEvent.submit(form)
    expect(mocks.createOpportunity).not.toHaveBeenCalled()
    expect(screen.getByText(/No se pudieron cargar los responsables/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar responsable seleccionado' }))
    fireEvent.submit(form)
    await waitFor(() =>
      expect(mocks.createOpportunity).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'user-1' }),
      ),
    )
  })

  it('confirma APTO con un aviso persistente y dirige a la primera cita desde el modal común', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), {
      target: { value: 'Consulta inicial' },
    })
    fireEvent.change(screen.getByLabelText('Materia'), {
      target: { value: 'SUCESIONES Y HERENCIAS' },
    })
    fireEvent.change(screen.getByLabelText('Nuevo documento'), { target: { value: 'Testamento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    fireEvent.click(screen.getByLabelText('APTO PARA PRIMERA CITA'))
    chooseDate()
    submit(container)
    expect(await screen.findByText('Aviso activo para concertar la primera cita')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hacerlo más tarde' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ir a la ficha del Lead' })).toBeTruthy()
    expect(mocks.createOpportunity).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'SUCESIONES Y HERENCIAS',
        source: 'Recomendación',
        followup: expect.objectContaining({ date: '2099-12-02' }),
        details: expect.objectContaining({
          documentosIniciales: [{ nombre: 'TESTAMENTO', estado: 'declarado' }],
          viabilidadInicial: expect.objectContaining({ resultado: 'apto' }),
        }),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Concertar primera cita' }))
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/oportunidades/$id',
      params: { id: 'opportunity-1' },
      search: { tab: 'firstMeeting' },
    })
  })

  it('no guarda PENDIENTE sin fecha y no exige crear la tarea a mano', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), { target: { value: 'Consulta' } })
    fireEvent.click(screen.getByLabelText('PENDIENTE DE REVISIÓN'))
    submit(container)
    expect(mocks.createOpportunity).not.toHaveBeenCalled()
    chooseDate()
    submit(container)
    expect(await screen.findByText('Tarea obligatoria: Revisar viabilidad')).toBeTruthy()
    expect(mocks.createOpportunity).toHaveBeenCalledOnce()
    expect(mocks.createOpportunity.mock.calls[0]?.[0].details.viabilidadInicial.resultado).toBe(
      'pendiente',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la ficha del Lead' }))
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/oportunidades/$id',
      params: { id: 'opportunity-1' },
    })
  })

  it('exige motivo y confirmación de plazo para NO APTO, y deja la comunicación pendiente', async () => {
    mocks.createOpportunity.mockResolvedValue({ id: 'opportunity-1', referencia: 'LD-1' })
    const { container } = render(<NuevaOportunidadPage />)
    fireEvent.change(screen.getByLabelText('Título del Lead'), { target: { value: 'Consulta' } })
    fireEvent.change(screen.getByLabelText('Urgencia'), {
      target: { value: 'Sí, existe una fecha o plazo concreto' },
    })
    fireEvent.click(screen.getByLabelText('NO APTO / NO ATENDIBLE'))
    chooseDate()
    submit(container)
    expect(mocks.createOpportunity).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Motivo de no aceptación'), {
      target: { value: 'Otro motivo' },
    })
    fireEvent.change(screen.getByLabelText('Detalla el motivo'), {
      target: { value: 'No podemos asumirlo' },
    })
    submit(container)
    expect(mocks.createOpportunity).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: /He revisado el plazo/ }))
    submit(container)
    expect(await screen.findByText('Lead cerrado · Comunicación pendiente')).toBeTruthy()
    expect(mocks.createOpportunity.mock.calls[0]?.[0]).toMatchObject({
      followup: { acceptedDeadlineWarning: true },
      details: { viabilidadInicial: { resultado: 'no_apto', motivo: 'No podemos asumirlo' } },
    })
    expect(screen.queryByRole('button', { name: 'Concertar primera cita' })).toBeNull()
  })
})

function chooseDate() {
  fireEvent.change(screen.getByLabelText('Fecha de la siguiente acción'), {
    target: { value: '2099-12-02' },
  })
}

function submit(container: HTMLElement) {
  const form = container.querySelector('form')
  if (!form) throw new Error('No se encontró el formulario de alta.')
  fireEvent.submit(form)
}
