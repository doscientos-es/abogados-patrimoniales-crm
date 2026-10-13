import { describe, expect, it } from 'vitest'

import {
  aceptarTraspaso,
  crearTraspaso,
  nivelDemora,
  reasignarTraspaso,
  responsableEfectivo,
  solicitarAclaracion,
  tareaAsuncion,
  traspasoActivo,
  TAREA_ASUNCION,
} from './case-handoff'

const content = {
  resumen: 'Herencia con inmueble',
  antecedentes: '',
  alcance: 'Aceptación de herencia',
  actuaciones: 'Pedir últimas voluntades',
  documentos: '',
  plazos: '',
  provision: 'Pagada',
}
const input = { id: 'handoff-1', expedienteId: 'case-1', emisorId: 'ana', receptorId: 'luis', ...content }
const createdAt = '2026-10-05T10:00:00.000Z'

describe('case handoff', () => {
  it('prevents a second active handoff for a case', () => {
    const first = crearTraspaso({}, input, createdAt)
    expect(() => crearTraspaso(first.detalles, { ...input, id: 'handoff-2' }, createdAt)).toThrow()
  })

  it('keeps the sender responsible until recipient acceptance', () => {
    const { traspaso } = crearTraspaso({}, input, createdAt)
    expect(responsableEfectivo(traspaso)).toBe('ana')
  })

  it('allows only the recipient to accept and makes repeat acceptance idempotent', () => {
    const { traspaso, detalles } = crearTraspaso({}, input, createdAt)
    expect(() => aceptarTraspaso(detalles, traspaso, 'other', createdAt)).toThrow()
    const result = aceptarTraspaso(detalles, traspaso, 'luis', createdAt)
    expect(responsableEfectivo(result.traspaso)).toBe('luis')
    expect(traspasoActivo(result.detalles, 'case-1')).toBeUndefined()
    expect(aceptarTraspaso(result.detalles, result.traspaso, 'luis', createdAt).yaAceptado).toBe(true)
  })

  it('requires a reason for a clarification and keeps the handoff active', () => {
    const { traspaso, detalles } = crearTraspaso({}, input, createdAt)
    expect(() => solicitarAclaracion(detalles, traspaso, 'luis', ' ', createdAt)).toThrow()
    const result = solicitarAclaracion(detalles, traspaso, 'luis', 'Falta el testamento', createdAt)
    expect(result.traspaso.estado).toBe('aclaracion')
    expect(traspasoActivo(result.detalles, 'case-1')?.id).toBe('handoff-1')
  })

  it('requires the sender and a reason to reassign', () => {
    const { traspaso, detalles } = crearTraspaso({}, input, createdAt)
    expect(() => reasignarTraspaso(detalles, traspaso, 'luis', 'eva', 'x', createdAt)).toThrow()
    const result = reasignarTraspaso(detalles, traspaso, 'ana', 'eva', 'Ausencia', createdAt)
    expect(result.traspaso.receptorId).toBe('eva')
  })

  it('creates a task for the recipient and escalates after three weekdays', () => {
    const task = tareaAsuncion({ expedienteId: 'case-1', oportunidadId: 'lead-1', receptorId: 'luis', referencia: 'EXP-1' })
    expect(task).toMatchObject({ titulo: TAREA_ASUNCION, asignadoId: 'luis', expedienteId: 'case-1' })
    expect(nivelDemora(
      { creadoEn: createdAt, estado: 'pendiente', ...input, tareaId: null, aceptadoEn: null, aceptadoPor: null, historial: [] },
      new Date('2026-10-08T10:00:00.000Z'),
    )).toBe('escalar')
  })
})