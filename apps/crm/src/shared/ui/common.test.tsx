import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'

import { SectionHeader, ViewSwitch } from './common'

afterEach(cleanup)

it('mantiene el título compacto, los datos y las acciones de la cabecera', () => {
  render(
    <SectionHeader title="Contactos" meta="2 activos" actions={<button>Nuevo contacto</button>} />,
  )

  const heading = screen.getByRole('heading', { level: 1, name: 'Contactos' })
  expect(heading.className).toContain('text-xl')
  expect(heading.className).toContain('sm:text-2xl')
  expect(screen.getByText('2 activos')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Nuevo contacto' })).toBeTruthy()
  expect(heading.parentElement?.parentElement?.querySelector('p')).toBeNull()
})

it('permite cambiar de vista y comunica cuál está activa', () => {
  function Example() {
    const [view, setView] = useState('kanban')
    return (
      <ViewSwitch
        value={view}
        onChange={setView}
        options={[
          { id: 'kanban', label: 'Kanban' },
          { id: 'lista', label: 'Lista' },
        ]}
      />
    )
  }
  render(<Example />)
  const kanban = screen.getByRole('button', { name: 'Kanban' })
  const list = screen.getByRole('button', { name: 'Lista' })
  expect(kanban.getAttribute('aria-pressed')).toBe('true')
  expect(list.getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(list)
  expect(kanban.getAttribute('aria-pressed')).toBe('false')
  expect(list.getAttribute('aria-pressed')).toBe('true')
})
