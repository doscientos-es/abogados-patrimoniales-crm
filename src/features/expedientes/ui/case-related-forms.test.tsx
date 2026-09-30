import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CaseRelatedForms } from './case-related-forms'

const props = {
  expedienteId: 'case-1',
  contactos: [{ id: 'contact-1', nombre: 'Inversiones Torrelodones' }] as never,
  miembros: [{ id: 'member-1', nombre: 'Luis Ferrán' }] as never,
  pending: false,
  onParticipant: vi.fn().mockResolvedValue(undefined),
  onWorkstream: vi.fn().mockResolvedValue(undefined),
}

describe('CaseRelatedForms', () => {
  afterEach(cleanup)

  it.each([
    ['participant', 'Añadir interviniente', 'Nombre'],
    ['workstream', 'Nueva línea', 'Título de la línea *'],
  ] as const)('opens the %s form in a dialog', (section, trigger, field) => {
    render(<CaseRelatedForms {...props} section={section} />)

    fireEvent.click(screen.getByRole('button', { name: trigger }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText(field)).toBeTruthy()
  })

  it('guides the new workstream form with concrete placeholders', () => {
    render(<CaseRelatedForms {...props} section="workstream" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nueva línea' }))

    expect((screen.getByLabelText('Título de la línea *') as HTMLInputElement).placeholder).toBe(
      'Ej. Revisión de cargas registrales',
    )
    expect((screen.getByLabelText('Tipo (opcional)') as HTMLInputElement).placeholder).toBe(
      'Ej. Análisis jurídico',
    )
    expect(
      (screen.getByLabelText('Objetivos (opcional)') as HTMLTextAreaElement).placeholder,
    ).toBe('Qué se pretende conseguir y qué resultado se espera.')
  })

  it('submits a workstream with objectives and status, without priority', async () => {
    const onWorkstream = vi.fn().mockResolvedValue(undefined)
    render(<CaseRelatedForms {...props} onWorkstream={onWorkstream} section="workstream" />)
    fireEvent.click(screen.getByRole('button', { name: 'Nueva línea' }))

    expect(screen.queryByLabelText('Prioridad')).toBeNull()
    expect(screen.queryByLabelText('Descripción (opcional)')).toBeNull()

    fireEvent.change(screen.getByLabelText('Título de la línea *'), {
      target: { value: 'Recuperación posesoria' },
    })
    fireEvent.change(screen.getByLabelText('Objetivos (opcional)'), {
      target: { value: 'Recuperar la posesión' },
    })
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'in_progress' } })
    fireEvent.change(screen.getByLabelText('Responsable (opcional)'), {
      target: { value: 'member-1' },
    })
    fireEvent.change(screen.getByLabelText('Fecha objetivo (opcional)'), {
      target: { value: '2026-12-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear línea' }))

    await vi.waitFor(() => expect(onWorkstream).toHaveBeenCalledTimes(1))
    const input = onWorkstream.mock.calls[0]?.[0]
    expect(input).toEqual({
      expedienteId: 'case-1',
      titulo: 'Recuperación posesoria',
      tipo: '',
      objetivos: 'Recuperar la posesión',
      estado: 'in_progress',
      asignadoId: 'member-1',
      fechaObjetivo: '2026-12-01',
    })
  })
})
