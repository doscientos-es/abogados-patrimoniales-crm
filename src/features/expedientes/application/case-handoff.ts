import type { CrearTareaInput } from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'

export type EstadoTraspaso = 'pendiente' | 'aclaracion' | 'aceptado'

export const ESTADO_TRASPASO_LABEL: Record<EstadoTraspaso, string> = {
  pendiente: 'Pendiente de asunción',
  aclaracion: 'Aclaración solicitada',
  aceptado: 'Aceptado',
}

export const PENDIENTE_ASUNCION = 'PENDIENTE DE ASUNCIÓN POR ABOGADO'
export const TAREA_ASUNCION = 'Asumir responsabilidad del expediente'

export type ContenidoTraspaso = {
  resumen: string
  antecedentes: string
  alcance: string
  actuaciones: string
  documentos: string
  plazos: string
  provision: string
}

export type EventoTraspaso = {
  tipo: 'creado' | 'editado' | 'aclaracion' | 'reasignado' | 'aceptado'
  por: string
  en: string
  motivo?: string
  receptorId?: string
}

export type Traspaso = ContenidoTraspaso & {
  id: string
  expedienteId: string
  estado: EstadoTraspaso
  emisorId: string
  receptorId: string
  tareaId: string | null
  creadoEn: string
  aceptadoEn: string | null
  aceptadoPor: string | null
  historial: EventoTraspaso[]
  /** Fecha de corte de responsabilidad (ISO). Antes: emisor; desde: receptor. */
  fechaCorte?: string
  /** Constancia del RECIBÍ firmado por el abogado receptor. */
  recibi?: string
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isTraspaso(value: unknown): value is Traspaso {
  const item = record(value)
  return (
    typeof item['id'] === 'string' &&
    typeof item['expedienteId'] === 'string' &&
    (item['estado'] === 'pendiente' ||
      item['estado'] === 'aclaracion' ||
      item['estado'] === 'aceptado') &&
    typeof item['emisorId'] === 'string' &&
    typeof item['receptorId'] === 'string' &&
    typeof item['creadoEn'] === 'string' &&
    Array.isArray(item['historial'])
  )
}

export function leerTraspasos(details: Json | unknown): Traspaso[] {
  const items = record(details)['traspasos']
  return Array.isArray(items) ? items.filter(isTraspaso) : []
}

export function traspasosExpediente(details: Json | unknown, expedienteId: string) {
  return leerTraspasos(details).filter((item) => item.expedienteId === expedienteId)
}

export function traspasoActivo(details: Json | unknown, expedienteId: string) {
  return traspasosExpediente(details, expedienteId).find((item) => item.estado !== 'aceptado')
}

function guardar(details: Json | unknown, item: Traspaso): Record<string, unknown> {
  const base = record(details)
  const others = leerTraspasos(base).filter((current) => current.id !== item.id)
  return { ...base, traspasos: [...others, item] }
}

function requerido(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} es obligatorio.`)
}

/** El expediente conserva los antecedentes y actuaciones; no se duplican en la entrega formal. */
export function validarContenido(_content: Partial<ContenidoTraspaso>) {}

export function contenidoVacio(): ContenidoTraspaso {
  return {
    resumen: '',
    antecedentes: '',
    alcance: '',
    actuaciones: '',
    documentos: '',
    plazos: '',
    provision: '',
  }
}

export function textoRecibi(input: { receptor: string; referencia: string; fechaCorte: string }) {
  const corte = new Date(input.fechaCorte)
  const fecha = Number.isNaN(corte.getTime())
    ? input.fechaCorte
    : corte.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
  return `RECIBÍ: ${input.receptor} recibe el expediente ${input.referencia} (antecedentes, documentación y estado de actuaciones) y asume su dirección letrada. Fecha de corte: ${fecha}.`
}

export function crearTraspaso(
  details: Json | unknown,
  input: ContenidoTraspaso & {
    id: string
    expedienteId: string
    emisorId: string
    receptorId: string
    fechaCorte?: string
  },
  now: string,
) {
  if (traspasoActivo(details, input.expedienteId))
    throw new Error('Ya hay un traspaso pendiente para este expediente.')
  if (!input.receptorId) throw new Error('Selecciona el abogado destinatario.')
  if (input.receptorId === input.emisorId) throw new Error('El destinatario debe ser otro abogado.')
  validarContenido(input)
  const item: Traspaso = {
    ...input,
    estado: 'pendiente',
    tareaId: null,
    creadoEn: now,
    aceptadoEn: null,
    aceptadoPor: null,
    historial: [{ tipo: 'creado', por: input.emisorId, en: now, receptorId: input.receptorId }],
  }
  return { traspaso: item, detalles: guardar(details, item) }
}

export function vincularTarea(details: Json | unknown, item: Traspaso, tareaId: string) {
  const next = { ...item, tareaId }
  return { traspaso: next, detalles: guardar(details, next) }
}

export function editarTraspaso(
  details: Json | unknown,
  item: Traspaso,
  content: ContenidoTraspaso,
  actorId: string,
  now: string,
) {
  if (item.estado === 'aceptado') throw new Error('El traspaso ya fue aceptado.')
  if (actorId !== item.emisorId) throw new Error('Solo quien entrega puede editar el traspaso.')
  validarContenido(content)
  const next: Traspaso = {
    ...item,
    ...content,
    historial: [...item.historial, { tipo: 'editado', por: actorId, en: now }],
  }
  return { traspaso: next, detalles: guardar(details, next) }
}

export function aceptarTraspaso(
  details: Json | unknown,
  item: Traspaso,
  actorId: string,
  now: string,
  recibi?: string,
) {
  if (actorId !== item.receptorId)
    throw new Error('Solo el abogado destinatario puede aceptar el expediente.')
  if (item.estado === 'aceptado')
    return { traspaso: item, detalles: guardar(details, item), yaAceptado: true }
  const next: Traspaso = {
    ...item,
    estado: 'aceptado',
    aceptadoEn: now,
    aceptadoPor: actorId,
    fechaCorte: item.fechaCorte ?? now,
    ...(recibi ? { recibi } : {}),
    historial: [
      ...item.historial,
      { tipo: 'aceptado', por: actorId, en: now, ...(recibi ? { motivo: 'RECIBÍ firmado' } : {}) },
    ],
  }
  return { traspaso: next, detalles: guardar(details, next), yaAceptado: false }
}

export function solicitarAclaracion(
  details: Json | unknown,
  item: Traspaso,
  actorId: string,
  motivo: string,
  now: string,
) {
  if (actorId !== item.receptorId)
    throw new Error('Solo el abogado destinatario puede pedir aclaración.')
  if (item.estado === 'aceptado') throw new Error('El traspaso ya fue aceptado.')
  requerido(motivo, 'El motivo de la aclaración')
  const next: Traspaso = {
    ...item,
    estado: 'aclaracion',
    historial: [
      ...item.historial,
      { tipo: 'aclaracion', por: actorId, en: now, motivo: motivo.trim() },
    ],
  }
  return { traspaso: next, detalles: guardar(details, next) }
}

export function reasignarTraspaso(
  details: Json | unknown,
  item: Traspaso,
  actorId: string,
  receptorId: string,
  motivo: string,
  now: string,
) {
  if (actorId !== item.emisorId) throw new Error('Solo quien entrega puede reasignar el traspaso.')
  if (item.estado === 'aceptado') throw new Error('El traspaso ya fue aceptado.')
  if (!receptorId || receptorId === item.receptorId)
    throw new Error('Selecciona otro abogado destinatario.')
  if (receptorId === item.emisorId) throw new Error('El destinatario debe ser otro abogado.')
  requerido(motivo, 'El motivo de la reasignación')
  const next: Traspaso = {
    ...item,
    receptorId,
    estado: 'pendiente',
    historial: [
      ...item.historial,
      { tipo: 'reasignado', por: actorId, en: now, motivo: motivo.trim(), receptorId },
    ],
  }
  return { traspaso: next, detalles: guardar(details, next) }
}

export function tareaAsuncion(input: {
  expedienteId: string
  oportunidadId: string | null
  receptorId: string
  referencia: string
}): CrearTareaInput {
  const due = new Date()
  due.setDate(due.getDate() + daysUntilWeekday(due))
  due.setHours(9, 0, 0, 0)
  return {
    expedienteId: input.expedienteId,
    oportunidadId: input.oportunidadId,
    tipo: 'Tarea',
    titulo: TAREA_ASUNCION,
    descripcion: `Traspaso del expediente ${input.referencia}. Revisa el expediente y firma el RECIBÍ («Firmar RECIBÍ y asumir») o pide aclaración.\nAbrir: /expedientes/${input.expedienteId}`,
    prioridad: 'Alta',
    venceEn: due.toISOString(),
    recordarEn: null,
    clasePlazo: null,
    critico: false,
    asignadoId: input.receptorId,
    mensajeInicial: `Se te ha traspasado el expediente ${input.referencia}. Abre el expediente y firma el RECIBÍ para asumir la responsabilidad o pide aclaración.`,
  }
}

function daysUntilWeekday(date: Date) {
  const day = date.getDay()
  return day === 5 ? 3 : day === 6 ? 2 : 1
}

export function diasHabilesDesde(createdAt: string, now = new Date()) {
  const start = new Date(createdAt)
  if (Number.isNaN(start.getTime())) return 0
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  let count = 0
  while (current < end) {
    current.setDate(current.getDate() + 1)
    if (current.getDay() !== 0 && current.getDay() !== 6) count += 1
  }
  return count
}

export type NivelDemora = 'en_plazo' | 'demorado' | 'escalar'

export function nivelDemora(
  item: Pick<Traspaso, 'creadoEn' | 'estado'>,
  now = new Date(),
): NivelDemora {
  if (item.estado === 'aceptado') return 'en_plazo'
  const days = diasHabilesDesde(item.creadoEn, now)
  return days >= 3 ? 'escalar' : days >= 1 ? 'demorado' : 'en_plazo'
}

export function etiquetaCasework(naturaleza: 'Judicial' | 'Extrajudicial') {
  return `${naturaleza.toUpperCase()} · PARA INICIAR`
}

export function responsableEfectivo(item: Traspaso) {
  return item.estado === 'aceptado' ? item.receptorId : item.emisorId
}
