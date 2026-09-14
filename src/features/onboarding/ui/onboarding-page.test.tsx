import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CreateOnboardingDialog,
  leadsDisponiblesParaProforma,
  OnboardingCard,
  onboardingErrorMessage,
} from './onboarding-page'

type MockLinkProps = {
  children: ReactNode
  className?: string
  to?: string
  params?: unknown
  search?: unknown
  'aria-label'?: string
  title?: string
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to = '/', params: _params, search: _search, ...props }: MockLinkProps) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}))

afterEach(cleanup)

describe('CreateOnboardingDialog', () => {
  it('traduce los errores estructurados de la creación de onboarding', () => {
    expect(onboardingErrorMessage({ message: 'This lead already has onboarding' })).toBe(
      'Este Lead ya tiene una proforma registrada.',
    )
  })

  it('incluye solo Leads aceptados sin onboarding en el selector', () => {
    const aceptado = {
      id: 'lead-aceptado',
      referencia: 'LEAD-001',
      contactoId: 'contacto-1',
      titulo: 'Reparto de herencia',
      fase: 'won',
      area: '',
      subestado: '',
      prioridad: 'Media',
      estadoOperativo: '',
      origen: '',
      creada: '',
      actualizada: '',
      asignadoId: null,
    } as const
    const pendiente = { ...aceptado, id: 'lead-pendiente', fase: 'entry' } as const

    expect(leadsDisponiblesParaProforma([aceptado, pendiente], [])).toEqual([aceptado])
    expect(leadsDisponiblesParaProforma([aceptado], [{ oportunidadId: aceptado.id } as never])).toEqual(
      [],
    )
  })

  it('agrupa las acciones auxiliares como iconos y destaca la confirmación de pago', () => {
    render(
      <OnboardingCard
        item={{
          id: 'onboarding-1',
          referencia: 'ONB-2026-0001',
          contactoId: 'contacto-1',
          oportunidadId: 'lead-1',
          expedienteId: null,
          asunto: 'Reparto de herencia',
          fase: 'proforma',
          cambioFase: '2026-09-14',
          presupuestoReferencia: 'PR-2026-0001',
          importePresupuesto: 1500,
          proformaEnviada: '2026-09-14',
          pagoConfirmado: null,
          inicioProgramado: null,
          inicioRealizado: null,
          responsableId: null,
          siguienteAccion: '',
          modalidad: 'pending',
          version: 1,
        }}
        eventos={[]}
        actorNames={new Map()}
        contacto={{ nombre: 'Ana López' } as never}
        pending={false}
        onAction={vi.fn().mockResolvedValue(undefined)}
        onNextAction={vi.fn().mockResolvedValue(undefined)}
        onCommunication={vi.fn().mockResolvedValue(undefined)}
        onTask={vi.fn().mockResolvedValue(undefined)}
        onOpenCase={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Marcar pago confirmado' }).className).toContain(
      'bg-success/15',
    )
    expect(screen.getByRole('button', { name: 'Editar siguiente acción' }).className).toContain(
      'size-8',
    )
    expect(screen.getByRole('button', { name: 'Registrar borrador de email' }).className).toContain(
      'size-8',
    )
    expect(screen.getByRole('button', { name: 'Registrar llamada' }).className).toContain('size-8')
    expect(screen.getByRole('button', { name: 'Crear tarea' }).className).toContain('size-8')
    expect(screen.getByRole('button', { name: 'Crear recordatorio' }).className).toContain('size-8')
    expect(screen.getByRole('link', { name: 'Ver Lead' })).toBeTruthy()
    expect(screen.queryByText('Ver contacto')).toBeNull()
  })

  it('abre y guarda la siguiente acción desde su botón de icono', async () => {
    const onNextAction = vi.fn().mockResolvedValue(undefined)
    render(
      <OnboardingCard
        item={{
          id: 'onboarding-1',
          referencia: 'ONB-2026-0001',
          contactoId: 'contacto-1',
          oportunidadId: 'lead-1',
          expedienteId: null,
          asunto: 'Reparto de herencia',
          fase: 'proforma',
          cambioFase: '2026-09-14',
          presupuestoReferencia: 'PR-2026-0001',
          importePresupuesto: 1500,
          proformaEnviada: '2026-09-14',
          pagoConfirmado: null,
          inicioProgramado: null,
          inicioRealizado: null,
          responsableId: null,
          siguienteAccion: '',
          modalidad: 'pending',
          version: 1,
        }}
        eventos={[]}
        actorNames={new Map()}
        contacto={{ nombre: 'Ana López' } as never}
        pending={false}
        onAction={vi.fn().mockResolvedValue(undefined)}
        onNextAction={onNextAction}
        onCommunication={vi.fn().mockResolvedValue(undefined)}
        onTask={vi.fn().mockResolvedValue(undefined)}
        onOpenCase={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar siguiente acción' }))
    fireEvent.change(screen.getByLabelText('Siguiente acción'), {
      target: { value: 'Llamar al cliente el viernes' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onNextAction).toHaveBeenCalledWith('Llamar al cliente el viernes'))
  })

  it('muestra los campos obligatorios al registrar una proforma', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <CreateOnboardingDialog
        oportunidades={[
          {
            id: 'lead-1',
            referencia: 'LEAD-001',
            contactoId: 'contacto-1',
            titulo: 'Reparto de herencia',
            fase: 'won',
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

    expect(screen.getByRole('dialog').className).toContain('sm:max-w-3xl')
    expect(screen.getByRole('dialog').className).toContain('lg:max-w-4xl')
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
