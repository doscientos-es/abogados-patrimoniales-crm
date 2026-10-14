import { describe, expect, it } from 'vitest'

import {
  anularRevisionSinDecision,
  conEditor,
  copiaEnviada,
  datosRevision,
  editarVersion,
  ENVIO_REGISTRADO,
  huella,
  importeEnvioCents,
  leerEditor,
  lineaDesdeServicio,
  marcadorRevision,
  nuevoBorrador,
  parseEuros,
  puedeSolicitarRevision,
  problemasParaFinalizar,
  registrarEnvio,
  resolverRevision,
  revisionDeTarea,
  solicitarRevision,
  sincronizarAsignado,
  totales,
  totalesLinea,
  versionesEnviadas,
  type BloqueMaestro,
} from './quote-editor'

const blocks: BloqueMaestro[] = [
  {
    id: 'B2',
    titulo: 'HONORARIOS',
    texto: 'Texto 2',
    orden: 2,
    activo: true,
    porDefecto: true,
    archivado: false,
  },
  {
    id: 'B1',
    titulo: 'ENCARGO',
    texto: 'Texto 1',
    orden: 1,
    activo: true,
    porDefecto: true,
    archivado: false,
  },
  {
    id: 'B3',
    titulo: 'NO DEFECTO',
    texto: 'x',
    orden: 3,
    activo: true,
    porDefecto: false,
    archivado: false,
  },
]
const service = {
  id: 'S1',
  codigo: 'SD1',
  nombre: 'SALIDA',
  descripcion: 'Desc',
  precioCents: 17000,
  ivaPct: 21,
}
const cliente = { nombre: 'Ana', email: 'ana@example.test' }
const task = { asignadoId: 'reviewer', abierta: true }
const draft = () =>
  nuevoBorrador({
    detalles: {},
    asunto: 'Herencia',
    referenciaLead: 'OP-1',
    bloques: blocks,
    hoy: '2026-10-06',
  }).editor
const review = (editor = draft(), taskId = 'T1') => {
  editor.actual.lineas = [lineaDesdeServicio(service)]
  return solicitarRevision(editor, {
    tareaId: taskId,
    asignadoId: 'reviewer',
    asignadoNombre: 'Jon',
    venceEn: '2026-10-10',
    observaciones: 'Revisar',
    solicitadaPor: 'author',
    cliente,
    despacho: 'LEX',
    ahora: '2026-10-06T10:00:00Z',
  })
}
const send = {
  fecha: '2026-10-06T11:00:00Z',
  destinatario: 'ana@example.test',
  canal: 'Email',
  asunto: 'Presupuesto',
  mensaje: 'Hola',
  declaradoPor: 'author',
}

