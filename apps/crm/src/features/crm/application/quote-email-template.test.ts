import { describe, expect, it } from 'vitest'

import { nombrePilaParaPlantilla, resolverVariablesPlantilla } from './quote-email-template'

describe('nombre para plantillas de presupuesto', () => {
  it('normaliza nombres en mayúsculas sin perder nombres compuestos ni tildes', () => {
    expect(nombrePilaParaPlantilla(' MARÍA JOSÉ ', 'MARÍA JOSÉ PÉREZ', 'MARÍA JOSÉ PÉREZ')).toBe(
      'María José',
    )
    expect(nombrePilaParaPlantilla('ANNE-MARIE', 'ANNE-MARIE PÉREZ', 'ANNE-MARIE PÉREZ')).toBe(
      'Anne-Marie',
    )
    expect(nombrePilaParaPlantilla('Maite', 'Maite Pérez', 'Maite Pérez')).toBe('Maite')
  })

  it('no inventa un nombre para una empresa o una copia cuyo destinatario ha cambiado', () => {
    expect(nombrePilaParaPlantilla('', 'EMPRESA SL', 'EMPRESA SL')).toBe('')
    expect(nombrePilaParaPlantilla('ANA', 'ANA NUEVA', 'ANA ANTERIOR')).toBe('')
    expect(nombrePilaParaPlantilla('ANA', '', '')).toBe('')
  })

  it('resuelve la nueva variable sin alterar las variables existentes', () => {
    expect(
      resolverVariablesPlantilla(
        'Buenos días, {{nombre_pila}}: {{nombre_cliente}} {{desconocida}}.',
        {
          nombre_pila: 'Koldo',
          nombre_cliente: 'KOLDO ARREGI',
        },
      ),
    ).toBe('Buenos días, Koldo: KOLDO ARREGI.')
  })

  it('evita una coma sobrante si no se dispone del nombre de pila', () => {
    expect(resolverVariablesPlantilla('Buenos días, {{nombre_pila}}:', { nombre_pila: '' })).toBe(
      'Buenos días:',
    )
  })
})
