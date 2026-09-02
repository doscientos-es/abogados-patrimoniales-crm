// Construcción del contexto que se envía al Resumen IA.
//
// Regla de privacidad: sólo se envía información del expediente indicado.
// Nunca se incluyen datos de otros expedientes ni notas personales de
// contactos que no estén vinculadas expresamente a este expediente.

import { nombreContacto } from '@/data/crm'
import {
  megafase,
  megafaseDe,
  nombreFase,
  saldoEjecucion,
  type FuenteIA,
} from '@/data/expedientes-model'
import {
  diasHasta,
  selActuaciones,
  selComunicaciones,
  selDocumentos,
  selEjecuciones,
  selFechas,
  selIntervinientes,
  selLineas,
  selTareas,
  type OpsState,
} from '@/lib/expedientes-store'
import { notasDeExpediente, type NotasState } from '@/lib/notas-store'

/** Texto temporal relativo, sin valores negativos. */
export function textoRelativo(fecha: string | undefined) {
  const d = diasHasta(fecha)
  if (d === null) return 'Sin fecha'
  if (d === 0) return 'Hoy'
  if (d > 0) return d === 1 ? 'Mañana' : `Dentro de ${d} días`
  const p = Math.abs(d)
  return p === 1 ? 'Ayer' : `Hace ${p} días`
}

export type ContextoIA = {
  contexto: string
  fuentes: FuenteIA[]
  huella: string
  suficiente: boolean
}

function huellaDe(partes: string[]) {
  const s = partes.join('|')
  let h = 0
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return `h${Math.abs(h).toString(36)}`
}

