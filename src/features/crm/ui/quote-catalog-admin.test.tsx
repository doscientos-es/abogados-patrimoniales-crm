import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  role: 'lawyer' as string,
  saveService: vi.fn().mockResolvedValue(undefined),
  importServices: vi.fn().mockResolvedValue({ inserted: 1, skipped: 0 }),
  toggleService: vi.fn(),
}))

vi.mock('@/features/auth', () => ({
  useActiveMembership: () => ({ data: { firmId: 'firm-1', role: mocks.role }, isPending: false }),
  useAuthSession: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/features/crm', () => ({
  useQuoteServices: () => ({
    data: [
      {
        id: 'service-1',
        code: 'AR1',
        name: 'Contrato de arrendamiento',
        description: 'Redacción de contrato',
        family: 'Arrendamientos',
        priceCents: 10000,
        vatPct: 21,
        withholdingPct: null,
        costCents: 0,
        active: true,
        sourceData: {},
      },
    ],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useImportEngagementBlocks: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useImportQuoteEmailTemplates: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useQuoteBlocks: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
  useQuoteEmailTemplates: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
  useSaveQuoteService: () => ({ isPending: false, mutateAsync: mocks.saveService }),
  useImportQuoteServices: () => ({ isPending: false, mutateAsync: mocks.importServices }),
  useUpdateQuoteServiceState: () => ({ isPending: false, mutate: mocks.toggleService }),
  useSaveEngagementBlock: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSaveQuoteEmailTemplate: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useSetDefaultQuoteTemplate: () => ({ isPending: false, mutate: vi.fn() }),
}))

import { QuoteCatalogAdmin } from './quote-catalog-admin'

afterEach(() => {
  cleanup()
  mocks.role = 'lawyer'
  mocks.saveService.mockClear()
})

describe('administración del catálogo de servicios', () => {
  it('permite a un abogado editar el servicio con persistencia del precio como céntimos', async () => {
    render(<QuoteCatalogAdmin kind="services" />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Precio base (€)'), { target: { value: '125,50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(mocks.saveService).toHaveBeenCalledOnce())
    expect(mocks.saveService.mock.calls[0]?.[0]).toMatchObject({
      id: 'service-1',
      code: 'AR1',
      priceCents: 12550,
    })
  })

  it('carga el catálogo estándar de servicios a través del importador', async () => {
    render(<QuoteCatalogAdmin kind="services" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cargar catálogo estándar' }))

    await waitFor(() => expect(mocks.importServices).toHaveBeenCalledOnce())
    const rows = mocks.importServices.mock.calls[0]?.[0] as string[][]
    expect(rows).toHaveLength(59)
    expect(rows.every((row) => row.length >= 11)).toBe(true)
    expect(rows.some((row) => row[4] === 'SD1' && row[6] === '170,00€')).toBe(true)
  })

  it('permite consultar el catálogo a miembros sin permisos de edición', () => {
    mocks.role = 'paralegal'
    render(<QuoteCatalogAdmin kind="services" />)

    expect(screen.getByText('Contrato de arrendamiento')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nuevo servicio' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cargar catálogo estándar' })).toBeNull()
    expect(screen.getByText(/Solo propietarios, administradores y abogados/)).toBeTruthy()
  })
})
