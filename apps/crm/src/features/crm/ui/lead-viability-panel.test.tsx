import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OportunidadPersistida } from '@/features/crm'

import { LeadViabilityPanel } from './lead-viability-panel'

const mocks = vi.hoisted(() => ({ change: vi.fn() }))
vi.mock('@/features/crm', () => ({
  useAccionViabilidad: () => ({ isPending: false, mutateAsync: mocks.change }),
}))

function fixture(choice: 'apto' | 'pendiente' | 'no_apto', sent = false) {
  const opportunity: OportunidadPersistida = {
    id: 'lead-1',
    version: 3,
    referencia: 'OP-TEST',
    contactoId: 'contact-1',
    titulo: 'Consulta de prueba',
    area: '',
    fase: choice === 'apto' ? 'first_meeting' : choice === 'pendiente' ? 'qualification' : 'lost',
    subestado: '',
    prioridad: 'Media',
    estadoOperativo: '',
    origen: '',
    creada: '',
    actualizada: '',
    asignadoId: 'user-1',
    descripcion: '',
    valorEstimado: null,
    probabilidad: 0,
    fechaObjetivo: null,
    archivadoEn: null,
    motivoArchivo: null,
    detalles: {
      urgencia: { opcion: 'Sí, existe una fecha o plazo concreto' },
      viabilidadInicial: {
        flujo: 2,
        resultado: choice,
        ...(sent
          ? {
              comunicado_fecha: '2026-11-27T12:00:00Z',
              comunicado_via: 'whatsapp',
            }
          : {}),
      },
    },
  }
  return (
    <LeadViabilityPanel
      opportunity={opportunity}
      firmId="firm-1"
      tasks={[]}
      tasksLoaded
      canAct
      contact={{ email: 'test@example.test', phone: '+34 612 345 678' }}
    />
  )
}

beforeEach(() => mocks.change.mockReset().mockResolvedValue({}))

describe('Viability follow-up', () => {
  it('edits a rejection notice, previews both channels and only records a manually confirmed send', async () => {
    const { rerender } = render(fixture('no_apto'))
    expect(screen.getByText('Comunicación pendiente')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('plazo concreto')
    fireEvent.change(screen.getByLabelText('Mensaje de no aceptación'), {
      target: { value: 'Mensaje ficticio' },
    })
    expect(screen.getByRole('link', { name: /Abrir correo/ }).getAttribute('href')).toContain(
      'body=Mensaje%20ficticio',
    )
    fireEvent.change(screen.getByLabelText('Canal de comunicación'), {
      target: { value: 'whatsapp' },
    })
    expect(screen.getByRole('link', { name: /Abrir WhatsApp/ }).getAttribute('href')).toBe(
      'https://wa.me/34612345678?text=Mensaje%20ficticio',
    )
    expect(mocks.change).not.toHaveBeenCalled()
    const register = screen.getByRole('button', { name: 'Registrar envío' })
    expect(register.hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Confirmo que he enviado/ }))
    fireEvent.click(register)
    await waitFor(() =>
      expect(mocks.change).toHaveBeenCalledWith({
        id: 'lead-1',
        version: 3,
        action: 'confirm_notice',
        channel: 'whatsapp',
      }),
    )
    rerender(fixture('no_apto', true))
    expect(screen.getByText(/Comunicación registrada por WhatsApp el/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar envío' })).toBeNull()
  })

  it('requires a date when reclassifying after review', async () => {
    render(fixture('pendiente'))
    const submit = screen.getByRole('button', { name: /Guardar revisión/ })
    fireEvent.click(submit)
    expect(mocks.change).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Fecha de la siguiente acción'), {
      target: { value: '2099-12-10' },
    })
    fireEvent.click(submit)
    await waitFor(() =>
      expect(mocks.change).toHaveBeenCalledWith({
        id: 'lead-1',
        version: 3,
        action: 'review',
        result: 'apto',
        date: '2099-12-10',
        acceptedDeadlineWarning: false,
      }),
    )
  })

  it('shows missing follow-up and registers an explicit conflict check only', async () => {
    render(fixture('apto'))
    expect(screen.getByRole('alert').textContent).toContain('APTO sin cita ni aviso activo')
    const button = screen.getByRole('button', { name: 'Registrar comprobación' })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /He revisado el conflicto/ }))
    fireEvent.click(button)
    await waitFor(() =>
      expect(mocks.change).toHaveBeenCalledWith({
        id: 'lead-1',
        version: 3,
        action: 'confirm_conflict_check',
      }),
    )
  })
})
