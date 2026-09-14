import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CreateOnboardingDialog } from './onboarding-page'

afterEach(cleanup)

describe('CreateOnboardingDialog', () => {
  it('muestra Leads activos de cualquier fase y distingue los campos obligatorios', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <CreateOnboardingDialog
        oportunidades={[
          {
            id: 'lead-1',
            referencia: 'LEAD-001',
            contactoId: 'contacto-1',
            titulo: 'Reparto de herencia',
            fase: 'entry',
            area: '',
            subestado: '',
            prioridad: 'Media',
            estadoOperativo: '',
            origen: '',
            creada: '',
            actualizada: '',
            asignadoId: null,
          },
        ]}
        contactosPorId={new Map([['contacto-1', { nombre: 'Ana López' }]]) as never}
        miembros={[]}
        pending={false}
        onCreate={onCreate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /registrar proforma/i }))

    expect(screen.getByRole('dialog').className).toContain('sm:max-w-4xl')
    expect(screen.getByRole('dialog').className).toContain('lg:max-w-5xl')
    expect(screen.getByText('Los campos marcados con * son obligatorios.')).toBeTruthy()
    expect(screen.getByLabelText('Lead *')).toBeTruthy()
    expect(screen.getByLabelText('Importe acordado (Opcional)')).toBeTruthy()
    expect(screen.getByRole('option', { name: /lead-001.*reparto de herencia/i })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Lead *'), { target: { value: 'lead-1' } })
    fireEvent.change(screen.getByLabelText('Referencia del presupuesto *'), {
      target: { value: 'PR-2026-0004' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^registrar proforma$/i }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          asunto: 'Reparto de herencia',
          contactoId: 'contacto-1',
          oportunidadId: 'lead-1',
          presupuestoReferencia: 'PR-2026-0004',
        }),
      ),
    )
  })
})