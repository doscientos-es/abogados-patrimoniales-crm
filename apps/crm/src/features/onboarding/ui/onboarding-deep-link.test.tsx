import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as OnboardingApplication from '@/features/onboarding/application'

import { OnboardingPage } from './onboarding-page'

const mocks = vi.hoisted(() => ({
  onboardings: [] as unknown[],
  leads: [] as unknown[],
  openCase: vi.fn().mockResolvedValue({ id: 'case-new' }),
  empty: () => ({ data: [], isLoading: false, isError: false }),
  mutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    ...props
  }: {
    children: ReactNode
    to: string
    search?: { abrir?: string }
  }) => (
    <a {...props} href={search?.abrir ? `${to}?abrir=${search.abrir}` : to}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))
vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ status: 'signed-in', user: { id: 'user-1' } }),
  useActiveMembership: () => ({ data: { firmId: 'firm-1' }, isPending: false }),
}))
vi.mock('@/features/contactos', () => ({ useContactos: mocks.empty }))
vi.mock('@/features/crm', () => ({
  useActualizarDetallesOportunidad: mocks.mutation,
  useMiembrosDespacho: mocks.empty,
  useOportunidades: mocks.empty,
  useOportunidadesCompletas: () => ({ ...mocks.empty(), data: mocks.leads }),
  useRefrescoTablerosEnVivo: vi.fn(),
}))
vi.mock('@/features/expedientes', () => ({ useExpedientesPersistentes: mocks.empty }))
vi.mock('@/features/tareas', () => ({ useCrearTarea: mocks.mutation }))
vi.mock('@/features/onboarding/ui/payment-evidence', () => ({
  PaymentEvidenceList: () => null,
  PaymentEvidencePicker: () => null,
  uploadPaymentEvidence: vi.fn(),
}))
vi.mock('@/features/onboarding/application', async (importOriginal) => ({
  ...(await importOriginal<typeof OnboardingApplication>()),
  useOnboardings: () => ({ ...mocks.empty(), data: mocks.onboardings }),
  useEventosOnboarding: mocks.empty,
  useAbrirExpedienteDesdeOnboarding: () => ({ isPending: false, mutateAsync: mocks.openCase }),
  useActualizarSiguienteAccion: mocks.mutation,
  useCrearOnboarding: mocks.mutation,
  useRegistrarComunicacionOnboarding: mocks.mutation,
  useTransicionarOnboarding: mocks.mutation,
}))

const item = {
  id: 'onboarding-1',
  referencia: 'ONB-1',
  contactoId: 'contacto-1',
  oportunidadId: 'lead-1',
  expedienteId: 'case-1',
  asunto: 'Asunto seleccionado',
  fase: 'completed',
  cambioFase: '2020-01-01',
  presupuestoReferencia: null,
  importePresupuesto: null,
  proformaEnviada: null,
  pagoConfirmado: '2020-01-01',
  inicioProgramado: null,
  inicioRealizado: null,
  responsableId: null,
  siguienteAccion: '',
  modalidad: 'pending',
  version: 1,
}

afterEach(() => {
  cleanup()
  mocks.onboardings = []
  mocks.leads = []
  mocks.openCase.mockClear()
})

describe('enlace directo a onboarding', () => {
  it('muestra el onboarding indicado, incluso si está completado y los filtros lo ocultaban', () => {
    mocks.onboardings = [item, { ...item, id: 'onboarding-2', referencia: 'ONB-2' }]
    const page = render(<OnboardingPage />)
    fireEvent.click(screen.getByLabelText('Mostrar completados'))
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
    page.rerender(<OnboardingPage abrir="onboarding-1" />)
    expect(screen.getByText('ONB-1')).toBeTruthy()
    expect(screen.queryByText('ONB-2')).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Ver todos los onboardings' }).getAttribute('href'),
    ).toBe('/onboarding')
  })

  it('avisa cuando el onboarding solicitado no existe', () => {
    render(<OnboardingPage abrir="desconocido" />)
    expect(screen.getByRole('status').textContent).toContain('No se ha encontrado')
  })

  it('transfiere la materia del lead al abrir el expediente', async () => {
    mocks.onboardings = [{ ...item, expedienteId: null, fase: 'payment' }]
    mocks.leads = [
      {
        id: 'lead-1',
        area: 'SUCESIONES Y HERENCIAS',
        detalles: { naturalezaAsunto: { valor: 'extrajudicial' } },
      },
    ]
    render(<OnboardingPage abrir="onboarding-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir expediente' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Abrir expediente' }),
    )
    await waitFor(() =>
      expect(mocks.openCase).toHaveBeenCalledWith(
        expect.objectContaining({ area: 'SUCESIONES Y HERENCIAS' }),
      ),
    )
  })
})
