import { describe, expect, it, vi } from 'vitest'

import { leerEditor } from './quote-editor'
import {
  asegurarTareaEnvio,
  leerMarcadorEnvio,
  marcadorEnvio,
  responsableEnvioPorDefecto,
} from './quote-send-task'

const leadId = '0b221db3-9548-4ca7-9b2b-2d5c60493746'
const opportunity = (state = 'validado', extra: Record<string, unknown> = {}) => ({
  id: leadId,
  version: 4,
  detalles: {
    presupuesto: {
      editor: {
        actual: {
          version: 2,
          estado: state,
          referencia: 'PR-1',
          fecha: '2026-10-07',
          asunto: 'Herencia',
          lineas: [],
          bloques: [],
          condiciones: '',
          revision: { solicitadaPor: 'preparer' },
          ...extra,
        },
        anteriores: [],
      },
    },
  } as never,
})
const dependencies = () => ({
  buscar: vi.fn().mockResolvedValue(null),
  crear: vi.fn().mockResolvedValue({ id: 'send-task' }),
  guardar: vi.fn().mockResolvedValue(undefined),
})

describe('tarea de envío del presupuesto', () => {
  it('analiza el marcador y su versión sin confundirlo con otros marcadores', () => {
    const marker = marcadorEnvio(leadId, 2)
    expect(leerMarcadorEnvio(`nota ${marker}`)).toEqual({ leadId, version: 2 })
    expect(leerMarcadorEnvio('[otro:lead:v2]')).toBeNull()
  })

  it('usa como responsable por defecto al preparador solo si sigue siendo miembro', () => {
    const editor = leerEditor(opportunity().detalles)
    expect(responsableEnvioPorDefecto(editor?.actual, [{ id: 'preparer' }])).toBe('preparer')
    expect(responsableEnvioPorDefecto(editor?.actual, [{ id: 'other' }])).toBeNull()
  })

  it('crea una tarea real y guarda su vínculo en el Lead', async () => {
    const deps = dependencies()
    const result = await asegurarTareaEnvio({
      oportunidad: opportunity(),
      asignadoId: 'sender',
      asignadoNombre: 'Responsable',
      cliente: 'Ana Pérez',
      ahora: '2026-10-08T10:00:00Z',
      ...deps,
    })

    expect(result).toEqual({ tareaId: 'send-task', creada: true })
    expect(deps.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        oportunidadId: leadId,
        asignadoId: 'sender',
        titulo: 'ENVIAR PRESUPUESTO AL CLIENTE PR-1 · v2',
      }),
    )
    expect(deps.crear.mock.calls[0]?.[0].descripcion).toContain('Ana Pérez')
    const saved = leerEditor(deps.guardar.mock.calls[0]?.[2])
    expect(saved?.actual.envioTarea).toMatchObject({ tareaId: 'send-task', asignadoId: 'sender' })
  })

  it('reutiliza una tarea abierta encontrada por marcador y no duplica', async () => {
    const deps = dependencies()
    deps.buscar.mockResolvedValue({ id: 'existing-task' })

    const result = await asegurarTareaEnvio({
      oportunidad: opportunity(),
      asignadoId: 'sender',
      asignadoNombre: 'Responsable',
      cliente: '',
      ahora: '2026-10-08T10:00:00Z',
      ...deps,
    })

    expect(result).toEqual({ tareaId: 'existing-task', creada: false })
    expect(deps.buscar).toHaveBeenCalledWith(marcadorEnvio(leadId, 2))
    expect(deps.crear).not.toHaveBeenCalled()
  })

  it('no crea tareas si falta responsable o la versión no está validada', async () => {
    const noAssignee = dependencies()
    await expect(
      asegurarTareaEnvio({
        oportunidad: opportunity(),
        asignadoId: '',
        asignadoNombre: '',
        cliente: '',
        ahora: 'now',
        ...noAssignee,
      }),
    ).rejects.toThrow('Elige el responsable')
    expect(noAssignee.crear).not.toHaveBeenCalled()

    const unvalidated = dependencies()
    await expect(
      asegurarTareaEnvio({
        oportunidad: opportunity('en_revision'),
        asignadoId: 'sender',
        asignadoNombre: 'Responsable',
        cliente: '',
        ahora: 'now',
        ...unvalidated,
      }),
    ).rejects.toThrow('versión validada')
    expect(unvalidated.crear).not.toHaveBeenCalled()
  })
})