describe('editor de presupuestos', () => {
  it('calcula céntimos y acepta importes españoles sin admitir formatos ambiguos', () => {
    expect(totalesLinea({ cantidad: 3, precioCents: 3333, ivaPct: 21 })).toEqual({
      base: 9999,
      iva: 2100,
      total: 12099,
    })
    expect(totales([lineaDesdeServicio(service)]).total).toBe(20570)
    expect(parseEuros('1.800,00')).toBe(180000)
    expect(parseEuros('12.50')).toBe(1250)
    expect(parseEuros('1.80,00')).toBeNull()
  })

  it('crea el borrador con bloques predeterminados y preserva un presupuesto manual comprometido', () => {
    const details = {
      resultadoCualificacion: 'previo',
      presupuesto: {
        version: 2,
        referencia: 'PR-M',
        honorarios: '1.500 €',
        estado: 'Enviado al cliente',
        fechaEnvio: '2026-09-01',
        versionEnviada: 2,
      },
    }
    const result = nuevoBorrador({
      detalles: details,
      asunto: 'Herencia',
      referenciaLead: 'OP-1',
      bloques: blocks,
      hoy: '2026-10-06',
    })
    expect(result.editor.actual.version).toBe(3)
    expect(result.editor.actual.bloques.map((block) => block.titulo)).toEqual([
      'ENCARGO',
      'HONORARIOS',
    ])
    expect(result.editor.actual.condiciones).toContain('Honorarios: 1.500 €')
    const saved = conEditor(details, result.editor, result.extra) as Record<string, unknown>
    const savedQuote = saved['presupuesto'] as Record<string, unknown>
    expect(saved['resultadoCualificacion']).toBe('previo')
    expect((savedQuote['legadoOriginal'] as Record<string, unknown>)['honorarios']).toBe('1.500 €')
    expect(savedQuote['estado']).toBe(ENVIO_REGISTRADO)
  })

  it('no finaliza con IVA desconocido, precio cero sin revisar o precio inválido', () => {
    const editor = draft()
    editor.actual.lineas = [
      { ...lineaDesdeServicio(service), precioCents: 0, ivaPct: null, precioInvalido: true },
    ]
    expect(problemasParaFinalizar(editor.actual)).toEqual([
      'Decide el IVA de «SALIDA».',
      'Revisa el precio 0 de «SALIDA».',
      'El precio de «SALIDA» no es un importe válido.',
    ])
  })

  it('una corrección crea una versión nueva sin modificar la versión enviada', () => {
    const original = draft()
    const closed = {
      ...original,
      actual: { ...original.actual, estado: 'enviado' as const, envio: send },
    }
    const next = editarVersion({}, closed, '2026-10-07', '2026-10-07').editor
    expect(next.actual).toMatchObject({ version: 2, estado: 'borrador' })
    const nextBlock = next.actual.bloques[0]
    if (nextBlock) nextBlock.texto = 'cambio'
    expect(next.anteriores[0]?.bloques[0]?.texto).toBe('Texto 1')
  })

  it('liga la revisión a su tarea y huella exacta, y una edición invalida la revisión pendiente', () => {
    const editor = review()
    expect(marcadorRevision('11111111-2222-3333-4444-555555555555', 1)).toContain(':v1]')
    expect(editor.actual.revision?.copia.instantanea?.cliente.nombre).toBe('Ana')
    expect(puedeSolicitarRevision(editor)).toMatch(/pendiente/)
    const firstLine = editor.actual.lineas[0]
    if (firstLine) firstLine.precioCents = 1
    expect(revisionDeTarea(editor, 'T1')?.vigente).toBe(false)
    expect(huella(editor.actual)).not.toBe(editor.actual.revision?.huella)
  })

  it('solo el responsable sincronizado resuelve y devolver requiere observaciones', () => {
    const editor = review()
    const args = {
      tareaId: 'T1',
      decision: 'validada' as const,
      usuarioNombre: 'Jon',
      observaciones: '',
      ahora: '2026-10-07',
      tarea: task,
    }
    expect(() => resolverRevision(editor, { ...args, usuarioId: 'other' })).toThrow(
      /responsable asignado/,
    )
    expect(() =>
      resolverRevision(editor, { ...args, decision: 'devuelta', usuarioId: 'reviewer' }),
    ).toThrow(/observaciones/)
    expect(() =>
      resolverRevision(editor, {
        ...args,
        usuarioId: 'reviewer',
        tarea: { asignadoId: 'new', abierta: true },
      }),
    ).toThrow(/reasignado/)
    const synced = sincronizarAsignado(editor, 'T1', 'new', 'David', '2026-10-07T00:00:00Z')
    expect(synced.actual.revision?.observaciones).toContain('Jon → David')
    expect(
      resolverRevision(synced, {
        ...args,
        usuarioId: 'new',
        tarea: { asignadoId: 'new', abierta: true },
      }).editor.actual.estado,
    ).toBe('validado')
  })

  it('cerrar una tarea sin decisión no valida, y anular permite pedir una revisión nueva', () => {
    const editor = review()
    expect(() =>
      resolverRevision(editor, {
        tareaId: 'T1',
        decision: 'validada',
        usuarioId: 'reviewer',
        usuarioNombre: 'Jon',
        observaciones: '',
        ahora: 'x',
        tarea: { asignadoId: 'reviewer', abierta: false },
      }),
    ).toThrow(/cerrada/)
    const cancelled = anularRevisionSinDecision(editor, '2026-10-07')
    expect(cancelled.actual.estado).toBe('borrador')
    expect(cancelled.actual.revisiones?.[0]?.estado).toBe('obsoleta')
    expect(review(cancelled, 'T2').actual.revision?.tareaId).toBe('T2')
  })

  it('al enviar congela la copia y archiva el seguimiento enviado anteriormente', () => {
    const validated = resolverRevision(review(), {
      tareaId: 'T1',
      decision: 'validada',
      usuarioId: 'reviewer',
      usuarioNombre: 'Jon',
      observaciones: '',
      ahora: '2026-10-07',
      tarea: task,
    }).editor
    const result = registrarEnvio(validated, send, true, { versionEnviada: 0 })
    expect(result.editor.actual.envio?.copia.lineas[0]?.precioCents).toBe(17000)
    const details = conEditor({}, result.editor, result.extra)
    expect(versionesEnviadas(leerEditor(details))?.map((version) => version.version)).toEqual([1])
    expect(copiaEnviada(result.editor.actual)?.instantanea?.totales.total).toBe(20570)
    expect(importeEnvioCents(result.editor.actual, {})).toBe(20570)
  })

  it('reutiliza responsable y plazo reales de una tarea ya abierta', () => {
    expect(
      datosRevision(
        { id: 'T1', asignadoId: 'A', venceEn: '2026-10-09T16:00:00Z' },
        { asignadoId: 'B', fecha: '2026-12-01' },
        (id) => id,
      ),
    ).toMatchObject({
      reutiliza: true,
      tareaId: 'T1',
      asignadoId: 'A',
      venceEn: '2026-10-09',
      difiere: true,
    })
    expect(datosRevision(null, { asignadoId: 'B', fecha: '' }, (id) => id)).toMatchObject({
      reutiliza: false,
      tareaId: null,
      venceEn: null,
    })
  })
})
