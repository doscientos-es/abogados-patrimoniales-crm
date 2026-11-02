import { describe, expect, it } from 'vitest'

import {
  importeTrabajo,
  readGastos,
  totalesGastos,
  totalesTrabajos,
  upsertById,
  validarGasto,
  validarTrabajo,
  type Gasto,
  type Trabajo,
} from './case-economics'

const trabajo = (patch: Partial<Trabajo>): Trabajo => ({
  id: 'x',
  fecha: '2026-10-19',
  tipo: 'Recurso / escrito no previsto',
  concepto: 'c',
  letradoId: '',
  modalidad: 'fijo',
  importeFijo: 0,
  horas: 0,
  tarifaHora: 0,
  estado: 'pendiente',
  adjuntos: [],
  ...patch,
})

describe('economía del expediente', () => {
  it('por horas calcula horas × tarifa', () => {
    expect(importeTrabajo(trabajo({ modalidad: 'horas', horas: 2.5, tarifaHora: 130 }))).toBe(325)
  })

  it('pendiente de recuperar solo suma gastos pendientes', () => {
    const gastos = readGastos({
      gastos: [
        { id: '1', importe: 9.02, estado: 'pendiente' },
        { id: '2', importe: 20, estado: 'recuperado' },
        { id: '3', importe: 5, estado: 'asumido' },
      ],
    })
    expect(totalesGastos(gastos)).toEqual({ adelantado: 34.02, pendiente: 9.02, recuperado: 20 })
  })

  it('cortesía no cuenta como devengado', () => {
    const totals = totalesTrabajos([
      trabajo({ importeFijo: 800 }),
      trabajo({ id: 'y', importeFijo: 150, estado: 'cortesia' }),
    ])
    expect(totals.devengado).toBe(800)
    expect(totals.pendiente).toBe(800)
  })

  it('rechaza trabajo por horas sin tarifa y gasto sin importe', () => {
    expect(validarTrabajo(trabajo({ modalidad: 'horas', horas: 2 }))).not.toBeNull()
    const gasto: Gasto = {
      id: '1',
      fecha: '2026-10-19',
      categoria: 'Otros suplidos',
      concepto: 'Nota simple',
      importe: 0,
      proveedor: '',
      justificante: '',
      pagadoPor: 'Despacho',
      estado: 'pendiente',
      adjuntos: [],
    }
    expect(validarGasto(gasto)).not.toBeNull()
    expect(validarGasto({ ...gasto, importe: 9.02 })).toBeNull()
  })

  it('ignora datos corruptos al leer y conserva el resto de claves al sustituir por id', () => {
    expect(readGastos({ gastos: 'mal' })).toEqual([])
    expect(
      readGastos({ gastos: [{ id: '1', estado: 'inventado', importe: 'x' }] })[0],
    ).toMatchObject({
      estado: 'pendiente',
      importe: 0,
    })
    expect(upsertById([{ id: 'a', n: 1 }], { id: 'a', n: 2 })).toEqual([{ id: 'a', n: 2 }])
    expect(upsertById([{ id: 'a', n: 1 }], { id: 'b', n: 2 })).toHaveLength(2)
  })
})
