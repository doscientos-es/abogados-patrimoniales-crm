import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CaseEditForm } from './case-edit-form'

const expediente = {
  id: 'case-1',
  referencia: 'AP_11',
  contactoPrincipalId: 'contact-1',
  oportunidadId: null,
  titulo: 'Herencia familiar',
  area: 'Sucesiones',
  tipoAsunto: 'Herencia',
  naturaleza: 'Extrajudicial',
  estadoGeneral: 'active',
  fase: 'Diagnóstico – Objetivos – Estrategia',
  estadoOperativo: 'pending',
  prioridad: 'Media',
  asignadoId: 'member-1',
  fechaApertura: '2026-09-07',
  fechaCierre: null,
  proximaAccion: 'Solicitar documentación',
  dondeEstamos: 'Pendiente de primera reunión.',
  version: 2,
  actualizadoEn: '2026-09-07T10:00:00Z',
} as never

afterEach(cleanup)

describe('CaseEditForm', () => {
  it('groups workflow controls as selects and submits the edited values', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <CaseEditForm
        expediente={expediente}
        miembros={[{ id: 'member-1', nombre: 'Ana López' }] as never}
        pending={false}
        onSave={onSave}
      />,
    )

    expect(screen.getByText('Gestión operativa')).toBeTruthy()
    expect(screen.getByLabelText('Fase operativa *').tagName).toBe('SELECT')
    expect(screen.getByLabelText('De quién depende *').tagName).toBe('SELECT')
    expect(screen.getByText(/Determina la columna de seguimiento/i)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Fase operativa *'), { target: { value: 'En curso' } })
    fireEvent.change(screen.getByLabelText('De quién depende *'), {
      target: { value: 'En espera de tercero' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'case-1',
          versionEsperada: 2,
          fase: 'En curso',
          estadoOperativo: 'En espera de tercero',
        }),
      ),
    )
  })
})
