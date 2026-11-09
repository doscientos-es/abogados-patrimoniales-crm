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
      creating={false}
      onCreate={onCreate}
      onCreated={vi.fn()}
      onError={vi.fn()}
    />,
  )
  return onCreate
}

describe('ContactInternalNotes', () => {
  it('shows the post-it editor directly without a dialog', () => {
    renderNotes()

    expect(screen.getByLabelText('Título de nota interna')).toBeTruthy()
    expect(screen.getByLabelText('Contenido de nota interna')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('saves the post-it note with its flags', async () => {
    const onCreate = renderNotes()
    fireEvent.change(screen.getByLabelText('Título de nota interna'), {
      target: { value: 'Preferencias' },
    })
    fireEvent.change(screen.getByLabelText('Contenido de nota interna'), {
      target: { value: 'Información relevante' },
    })
    fireEvent.click(screen.getByLabelText('Destacada'))
    fireEvent.click(screen.getByLabelText('Advertencia crítica'))
    fireEvent.click(screen.getByRole('button', { name: 'Añadir nota' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      title: 'Preferencias',
      content: 'Información relevante',
      highlighted: true,
      critical: true,
    }))
  })
})