export function construirContextoIA(
  s: OpsState,
  notasState: NotasState,
  expedienteId: string,
): ContextoIA {
  const e = s.expedientes.find((x) => x.id === expedienteId)
  if (!e) return { contexto: '', fuentes: [], huella: '', suficiente: false }

  const lineas = selLineas(s, expedienteId)
  const actuaciones = selActuaciones(s, expedienteId)
  const documentos = selDocumentos(s, expedienteId)
  const tareas = selTareas(s, expedienteId)
  const fechas = selFechas(s, expedienteId)
  const comunicaciones = selComunicaciones(s, expedienteId)
  const intervinientes = selIntervinientes(s, expedienteId)
  const ejecuciones = selEjecuciones(s, expedienteId)
  const notas = notasDeExpediente(notasState, expedienteId)

  const fuentes: FuenteIA[] = []
  const bloques: string[] = []

  const mf = megafase(megafaseDe(e.naturaleza, e.fase))
  bloques.push(
    [
      `EXPEDIENTE ${e.codigo}`,
      `Título: ${e.nombre}`,
      `Cliente principal: ${nombreContacto(e.contactoId)}`,
      `Materia: ${e.area}${e.tipoAsunto ? ` · ${e.tipoAsunto}` : ''}`,
      `Naturaleza: ${e.naturaleza}`,
      `Megafase: ${mf.codigo} · ${mf.nombre}`,
      `Fase operativa: ${nombreFase(e.naturaleza, e.fase)}`,
      `Estado general: ${e.estadoGeneral} · Estado operativo: ${e.estadoOperativo}`,
      `Dependencia actual: ${e.dependencia}`,
      `Prioridad: ${e.prioridad}`,
      `Requiere acción: ${e.requiereAccion ? 'Sí' : 'No'}`,
      `Apertura: ${e.fechaApertura} · Último movimiento: ${e.ultimoMovimiento}`,
      `Dónde estamos (síntesis del despacho): ${e.dondeEstamos || 'No consta'}`,
      `Próxima acción registrada: ${e.proximaAccion || 'No consta'}`,
      e.suspension ? `Suspendido desde ${e.suspension.fecha}: ${e.suspension.motivo}` : '',
      e.procedimiento
        ? `Procedimiento: ${e.procedimiento.tipo} · ${e.procedimiento.organo} · autos ${e.procedimiento.autos} · NIG ${e.procedimiento.nig} · procurador ${e.procedimiento.procurador}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  fuentes.push({ tipo: 'Expediente', id: e.id, label: e.codigo, pestana: 'resumen' })

  if (intervinientes.length) {
    bloques.push(
      'INTERVINIENTES\n' + intervinientes.map((i) => `- ${i.rol}: ${i.nombre}`).join('\n'),
    )
  }

  if (lineas.length) {
    bloques.push(
      'LÍNEAS DE TRABAJO\n' +
        lineas
          .map(
            (l) =>
              `- ${l.nombre} (${l.tipo}) · estado ${l.estado} · ${l.dondeEstamos || 'sin síntesis'}`,
          )
          .join('\n'),
    )
    lineas.forEach((l) =>
      fuentes.push({ tipo: 'Línea', id: l.id, label: l.nombre, pestana: 'lineas' }),
    )
  }

  const ultimas = actuaciones.slice(0, 12)
  if (ultimas.length) {
    bloques.push(
      'ACTUACIONES REGISTRADAS (de más reciente a más antigua)\n' +
        ultimas
          .map(
            (a) =>
              `- [Actuación · ${a.fecha}] ${a.tipo}: ${a.titulo}. Estado ${a.estado}. ${a.descripcion || ''} ${a.resultado ? `Resultado: ${a.resultado}.` : ''}`,
          )
          .join('\n'),
    )
    ultimas.forEach((a) =>
      fuentes.push({
        tipo: 'Actuación',
        id: a.id,
        label: `${a.fecha} · ${a.titulo}`,
        pestana: 'actuaciones',
      }),
    )
  }

  if (documentos.length) {
    bloques.push(
      'DOCUMENTOS DEL EXPEDIENTE (metadatos; no se ha extraído su contenido)\n' +
        documentos
          .map(
            (d) =>
              `- [Documento · ${d.nombre}] tipo ${d.tipoDocumental}, origen ${d.origen}, fecha del documento ${d.fechaDocumento}, incorporado el ${d.fechaIncorporacion}, versión ${d.version}${d.judicial ? ', judicial' : ''}${d.entregable ? ', entregable' : ''}${d.datosJudiciales?.estadoPlazo ? `, plazo: ${d.datosJudiciales.estadoPlazo}` : ''}`,
          )
          .join('\n'),
    )
    documentos.forEach((d) =>
      fuentes.push({ tipo: 'Documento', id: d.id, label: d.nombre, pestana: 'documentos' }),
    )
  }

  const abiertas = tareas.filter((t) => t.estado !== 'Completada' && t.estado !== 'Cancelada')
  if (abiertas.length) {
    bloques.push(
      'TAREAS ABIERTAS\n' +
        abiertas
          .map(
            (t) =>
              `- [Tarea · ${t.titulo}] responsable ${t.responsable}, vence ${t.vencimiento}, estado ${t.estado}`,
          )
          .join('\n'),
    )
    abiertas.forEach((t) =>
      fuentes.push({ tipo: 'Tarea', id: t.id, label: t.titulo, pestana: 'tareas' }),
    )
  }

  if (fechas.length) {
    bloques.push(
      'FECHAS Y PLAZOS\n' +
        fechas
          .map(
            (f) =>
              `- [Plazo · ${f.fecha}] ${f.tipo}: ${f.titulo}. ${f.validada ? 'Validado' : 'SIN VALIDAR'}. ${textoRelativo(f.fecha)}.`,
          )
          .join('\n'),
    )
    fechas.forEach((f) =>
      fuentes.push({
        tipo: 'Plazo',
        id: f.id,
        label: `${f.fecha} · ${f.titulo}`,
        pestana: 'fechas',
      }),
    )
  }

  if (comunicaciones.length) {
    bloques.push(
      'COMUNICACIONES\n' +
        comunicaciones
          .slice(0, 10)
          .map(
            (c) =>
              `- [Comunicación · ${c.fecha}] ${c.tipo} con ${c.destinatarios.join(', ') || '—'}: ${c.asunto}`,
          )
          .join('\n'),
    )
    comunicaciones.slice(0, 10).forEach((c) =>
      fuentes.push({
        tipo: 'Comunicación',
        id: c.id,
        label: `${c.fecha} · ${c.asunto}`,
        pestana: 'comunicaciones',
      }),
    )
  }

  if (ejecuciones.length || e.saldoPendiente || e.presupuestoId) {
    bloques.push(
      'INFORMACIÓN ECONÓMICA\n' +
        [
          e.presupuestoId ? `- Presupuesto vinculado: ${e.presupuestoId}` : '',
          typeof e.saldoPendiente === 'number'
            ? `- Saldo pendiente del cliente: ${e.saldoPendiente} €`
            : '',
          ...ejecuciones.map(
            (ej) =>
              `- Ejecución ${ej.titulo}: reclamado ${ej.importeReclamado} €, recuperado ${ej.importeRecuperado} €, pendiente ${saldoEjecucion(ej)} €, estado ${ej.estado}`,
          ),
        ]
          .filter(Boolean)
          .join('\n'),
    )
    if (ejecuciones.length || typeof e.saldoPendiente === 'number') {
      fuentes.push({
        tipo: 'Económico',
        id: e.id,
        label: 'Situación económica',
        pestana: 'economico',
      })
    }
  }

  if (notas.length) {
    bloques.push(
      'NOTAS INTERNAS VINCULADAS AL EXPEDIENTE\n' +
        notas
          .map(
            (n) =>
              `- [Nota · ${n.creada}] ${n.titulo ? `${n.titulo}: ` : ''}${n.contenido}${n.critica ? ' (nota crítica)' : ''}`,
          )
          .join('\n'),
    )
    notas.forEach((n) =>
      fuentes.push({
        tipo: 'Nota',
        id: n.id,
        label: `${n.creada} · ${n.titulo || 'Nota interna'}`,
        pestana: 'notas',
      }),
    )
  }

  const suficiente =
    actuaciones.length + documentos.length + lineas.length + fechas.length + comunicaciones.length >
      0 || Boolean(e.dondeEstamos)

  return {
    contexto: bloques.join('\n\n'),
    fuentes,
    huella: huellaDe([
      e.fase,
      e.estadoGeneral,
      e.dependencia,
      e.dondeEstamos,
      e.proximaAccion,
      String(actuaciones.length),
      // Última actuación válida: si cambia, el resumen queda desactualizado.
      actuaciones[0]
        ? `${actuaciones[0].id}|${actuaciones[0].fecha}|${actuaciones[0].hora ?? ''}|${actuaciones[0].estado}`
        : 'sin-actuaciones',
      String(documentos.length),
      String(tareas.length),
      String(fechas.length),
      String(comunicaciones.length),
      String(notas.length),
      String(lineas.length),
      e.ultimoMovimiento,
    ]),
    suficiente,
  }
}
