import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'

afterEach(cleanup)

it('conserva atributos y permite personalizar los estilos de la tabla', () => {
  render(
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="text-right">
            Importe
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow data-state="selected">
          <TableCell>100 €</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  )

  const heading = screen.getByRole('columnheader', { name: 'Importe' })
  expect(heading.getAttribute('scope')).toBe('col')
  expect(heading.className).toContain('text-right')
  expect(heading.className).toContain('normal-case')
  expect(screen.getByText('100 €').closest('tr')?.getAttribute('data-state')).toBe('selected')
})
