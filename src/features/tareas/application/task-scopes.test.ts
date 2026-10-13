import { describe, expect, it } from 'vitest'

import type { TareaPersistida } from './task-types'
import {
  combinarTareasLead,
  enAlcance,
  estadoTareaRevision,
  leerTodasLasPaginas,
  tareasDelExpediente,
} from './task-scopes'

const task = (id: string, extra: Partial<TareaPersistida> = {}) =>
  ({
    id,
    oportunidadId: null,
    expedienteId: null,
    asignadoId: null,
    creadaPorId: null,
    estado: 'Pendiente',
    ...extra,
  }) as TareaPersistida

describe('paginación de tareas', () => {
  it('lee todas las páginas, incluida la última incompleta', async () => {
    const data = Array.from({ length: 2345 }, (_, index) => ({ id: `t${index}` }))
    const ranges: Array<[number, number]> = []
    const rows = await leerTodasLasPaginas(async (from, to) => {
      ranges.push([from, to])
      return { data: data.slice(from, to + 1), error: null }
    })

    expect(rows).toHaveLength(2345)
    expect(rows.at(-1)?.id).toBe('t2344')
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('propaga errores y rechaza tamaños de página inválidos', async () => {
    await expect(
      leerTodasLasPaginas(async () => ({ data: null, error: new Error('fallo') })),
    ).rejects.toThrow('fallo')
    await expect(leerTodasLasPaginas(async () => ({ data: [], error: null }), 0)).rejects.toThrow(
      'entero positivo',
    )
  })
})

describe('alcance de tareas', () => {
  it('combina tareas directas del Lead con la caché y conserva la versión reciente', () => {
    const result = combinarTareasLead(
      [task('direct', { oportunidadId: 'lead' }), task('shared', { oportunidadId: 'lead' })],
      [
        task('shared', { oportunidadId: 'lead', estado: 'En curso' }),
        task('other', { oportunidadId: 'otro' }),
      ],
      'lead',
    )
    expect(result.map((item) => item.id).sort()).toEqual(['direct', 'shared'])
    expect(result.find((item) => item.id === 'shared')?.estado).toBe('En curso')
  })

  it('incluye en el expediente sus tareas y las del Lead de origen sin expediente', () => {
    const tasks = [
      task('lead-task', { oportunidadId: 'lead' }),
      task('case-task', { expedienteId: 'case' }),
      task('other-lead-task', { oportunidadId: 'other' }),
    ]
    expect(tareasDelExpediente(tasks, 'case', 'lead').map((item) => item.id)).toEqual([
      'lead-task',
      'case-task',
    ])
    expect(tareasDelExpediente(tasks, 'case', null).map((item) => item.id)).toEqual(['case-task'])
  })

  it('aplica los ámbitos de tareas y el estado de la tarea de revisión', () => {
    const assigned = task('review', { asignadoId: 'user-1', creadaPorId: 'user-2' })
    expect(enAlcance(assigned, 'mine', 'user-1')).toBe(true)
    expect(enAlcance(assigned, 'delegated', 'user-2')).toBe(true)
    expect(enAlcance(assigned, 'administration', 'user-3', 'paralegal')).toBe(false)
    expect(enAlcance(assigned, 'administration', 'user-3', 'lawyer')).toBe(true)
    expect(estadoTareaRevision({ isPending: false, isError: false, data: assigned })).toBe(
      'abierta',
    )
    expect(
      estadoTareaRevision({
        isPending: false,
        isError: false,
        data: { estado: 'Completada' },
      }),
    ).toBe('cerrada')
  })
})