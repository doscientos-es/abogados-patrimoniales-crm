import { describe, expect, it, vi } from 'vitest'

import { guardarSeguimientoTrasEnvio } from './quote-followup-save'

describe('guardar seguimiento tras el envío', () => {
  it('guarda el vínculo de la tarea creada o reutilizada', async () => {
    const guardar = vi.fn().mockResolvedValue(undefined)
    const result = await guardarSeguimientoTrasEnvio({
      asegurar: async () => ({ tareaId: 'task-1', detalles: { seguimiento: 'task-1' } }),
      guardar,
    })
    expect(guardar).toHaveBeenCalledWith({ seguimiento: 'task-1' })
    expect(result).toEqual({ estado: 'guardado' })
  })

  it('no intenta guardar si no se pudo comprobar o crear la tarea', async () => {
    const error = { message: 'Permiso denegado' }
    const guardar = vi.fn()
    const result = await guardarSeguimientoTrasEnvio({
      asegurar: async () => { throw error },
      guardar,
    })
    expect(result).toEqual({ estado: 'sin-tarea', error })
    expect(guardar).not.toHaveBeenCalled()
  })

  it('distingue una tarea existente de un fallo al vincularla', async () => {
    const error = { message: 'Conflicto de versión' }
    const result = await guardarSeguimientoTrasEnvio({
      asegurar: async () => ({ tareaId: 'task-1', detalles: {} }),
      guardar: async () => { throw error },
    })
    expect(result).toEqual({ estado: 'sin-vincular', tareaId: 'task-1', error })
  })

  it('no modifica los detalles si el seguimiento ya está vinculado', async () => {
    const guardar = vi.fn()
    expect(await guardarSeguimientoTrasEnvio({ asegurar: async () => null, guardar }))
      .toEqual({ estado: 'guardado' })
    expect(guardar).not.toHaveBeenCalled()
  })
})