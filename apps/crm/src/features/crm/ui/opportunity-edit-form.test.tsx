import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { OpportunityEditForm } from './opportunity-edit-form'

afterEach(cleanup)

it('conserva la materia anterior y permite reclasificarla con el catálogo', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <OpportunityEditForm
      oportunidad={{
        id: 'lead-1', version: 1, titulo: 'Herencia', area: 'Sucesiones',
        prioridad: 'Media', estadoOperativo: 'Pendiente', origen: '', descripcion: '',
        asignadoId: null, valorEstimado: null,
      } as never}
      miembros={[]}
      practiceAreas={['SUCESIONES Y HERENCIAS']}
      miembrosCargando={false}
      miembrosError={false}
      guardando={false}
      onSave={onSave}
    />,
  )
  const area = screen.getByLabelText('Área jurídica') as HTMLSelectElement
  expect(area.value).toBe('Sucesiones')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ area: 'Sucesiones' })))
  fireEvent.change(area, { target: { value: 'SUCESIONES Y HERENCIAS' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ area: 'SUCESIONES Y HERENCIAS' })))
})