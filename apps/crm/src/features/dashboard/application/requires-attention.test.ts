import { describe, expect, it } from 'vitest'

import { filtrarIncidencias, incidenciasAtencion } from './requires-attention'

const NOW = new Date('2026-10-07T10:00:00Z').getTime()
const task = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 't1',
    expedienteId: 'c1',
    oportunidadId: null,
    titulo: 'Tarea',
    descripcion: '',
    estado: 'Pendiente',
    venceEn: null,
    revisarEn: null,
    motivoEspera: null,
    detalleEspera: '',
    asignadoId: 'u1',
    esSiguienteAccion: true,
    ...overrides,
  }) as never
const caso = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'c1',
    referencia: 'EXP-1',
    titulo: 'Herencia',
    fechaCierre: null,
    estadoGeneral: 'active',
    asignadoId: 'u1',
    ...overrides,
  }) as never
const run = (data: Partial<Parameters<typeof incidenciasAtencion>[0]>) =>
  incidenciasAtencion({ tasks: [], cases: [], opportunities: [], documents: [], ...data }, NOW).map(
    (item) => item.motivo,
  )

describe('Requiere atención', () => {
  it('detecta expedientes activos sin siguiente acción y excluye los cerrados', () => {
    expect(run({ cases: [caso()], tasks: [task({ esSiguienteAccion: false })] })).toContain(
      'sin_siguiente_accion',
    )
    expect(run({ cases: [caso({ fechaCierre: '2026-01-01' })] })).toEqual([])
  })

  it('no avisa de una espera programada antes de revisión y detecta las vencidas', () => {
    expect(
      run({
        cases: [caso()],
        tasks: [
          task({
            estado: 'En espera',
            revisarEn: '2026-10-20T09:00:00Z',
            esSiguienteAccion: false,
          }),
        ],
      }),
    ).toEqual([])
    expect(
      run({
        cases: [caso()],
        tasks: [task({ estado: 'En espera', revisarEn: '2026-10-06T09:00:00Z' })],
      }),
    ).toContain('espera_vencida')
  })

  it('detecta tareas vencidas sin responsable y revisiones de presupuesto', () => {
    const result = run({
      tasks: [
        task({ expedienteId: null, venceEn: '2026-10-01T09:00:00Z', asignadoId: null }),
        task({
          id: 'review',
          expedienteId: null,
          descripcion: '[presupuesto-lead:0b221db3-9548-4ca7-9b2b-2d5c60493746:v2]',
        }),
      ],
    })
    expect(result).toEqual(
      expect.arrayContaining(['tarea_vencida', 'tarea_sin_responsable', 'revision_presupuesto']),
    )
  })

  it('detecta presupuesto sin seguimiento y documentos recibidos por comprobar', () => {
    const opportunity = {
      id: 'o1',
      referencia: 'L-1',
      titulo: 'Consulta',
      fase: 'engagement',
      asignadoId: null,
    } as never
    expect(run({ opportunities: [opportunity] })).toContain('presupuesto_sin_seguimiento')
    expect(
      run({ documents: [{ id: 'd1', nombre: 'DNI', expedienteId: null, asignadoId: null }] }),
    ).toContain('documento_por_comprobar')
  })

  it('combina los filtros de responsable, usuario actual y siguiente acción', () => {
    const items = incidenciasAtencion(
      {
        tasks: [
          task({
            expedienteId: null,
            venceEn: '2026-10-01T09:00:00Z',
            asignadoId: 'u2',
            esSiguienteAccion: false,
          }),
        ],
        cases: [],
        opportunities: [],
        documents: [],
      },
      NOW,
    )
    expect(
      filtrarIncidencias(
        items,
        { responsableId: 'u2', misTareas: false, siguientesAcciones: false },
        'u1',
      ),
    ).toHaveLength(1)
    expect(
      filtrarIncidencias(
        items,
        { responsableId: 'all', misTareas: true, siguientesAcciones: false },
        'u1',
      ),
    ).toHaveLength(0)
    expect(
      filtrarIncidencias(
        items,
        { responsableId: 'all', misTareas: false, siguientesAcciones: true },
        'u2',
      ),
    ).toHaveLength(0)
  })
})
