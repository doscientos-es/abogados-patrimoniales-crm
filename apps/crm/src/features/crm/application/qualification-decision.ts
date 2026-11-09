import type { CrearTareaInput } from '@/features/tareas'
import type { Json } from '@/shared/infrastructure/supabase'

export type TipoDecision =
  | 'cliente_no_continua'
  | 'no_atendible'
  | 'pendiente_cliente'
  | 'en_analisis'
  | 'preparar_presupuesto'

export const DECISIONES_CIERRE = ['cliente_no_continua', 'no_atendible'] as const
export type TipoCierre = (typeof DECISIONES_CIERRE)[number]

export const DECISION_LABEL: Record<TipoDecision, string> = {
  cliente_no_continua: 'Cliente no continúa',
  no_atendible: 'No atendible por el despacho',
  pendiente_cliente: 'Pendiente del cliente',
  en_analisis: 'En análisis por el despacho',
  preparar_presupuesto: 'Preparar presupuesto',
}

export function tareaPresupuesto(input: {
  servicio: string
  observaciones: string
  oportunidadId: string
  responsableId: string
  fecha: string
}): CrearTareaInput {
  return {
    expedienteId: null,
    oportunidadId: input.oportunidadId,
    tipo: 'Tarea',
    titulo: 'PREPARAR PRESUPUESTO',
    descripcion: `Servicio a presupuestar: ${input.servicio}${input.observaciones ? `\n\nInstrucciones del abogado: ${input.observaciones}` : ''}`,
    prioridad: 'Media',
    venceEn: new Date(`${input.fecha}T09:00`).toISOString(),
    recordarEn: null,
    clasePlazo: null,
    critico: false,
    asignadoId: input.responsableId,
    mensajeInicial: mensajePreparacion(input),
  }
}

export function mensajePreparacion(decision: {
  servicio: string
  observaciones: string
  fecha: string
}) {
  const base = `Preparar presupuesto: ${decision.servicio}. Fecha objetivo: ${decision.fecha.split('-').reverse().join('/')}.`
  const observations = decision.observaciones.trim()
  return observations ? `${base}\nInstrucciones del abogado: ${observations}` : base
}

export const MOTIVOS_NO_CONTINUA = [
  'No está interesado',
  'No acepta condiciones / honorarios',
  'Ha decidido no actuar',
  'Ha elegido otro profesional',
  'No responde / desiste',
  'Otro',
] as const

export const MOTIVOS_NO_ATENDIBLE = [
  'Fuera de nuestras áreas de práctica',
  'Conflicto de interés',
  'Asunto inviable / sin fundamento',
  'Plazo vencido / prescripción',
  'Sin capacidad o disponibilidad',
  'Otro',
] as const

export const ESPERAS_CLIENTE = [
  'Documentación',
  'Confirmación / decisión',
  'Información adicional',
  'Pago / provisión',
  'Otro',
] as const

export const ANALISIS_DESPACHO = [
  'Viabilidad jurídica',
  'Revisar documentación',
  'Estudiar estrategia',
  'Conflicto de interés / admisibilidad',
  'Alcance económico',
  'Otro',
] as const

const PENDING_TITLES: Record<string, string> = {
  Documentación: 'REVISAR DOCUMENTACIÓN DEL CLIENTE',
  'Confirmación / decisión': 'REVISAR CONFIRMACIÓN DEL CLIENTE',
  'Información adicional': 'REVISAR INFORMACIÓN DEL CLIENTE',
  'Pago / provisión': 'REVISAR PAGO / PROVISIÓN DEL CLIENTE',
}
const ANALYSIS_TITLES: Record<string, string> = {
  'Viabilidad jurídica': 'ANALIZAR VIABILIDAD DEL ASUNTO',
  'Revisar documentación': 'ANALIZAR DOCUMENTACIÓN DEL ASUNTO',
  'Estudiar estrategia': 'ESTUDIAR ESTRATEGIA DEL ASUNTO',
  'Conflicto de interés / admisibilidad': 'ANALIZAR CONFLICTO / ADMISIBILIDAD',
  'Alcance económico': 'ANALIZAR ALCANCE ECONÓMICO',
}

export const tituloPendiente = (espera: string) =>
  PENDING_TITLES[espera] ?? 'REVISAR RESPUESTA / DOCUMENTACIÓN DEL CLIENTE'
export const tituloAnalisis = (tema: string) =>
  ANALYSIS_TITLES[tema] ?? 'ANALIZAR VIABILIDAD DEL ASUNTO'

export type DecisionCualificacion = {
  tipo: TipoDecision
  fecha: string
  motivo: string
  detalle: string
  tareaId?: string
  responsableId?: string
  fechaRevision?: string
  decididoPor?: string
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function decisionActual(details: Json): DecisionCualificacion | null {
  const decision = record(record(details)['decisionCualificacion'])
  return typeof decision['tipo'] === 'string' && decision['tipo'] in DECISION_LABEL
    ? (decision as unknown as DecisionCualificacion)
    : null
}

/** Preserve other detail fields while appending a decision to the audit trail. */
export function conDecision(details: Json, decision: DecisionCualificacion): Json {
  const base = record(details)
  const historial = Array.isArray(base['historialDecisionesCualificacion'])
    ? (base['historialDecisionesCualificacion'] as unknown[])
    : []
  return {
    ...base,
    decisionCualificacion: decision,
    historialDecisionesCualificacion: [...historial, decision],
  } as Json
}

export function tareaDecision(input: {
  tipo: 'pendiente_cliente' | 'en_analisis'
  motivo: string
  detalle: string
  oportunidadId: string
  responsableId: string | null
  fecha: string
}): CrearTareaInput {
  const titulo =
    input.tipo === 'pendiente_cliente'
      ? tituloPendiente(input.motivo)
      : tituloAnalisis(input.motivo)
  const prefix =
    input.tipo === 'pendiente_cliente'
      ? `Pendiente del cliente · ${input.motivo}`
      : `En análisis por el despacho · ${input.motivo}. Al completarla, volver a CUALIFICACIÓN para tomar una nueva decisión.`
  return {
    expedienteId: null,
    oportunidadId: input.oportunidadId,
    tipo: 'Tarea',
    titulo,
    descripcion: `${prefix}\n\n${input.detalle}`.trim(),
    prioridad: 'Media',
    venceEn: new Date(`${input.fecha}T09:00`).toISOString(),
    recordarEn: null,
    clasePlazo: null,
    critico: false,
    asignadoId: input.responsableId,
  }
}

export const preparaYo = (responsableId: string | null, currentUserId: string | null | undefined) =>
  Boolean(responsableId && currentUserId && responsableId === currentUserId)

export function instruccionesPresupuesto(details: Json) {
  const decision = decisionActual(details)
  if (!decision || decision.tipo !== 'preparar_presupuesto') return null
  return {
    servicio: decision.motivo,
    instrucciones: decision.detalle,
    decididoPor: decision.decididoPor ?? null,
    fechaObjetivo: decision.fechaRevision ?? null,
  }
}
