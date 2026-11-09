import { describe, expect, it } from 'vitest'

import {
  calcularTotales,
  facturasRectificadas,
  puedeEditarse,
  puedeEmitirse,
  puedeRectificarse,
  puedeRegistrarCobro,
  resumenFacturacion,
  validarBorrador,
} from './factura-ciclo'
import type { FacturaPersistida } from './factura-types'

const factura = (overrides: Partial<FacturaPersistida> = {}): FacturaPersistida => ({
  id: 'inv-1',
  contactoId: 'contact-1',
  asuntoId: 'case-1',
  asuntoReferencia: 'EXP-2026-0001',
  referencia: 'A-2026-000001',
  cliente: 'Cliente SL',
  concepto: 'Honorarios',
  moneda: 'EUR',
  serie: 'A',
  ejercicio: 2026,
  numero: 1,
  baseImponible: 1000,
  cuotaIva: 210,
  importeTotal: 1210,
  importeCobrado: 0,
  importePendiente: 1210,
  emision: '2026-09-09',
  vencimiento: null,
  estado: 'issued',
  tipo: 'standard',
  rectificaFacturaId: null,
  motivoAnulacion: '',
  version: 1,
  lineas: [],
  cobros: [],
  ...overrides,
})

describe('cálculo de totales', () => {
  it('redondea cada línea antes de acumular la base y la cuota', () => {
    expect(
      calcularTotales([
        { descripcion: 'Honorarios', cantidad: 1.5, precioUnitario: 333.33, tipoIva: 21 },
        { descripcion: 'Suplidos', cantidad: 2, precioUnitario: 10.005, tipoIva: 0 },
      ]),
    ).toEqual({ baseImponible: 520.01, cuotaIva: 105, total: 625.01 })
  })

  it('devuelve totales a cero sin líneas', () => {
    expect(calcularTotales([])).toEqual({ baseImponible: 0, cuotaIva: 0, total: 0 })
  })
})

describe('validación del borrador', () => {
  const lineas = [{ descripcion: 'Honorarios', cantidad: 1, precioUnitario: 100, tipoIva: 21 }]

  it('acepta un borrador completo', () => {
    expect(
      validarBorrador({ concepto: 'Honorarios', emision: '2026-09-09', vencimiento: null, lineas }),
    ).toBeNull()
  })

  it('rechaza un vencimiento anterior a la emisión', () => {
    expect(
      validarBorrador({
        concepto: 'Honorarios',
        emision: '2026-09-09',
        vencimiento: '2026-09-01',
        lineas,
      }),
    ).toBe('El vencimiento no puede ser anterior a la fecha de factura.')
  })

  it('exige concepto y al menos una línea válida', () => {
    expect(
      validarBorrador({ concepto: '  ', emision: '2026-09-09', vencimiento: null, lineas }),
    ).toBe('El concepto de la factura es obligatorio.')
    expect(
      validarBorrador({
        concepto: 'Honorarios',
        emision: '2026-09-09',
        vencimiento: null,
        lineas: [],
      }),
    ).toBe('La factura necesita al menos una línea.')
    expect(
      validarBorrador({
        concepto: 'Honorarios',
        emision: '2026-09-09',
        vencimiento: null,
        lineas: [{ descripcion: 'Honorarios', cantidad: 0, precioUnitario: 100, tipoIva: 21 }],
      }),
    ).toBe('La cantidad de cada línea debe ser mayor que cero.')
  })
})

describe('transiciones del ciclo de factura', () => {
  it('solo permite editar y emitir borradores con importe', () => {
    const borrador = factura({
      estado: 'draft',
      numero: null,
      lineas: [
        {
          id: 'line-1',
          numero: 1,
          descripcion: 'Honorarios',
          cantidad: 1,
          precioUnitario: 1000,
          tipoIva: 21,
          baseImponible: 1000,
          cuotaIva: 210,
        },
      ],
    })
    expect(puedeEditarse(borrador)).toBe(true)
    expect(puedeEmitirse(borrador)).toBe(true)
    expect(puedeEmitirse({ ...borrador, importeTotal: 0 })).toBe(false)
    expect(puedeEditarse(factura())).toBe(false)
  })

  it('cobra solo facturas emitidas con importe pendiente', () => {
    expect(puedeRegistrarCobro(factura())).toBe(true)
    expect(puedeRegistrarCobro(factura({ importePendiente: 0, estado: 'paid' }))).toBe(false)
    expect(puedeRegistrarCobro(factura({ tipo: 'credit_note' }))).toBe(false)
  })

  it('rectifica una única vez cada factura numerada', () => {
    const rectificativa = factura({ id: 'inv-2', tipo: 'credit_note', rectificaFacturaId: 'inv-1' })
    const rectificadas = facturasRectificadas([factura(), rectificativa])
    expect(puedeRectificarse(factura())).toBe(true)
    expect(puedeRectificarse(factura(), rectificadas)).toBe(false)
    expect(puedeRectificarse(factura({ estado: 'draft', numero: null }))).toBe(false)
  })
})

describe('resumen de facturación', () => {
  it('limita lo emitido al ejercicio y acumula el pendiente de cobro de cualquier año', () => {
    expect(
      resumenFacturacion(
        [
          factura({ importeCobrado: 210, importePendiente: 1000, estado: 'partially_paid' }),
          factura({ id: 'inv-2', ejercicio: 2025 }),
          factura({ id: 'inv-3', estado: 'draft', numero: null, importePendiente: 500 }),
        ],
        2026,
      ),
    ).toEqual({ emitido: 1210, cobrado: 210, pendiente: 2210, borradores: 1 })
  })
})
