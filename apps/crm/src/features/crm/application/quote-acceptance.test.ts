import { describe, expect, it, vi } from 'vitest'

import {
  asegurarTareaSeguimiento,
  construirAceptacionManual,
  contratacionAceptada,
  describirAceptacion,
  leerSeguimiento,
  pasosAvanceHastaEnvio,
  registrarRespuesta,
  tareaSeguimientoVigente,
} from './quote-acceptance'

const sent = {
  presupuesto: {
    version: 2,
    versionEnviada: 2,
    fechaEnvio: '2026-10-01',
    destinatario: 'ana@example.test',
    canal: 'Email',
    importeEnviado: '1210.00',
  },
}
const acceptance = {
  fecha: '2026-10-05',
  medio: 'Email',
  aceptante: 'Ana Pérez',
  evidenciaTipo: 'comunicacion' as const,
  evidenciaReferencia: 'Email 05/10',
  evidenciaTexto: 'Conforme',
  importe: '1210.00',
  por: 'u1',
}

describe('aceptación y seguimiento del presupuesto', () => {
  it('registra aceptación manual ligada a versión, importe e identidad', () => {
    const result = construirAceptacionManual(sent, acceptance)
    expect(result).toMatchObject({
      version: 2,
      importe: '1210.00',
      estado: 'Aceptado',
      medio: 'Email',
      aceptante: 'Ana Pérez',
    })
    expect(() => construirAceptacionManual({}, acceptance)).toThrow(/envío/)
    expect(() => construirAceptacionManual(sent, { ...acceptance, importe: '900' })).toThrow(
      /no coincide/,
    )
    expect(() =>
      construirAceptacionManual(sent, { ...acceptance, evidenciaReferencia: '' }),
    ).toThrow(/Falta/)
  })

  it('admite aceptación verbal solo con constancia interna y lee registros anteriores', () => {
    const verbal = construirAceptacionManual(sent, {
      ...acceptance,
      medio: 'Verbal',
      evidenciaTipo: 'constancia_interna',
      evidenciaReferencia: '',
      evidenciaTexto: 'Confirma por teléfono que acepta.',
    })
    expect(verbal['evidencia']).toMatchObject({
      tipo: 'constancia_interna',
      texto: 'Confirma por teléfono que acepta.',
    })
    expect(describirAceptacion({ fecha: '2026-01-01', forma: 'Verbal' })).toEqual({
      estado: 'Aceptado',
      medio: 'Verbal (registro anterior)',
      legado: true,
    })
    expect(() => construirAceptacionManual(sent, { ...acceptance, fecha: '2026-09-30' })).toThrow(
      /anterior al envío/,
    )
  })

  it('respuesta del cliente exige motivo/fecha y queda en historial asociado al envío', () => {
    expect(() => registrarRespuesta(sent, { estado: 'rechazado', por: null })).toThrow(/motivo/)
    expect(() => registrarRespuesta(sent, { estado: 'aplazado', por: null })).toThrow(/fecha/)
    const details = registrarRespuesta(sent, {
      estado: 'aplazado',
      fechaSeguimiento: '2026-11-01',
      por: null,
      ahora: '2026-10-05',
    })
    expect(leerSeguimiento(details)).toMatchObject({
      estado: 'aplazado',
      version: 2,
      fechaSeguimiento: '2026-11-01',
      historial: [{ version: 2 }],
    })
    expect(tareaSeguimientoVigente(details)).toBeNull()
  })

  it('crea/reutiliza una tarea de seguimiento abierta y la vincula a la versión enviada', async () => {
    const createTask = vi.fn().mockResolvedValue({ id: 'task-1' })
    const result = await asegurarTareaSeguimiento({
      detalles: sent,
      leadId: 'lead-1',
      referencia: 'PR-1',
      cliente: 'Ana',
      asignadoId: 'u1',
      asignadoNombre: 'Luis',
      venceEn: null,
      ahora: '2026-10-05',
      buscar: async () => null,
      crear: createTask,
    })
    expect(result?.tareaId).toBe('task-1')
    if (result) expect(tareaSeguimientoVigente(result.detalles)?.version).toBe(2)
    expect(createTask).toHaveBeenCalledOnce()
    const reused = await asegurarTareaSeguimiento({
      detalles: sent,
      leadId: 'lead-1',
      referencia: 'PR-1',
      cliente: 'Ana',
      asignadoId: 'u1',
      asignadoNombre: 'Luis',
      venceEn: null,
      ahora: 'x',
      buscar: async () => ({ id: 'existing' }),
      crear: createTask,
    })
    expect(reused?.tareaId).toBe('existing')
    expect(createTask).toHaveBeenCalledOnce()
  })

  it('avanza las fases de una en una usando solo los datos reales del envío', () => {
    const details = { ...sent, presupuesto: { ...sent.presupuesto, estado: 'Enviado al cliente' } }
    const steps = pasosAvanceHastaEnvio('first_meeting', details)
    expect(steps.map((step) => step.transicion?.fase ?? '-')).toEqual([
      'quote',
      'validation',
      '-',
      'engagement',
    ])
    const validationStep = steps[2]
    expect(validationStep).toBeDefined()
    if (validationStep)
      expect(
        (validationStep.detalles as { presupuesto: { estado: string } }).presupuesto.estado,
      ).toBe('Validado')
    expect(() =>
      pasosAvanceHastaEnvio('quote', {
        ...details,
        presupuesto: { ...details.presupuesto, version: 3 },
      }),
    ).toThrow(/versión posterior/)
    expect(contratacionAceptada({ hojaEncargo: 'Pendiente' })).toMatchObject({
      decision: 'Aceptado verbalmente',
      decisionMostrada: 'Aceptado',
    })
  })
})
