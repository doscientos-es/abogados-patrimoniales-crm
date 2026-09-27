import { describe, expect, it } from 'vitest'

import { DEFAULT_PROCEDURES } from './defaults'

describe('procedimientos de partida', () => {
  it('cubre los ocho SOPs visibles en el prototipo con pasos aplicables', () => {
    expect(DEFAULT_PROCEDURES.map((procedure) => procedure.slug)).toEqual([
      'primera-cita',
      'acta-de-encargo',
      'designacion-del-trabajo',
      'reunion-de-traspaso',
      'acta-de-cierre',
      'adenda-del-encargo',
      'archivo',
      'informacion-periodica-ejecuciones',
    ])

    for (const procedure of DEFAULT_PROCEDURES) {
      const types = new Set(procedure.sections.map((section) => section.type))
      expect(types).toEqual(
        new Set(['objective', 'responsibilities', 'step', 'templates', 'quality', 'metrics']),
      )
      const steps = procedure.sections.filter((section) => section.type === 'step')
      expect(steps.length).toBeGreaterThan(0)
      expect(
        steps.every((section) => Boolean(section.id && section.title && section.description)),
      ).toBe(true)
    }
  })
})
