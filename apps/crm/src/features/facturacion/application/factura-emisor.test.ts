import { describe, expect, it } from 'vitest'

import { leerDatosEmisor } from './factura-emisor'

const emisor = {
  legal_name: 'Despacho SL',
  tax_id: 'B12345678',
  address: 'Bilbao',
  professional_registration: 'Colegiado 1',
}

describe('copia del emisor de la factura', () => {
  it('lee únicamente la copia guardada al emitir', () => {
    expect(leerDatosEmisor({ datos_emisor: emisor })).toEqual(emisor)
  })

  it('no inventa datos para documentos históricos o copias incompletas', () => {
    for (const details of [
      null,
      {},
      [],
      { datos_emisor: [] },
      { datos_emisor: { ...emisor, tax_id: ' ' } },
      { datos_emisor: { ...emisor, address: 123 } },
    ]) {
      expect(leerDatosEmisor(details)).toBeNull()
    }
  })
})
