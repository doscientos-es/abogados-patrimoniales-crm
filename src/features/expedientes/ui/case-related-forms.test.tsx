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
      (screen.getByLabelText('Descripción (opcional)') as HTMLTextAreaElement).placeholder,
    ).toBe('Delimita el trabajo y el resultado que se espera conseguir.')
  })
})
