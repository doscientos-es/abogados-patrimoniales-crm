import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContactInternalNotes } from './contact-detail'

afterEach(cleanup)

function renderNotes(onCreate = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ContactInternalNotes
      notes={[]}
      loading={false}
      error={false}
      contactId="contact-1"
      contactOptions={[{ id: 'contact-1', tipoPersona: 'Persona física', nombre: 'Ana' } as never]}
      caseOptions={[]}
      opportunityOptions={[]}
      memberOptions={[]}
      casesLoading={false}
      opportunitiesLoading={false}
      membersLoading={false}
      creating={false}
      onCreate={onCreate}
      onCreated={vi.fn()}
      onError={vi.fn()}
    />,
  )
  return onCreate
}

describe('ContactInternalNotes', () => {
  it('keeps the note editor closed until the create action is selected', () => {
    renderNotes()

    expect(screen.queryByLabelText('Contenido (obligatorio)')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Crear nota interna' }))

    expect(screen.getByRole('dialog', { name: 'Nueva nota interna' })).toBeTruthy()
    expect(screen.getByLabelText('Contenido (obligatorio)')).toBeTruthy()
  })

  it('saves a note from the dialog and closes it after success', async () => {
    const onCreate = renderNotes()
    fireEvent.click(screen.getByRole('button', { name: 'Crear nota interna' }))
    fireEvent.change(screen.getByLabelText('Contenido (obligatorio)'), {
      target: { value: 'Información relevante' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Información relevante' }),
      ),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
