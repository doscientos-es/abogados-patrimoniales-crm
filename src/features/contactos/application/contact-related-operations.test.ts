import { describe, expect, it } from 'vitest'

import { operacionesDelContacto } from './contact-related-operations'

describe('operacionesDelContacto', () => {
  it('devuelve solo la actividad vinculada al contacto por expediente u oportunidad', () => {
    const operaciones = operacionesDelContacto({
      contactoId: 'contacto-1',
      expedientes: [
        {
          id: 'expediente-1',
          contactoPrincipalId: 'contacto-1',
          referencia: 'AP_1',
          titulo: 'Herencia',
          proximaAccion: 'Revisar documentación',
        },
        {
          id: 'expediente-2',
          contactoPrincipalId: 'contacto-2',
          referencia: 'AP_2',
          titulo: 'Compraventa',
          proximaAccion: 'Firmar escritura',
        },
      ] as never,
      oportunidades: [
        { id: 'oportunidad-1', contactoId: 'contacto-1', fase: 'quote', titulo: 'Presupuesto' },
        { id: 'oportunidad-2', contactoId: 'contacto-1', fase: 'entry', titulo: 'Consulta' },
      ] as never,
      facturas: [
        { id: 'factura-1', contactoId: 'contacto-1' },
        { id: 'factura-2', contactoId: 'contacto-2' },
      ] as never,
      tareas: [
        {
          id: 'tarea-expediente',
          expedienteId: 'expediente-1',
          oportunidadId: null,
          titulo: 'Preparar nota',
          estado: 'Pendiente',
          venceEn: '2026-09-10T10:00:00Z',
        },
        {
          id: 'tarea-oportunidad',
          expedienteId: null,
          oportunidadId: 'oportunidad-1',
          titulo: 'Enviar presupuesto',
          estado: 'Pendiente',
          venceEn: null,
        },
        {
          id: 'tarea-ajena',
          expedienteId: 'expediente-2',
          oportunidadId: null,
          titulo: 'No mostrar',
          estado: 'Pendiente',
          venceEn: null,
        },
      ] as never,
    })

    expect(operaciones.presupuestos.map((item) => item.id)).toEqual(['oportunidad-1'])
    expect(operaciones.facturas.map((item) => item.id)).toEqual(['factura-1'])
    expect(operaciones.tareas.map((item) => item.id)).toEqual([
      'tarea-expediente',
      'tarea-oportunidad',
    ])
    expect(operaciones.proximasActuaciones.map((item) => item.titulo)).toEqual([
      'Preparar nota',
      'Revisar documentación',
    ])
  })
})