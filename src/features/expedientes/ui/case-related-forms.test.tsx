import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CaseRelatedForms } from './case-related-forms'

const props = {
  expedienteId: 'case-1',
  contactos: [{ id: 'contact-1', nombre: 'Inversiones Torrelodones' }] as never,
  miembros: [{ id: 'member-1', nombre: 'Luis Ferrán' }] as never,
  lineas: [{ id: 'line-1', titulo: 'Due diligence' }] as never,
  pending: false,
  onParticipant: vi.fn().mockResolvedValue(undefined),
  onWorkstream: vi.fn().mockResolvedValue(undefined),
  onActivity: vi.fn().mockResolvedValue(undefined),
}

describe('CaseRelatedForms', () => {
  afterEach(cleanup)

  it.each([
    ['participant', 'Añadir interviniente', 'Nombre'],
    ['workstream', 'Nueva línea', 'Título'],
    ['activity', 'Registrar actuación', 'Tipo'],
  ] as const)('opens the %s form in a dialog', (section, trigger, field) => {
    render(<CaseRelatedForms {...props} section={section} />)

    fireEvent.click(screen.getByRole('button', { name: trigger }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText(field)).toBeTruthy()
  })
})
