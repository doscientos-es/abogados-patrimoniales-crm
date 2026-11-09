import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeadNoteDialog } from './lead-workspace'

afterEach(cleanup)

function renderDialog(onSubmit = vi.fn().mockResolvedValue(true)) {
  render(
    <LeadNoteDialog
      title=""
      content=""
      highlighted={false}
      pending={false}
      onTitleChange={vi.fn()}
      onContentChange={vi.fn()}
      onHighlightedChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  )
  return onSubmit
}

describe('LeadNoteDialog', () => {
  it('opens the note form only after the create action is selected', () => {
    renderDialog()

    expect(screen.queryByLabelText('Contenido *')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Crear nota interna' }))

    expect(screen.getByRole('dialog', { name: 'Nueva nota interna' })).toBeTruthy()
    expect(screen.getByLabelText('Contenido *')).toBeTruthy()
  })

  it('closes after a successful save but stays open when saving fails', async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    renderDialog(onSubmit)
    fireEvent.click(screen.getByRole('button', { name: 'Crear nota interna' }))
    const form = screen.getByRole('form', { name: 'Formulario de nueva nota interna' })

    fireEvent.submit(form)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog', { name: 'Nueva nota interna' })).toBeTruthy()

    fireEvent.submit(form)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
