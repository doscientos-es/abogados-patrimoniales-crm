import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CaseCreateDialog } from './case-create-dialog'

describe('CaseCreateDialog', () => {
  it('notifies the id of a newly created case', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'case-new' })
    const onCreated = vi.fn()
    render(
      <CaseCreateDialog
        contactos={[{ id: 'contact-1', nombre: 'Ana López' }]}
        miembros={[]}
        pending={false}
        onCreate={onCreate}
        onCreated={onCreated}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo expediente' }))
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Herencia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear expediente' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('case-new'))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Herencia' }))
  })
})
