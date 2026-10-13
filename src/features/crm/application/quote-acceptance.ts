import type { Json } from '@/shared/infrastructure/supabase'

type RecordValue = Record<string, unknown>
const rec = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {}
const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

export type EstadoCliente = 'pendiente' | 'cambios' | 'aplazado' | 'aceptado' | 'rechazado'
export const ETIQUETA_ESTADO_CLIENTE: Record<EstadoCliente, string> = {
  pendiente: 'Pendiente de respuesta',
  cambios: 'Cambios solicitados',
  aplazado: 'Aplazado',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
}
export const MEDIOS_ACEPTACION = [
  'Email',
  'WhatsApp',
  'Presencial',
  'Teléfono',
  'Verbal',
  'Otro',
] as const
export type MedioAceptacion = (typeof MEDIOS_ACEPTACION)[number]
export type TareaSeguimiento = {
  tareaId: string
  version: number
  asignadoId: string
  asignadoNombre: string
  venceEn: string | null
  creadaEn: string
}
export type RespuestaCliente = {
  fecha: string
  estado: EstadoCliente
  motivo?: string
  fechaSeguimiento?: string
  nota?: string
  por: string | null
  version: number | null
}
export type SeguimientoCliente = {
  estado: EstadoCliente
  version: number | null
  motivo?: string
  fechaSeguimiento?: string
  tarea?: TareaSeguimiento
  historial: RespuestaCliente[]
}

function isEstado(value: unknown): value is EstadoCliente {
  return typeof value === 'string' && value in ETIQUETA_ESTADO_CLIENTE
}

export function leerSeguimiento(detalles: unknown): SeguimientoCliente {
  const data = rec(detalles)
  const state = rec(data['seguimientoCliente'])
  const acceptance = rec(data['aceptacion'])
  const legacy = text(rec(data['contratacion'])['decision'])
  const history = Array.isArray(state['historial'])
    ? (state['historial'] as RespuestaCliente[])
    : []
  const task = rec(state['tarea'])
  let status: EstadoCliente = 'pendiente'
  if (text(acceptance['fecha'])) status = 'aceptado'
  else if (isEstado(state['estado'])) status = state['estado']
  else if (legacy === 'Rechazado') status = 'rechazado'
  else if (legacy === 'Aplazado') status = 'aplazado'
  const reason =
    text(state['motivo']) ||
    (legacy === 'Rechazado' ? text(rec(data['contratacion'])['motivoRechazo']) : '')
  return {
    estado: status,
    version: typeof state['version'] === 'number' ? state['version'] : null,
    ...(reason ? { motivo: reason } : {}),
    ...(text(state['fechaSeguimiento'])
      ? { fechaSeguimiento: text(state['fechaSeguimiento']) }
      : {}),
    ...(text(task['tareaId']) ? { tarea: task as unknown as TareaSeguimiento } : {}),
    historial: history,
  }
}

export function versionEnviada(detalles: unknown): number | null {
  const version = rec(rec(detalles)['presupuesto'])['versionEnviada']
  return typeof version === 'number' ? version : null
}

export function registrarRespuesta(
  detalles: Json,
  response: {
    estado: Exclude<EstadoCliente, 'aceptado'>
    motivo?: string
    fechaSeguimiento?: string
    nota?: string
    por: string | null
    ahora?: string
  },
): Json {
  const reason = response.motivo?.trim() ?? ''
  const followupDate = response.fechaSeguimiento?.trim() ?? ''
  if (response.estado === 'rechazado' && !reason) throw new Error('Indica el motivo del rechazo.')
  if (response.estado === 'aplazado' && !followupDate)
    throw new Error('Indica la fecha de seguimiento del aplazamiento.')
  if (response.estado === 'cambios' && !reason)
    throw new Error('Describe los cambios que pide el cliente.')
  const data = rec(detalles)
  if (text(rec(data['aceptacion'])['fecha'])) throw new Error('El presupuesto ya está aceptado.')
  const previous = leerSeguimiento(detalles)
  const version = versionEnviada(detalles)
  const entry: RespuestaCliente = {
    fecha: response.ahora ?? new Date().toISOString(),
    estado: response.estado,
    ...(reason ? { motivo: reason } : {}),
    ...(followupDate ? { fechaSeguimiento: followupDate } : {}),
    ...(response.nota?.trim() ? { nota: response.nota.trim() } : {}),
    por: response.por,
    version,
  }
  return {
    ...data,
    seguimientoCliente: {
      ...rec(data['seguimientoCliente']),
      estado: response.estado,
      version,
      motivo: reason || null,
      fechaSeguimiento: followupDate || null,
      historial: [...previous.historial, entry],
    },
  } as Json
}

export function tareaSeguimientoVigente(detalles: unknown): TareaSeguimiento | null {
  const tracking = leerSeguimiento(detalles)
  const version = versionEnviada(detalles)
  return tracking.tarea && version !== null && tracking.tarea.version === version
    ? tracking.tarea
    : null
}

export function conTareaSeguimiento(detalles: unknown, task: TareaSeguimiento): Json {
  const data = rec(detalles)
  const tracking = rec(data['seguimientoCliente'])
  return {
    ...data,
    seguimientoCliente: {
      historial: [],
      ...tracking,
      estado: 'pendiente',
      version: task.version,
      tarea: task,
    },
  } as Json
}

export type TipoEvidenciaAceptacion = 'documento' | 'comunicacion' | 'constancia_interna'
export type AceptacionManualInput = {
  fecha: string
  medio: string
  aceptante: string
  evidenciaTipo: TipoEvidenciaAceptacion
  evidenciaReferencia: string
  evidenciaDocumentoId?: string
  evidenciaTexto: string
  importe: string
  por: string | null
}
export const esMedioVerbal = (medio: string) => medio === 'Verbal'
export const tipoEvidenciaPara = (
  medio: string,
  actual: TipoEvidenciaAceptacion,
): TipoEvidenciaAceptacion =>
  esMedioVerbal(medio)
    ? 'constancia_interna'
    : actual === 'constancia_interna'
      ? 'comunicacion'
      : actual

export function faltantesAceptacion(
  fechaEnvio: string,
  input: Omit<AceptacionManualInput, 'importe' | 'por'>,
): string[] {
  const missing: string[] = []
  const sentOn = fechaEnvio.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) missing.push('Fecha de aceptación válida')
  else if (sentOn && input.fecha < sentOn) missing.push(`Fecha no anterior al envío (${sentOn})`)
  if (!(MEDIOS_ACEPTACION as readonly string[]).includes(input.medio))
    missing.push('Medio de aceptación')
  if (!input.aceptante.trim()) missing.push('Quién acepta')
  if (esMedioVerbal(input.medio)) {
    if (input.evidenciaTipo !== 'constancia_interna')
      missing.push('Constancia de la aceptación verbal')
    if (!input.evidenciaTexto.trim()) missing.push('Constancia de la aceptación verbal (resumen)')
  } else if (input.medio) {
    if (input.evidenciaTipo === 'constancia_interna')
      missing.push('Evidencia: documento o comunicación')
    else if (
      input.evidenciaTipo === 'documento' &&
      (!input.evidenciaDocumentoId || !input.evidenciaReferencia.trim())
    )
      missing.push('Documento de aceptación guardado en la ficha del cliente')
    else if (input.evidenciaTipo === 'comunicacion' && !input.evidenciaReferencia.trim())
      missing.push('Referencia a la comunicación')
    if (!input.evidenciaTexto.trim()) missing.push('Texto de la conformidad')
  }
  return missing
}

const normalizedAmount = (value: string) =>
  Number(
    value
      .replace(/\s|€/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  ).toFixed(2)

export function construirAceptacionManual(
  detalles: unknown,
  input: AceptacionManualInput,
): RecordValue {
  const data = rec(detalles)
  const quote = rec(data['presupuesto'])
  const version = versionEnviada(detalles)
  if (version === null || !text(quote['fechaEnvio']))
    throw new Error('Registra primero el envío de la versión del presupuesto.')
  if (text(rec(data['aceptacion'])['fecha']))
    throw new Error('El presupuesto ya tiene una aceptación registrada.')
  const missing = faltantesAceptacion(text(quote['fechaEnvio']), input)
  if (missing.length) throw new Error(`Falta: ${missing.join(', ')}.`)
  const sentAmount = text(quote['importeEnviado'])
  if (
    sentAmount &&
    input.importe.trim() &&
    normalizedAmount(input.importe) !== normalizedAmount(sentAmount)
  )
    throw new Error(`El importe no coincide con el enviado (${sentAmount} €).`)
  const verbal = input.evidenciaTipo === 'constancia_interna'
  const reference = verbal ? '' : input.evidenciaReferencia.trim()
  return {
    fecha: input.fecha,
    version,
    importe: sentAmount || input.importe.trim(),
    estado: 'Aceptado',
    forma: 'Aceptado',
    medio: input.medio,
    canal: 'manual',
    aceptante: input.aceptante.trim(),
    evidencia: {
      tipo: input.evidenciaTipo,
      ...(reference ? { referencia: reference } : {}),
      ...(input.evidenciaTipo === 'documento' && input.evidenciaDocumentoId
        ? { documentoId: input.evidenciaDocumentoId }
        : {}),
      texto: input.evidenciaTexto.trim(),
    },
    soporte: verbal
      ? 'Constancia interna de aceptación verbal'
      : `${input.evidenciaTipo === 'documento' ? 'Documento' : 'Comunicación'}: ${reference}`,
    registradaPor: input.por,
    registradaEn: new Date().toISOString(),
  }
}

export function describirAceptacion(
  value: unknown,
): { estado: string; medio: string; legado: boolean } | null {
  const acceptance = rec(value)
  if (!text(acceptance['fecha'])) return null
  if (text(acceptance['medio']))
    return { estado: 'Aceptado', medio: text(acceptance['medio']), legado: false }
  const form = text(acceptance['forma'])
  return {
    estado: 'Aceptado',
    medio:
      form && form !== 'Aceptado' ? `${form} (registro anterior)` : 'No consta (registro anterior)',
    legado: true,
  }
}

export const bloqueEnlaceEmail = (url: string) => `\n\nVER Y ACEPTAR PRESUPUESTO:\n${url}\n`
export const TITULO_TAREA_SEGUIMIENTO = 'SEGUIMIENTO DEL PRESUPUESTO'
export const marcadorSeguimiento = (leadId: string, version: number) =>
  `[seguimiento-presupuesto:${leadId}:v${version}]`
export const marcadorModificacion = (leadId: string, version: number) =>
  `[modificacion-presupuesto:${leadId}:v${version}]`

export type CrearTareaSeguimientoInput = {
  expedienteId: null
  oportunidadId: string
  tipo: 'Tarea'
  titulo: string
  descripcion: string
  prioridad: 'Media' | 'Alta'
  venceEn: string | null
  recordarEn: null
  clasePlazo: null
  critico: false
  asignadoId: string
  mensajeInicial: string
}
export function tareaSeguimientoInput(input: {
  leadId: string
  referencia: string
  version: number
  cliente: string
  asignadoId: string
  venceEn: string | null
}): CrearTareaSeguimientoInput {
  const reference = `${input.referencia} · v${input.version}`
  return {
    expedienteId: null,
    oportunidadId: input.leadId,
    tipo: 'Tarea',
    titulo: `${TITULO_TAREA_SEGUIMIENTO} ${reference}`,
    descripcion: `${marcadorSeguimiento(input.leadId, input.version)}\nPresupuesto ${reference} enviado${input.cliente ? ` a ${input.cliente}` : ''}. Haz seguimiento de la respuesta y regístrala en el Lead › «Aceptación».`,
    prioridad: 'Media',
    venceEn: input.venceEn,
    recordarEn: null,
    clasePlazo: null,
    critico: false,
    asignadoId: input.asignadoId,
    mensajeInicial: `Presupuesto ${reference} enviado: haz seguimiento de la respuesta del cliente.`,
  }
}

export function tareaModificacionInput(input: {
  leadId: string
  referencia: string
  version: number
  cambios: string
  asignadoId: string
  venceEn: string | null
}): CrearTareaSeguimientoInput {
  return {
    expedienteId: null,
    oportunidadId: input.leadId,
    tipo: 'Tarea',
    titulo: `PREPARAR NUEVA VERSIÓN DEL PRESUPUESTO ${input.referencia} (cambios sobre v${input.version})`,
    descripcion: `${marcadorModificacion(input.leadId, input.version)}\nEl cliente pide cambios sobre la versión ${input.version} enviada:\n${input.cambios}\nEdita el presupuesto (se creará una versión nueva; la enviada se conserva) y solicita su revisión.`,
    prioridad: 'Media',
    venceEn: input.venceEn,
    recordarEn: null,
    clasePlazo: null,
    critico: false,
    asignadoId: input.asignadoId,
    mensajeInicial: `Cambios solicitados por el cliente sobre ${input.referencia} v${input.version}:\n${input.cambios}`,
  }
}

export async function asegurarTareaSeguimiento(input: {
  detalles: Json
  leadId: string
  referencia: string
  cliente: string
  asignadoId: string
  asignadoNombre: string
  venceEn: string | null
  ahora: string
  buscar: (marker: string) => Promise<{ id: string } | null>
  crear: (task: CrearTareaSeguimientoInput) => Promise<{ id: string } | null | undefined>
}): Promise<{ detalles: Json; tareaId: string; creada: boolean } | null> {
  const version = versionEnviada(input.detalles)
  if (version === null) throw new Error('No hay envío registrado.')
  if (tareaSeguimientoVigente(input.detalles)) return null
  if (!input.asignadoId) throw new Error('Elige el responsable del seguimiento.')
  const existing = await input.buscar(marcadorSeguimiento(input.leadId, version))
  let taskId = existing?.id ?? null
  let created = false
  if (!taskId) {
    const task = await input.crear(
      tareaSeguimientoInput({
        leadId: input.leadId,
        referencia: input.referencia,
        version,
        cliente: input.cliente,
        asignadoId: input.asignadoId,
        venceEn: input.venceEn,
      }),
    )
    if (!task?.id)
      throw new Error('El servidor no confirmó la creación de la tarea de seguimiento.')
    taskId = task.id
    created = true
  }
  return {
    tareaId: taskId,
    creada: created,
    detalles: conTareaSeguimiento(input.detalles, {
      tareaId: taskId,
      version,
      asignadoId: input.asignadoId,
      asignadoNombre: input.asignadoNombre,
      venceEn: input.venceEn,
      creadaEn: input.ahora,
    }),
  }
}

export const venceA18 = (date: string) => (date ? new Date(`${date}T18:00:00`).toISOString() : null)
export const DECISION_WON_COMPATIBLE = 'Aceptado verbalmente'
export function contratacionAceptada(value: unknown): RecordValue {
  return { ...rec(value), decision: DECISION_WON_COMPATIBLE, decisionMostrada: 'Aceptado' }
}
export const esErrorProformaObligatoria = (message: string) =>
  /proforma sent date is required|proforma_sent_on|not-null/i.test(message)

type Fase =
  | 'entry'
  | 'qualification'
  | 'first_meeting'
  | 'quote'
  | 'validation'
  | 'engagement'
  | 'won'
  | 'lost'
export type PasoAvance = {
  detalles: Json
  transicion?: { fase: Fase; subestado: string; motivo: string }
}
const FASES = [
  'entry',
  'qualification',
  'first_meeting',
  'quote',
  'validation',
  'engagement',
] as const
const SUBESTADOS: Record<string, string> = {
  qualification: 'Sin revisar',
  first_meeting: 'Realizada',
  quote: 'En preparación',
  validation: 'Validado',
  engagement: 'Enviado al cliente',
}
const MOTIVO_AVANCE = 'Avance automático: presupuesto ya enviado y aceptación registrada.'

export function pasosAvanceHastaEnvio(fase: string, detalles: Json): PasoAvance[] {
  if (fase === 'engagement') return []
  let index = FASES.indexOf(fase as (typeof FASES)[number])
  if (index < 0) throw new Error('Fase del Lead no válida para registrar la aceptación.')
  const data = rec(detalles)
  const quote = rec(data['presupuesto'])
  const sentVersion = versionEnviada(detalles)
  if (sentVersion === null)
    throw new Error('Registra primero el envío de la versión del presupuesto.')
  const currentVersion =
    typeof quote['version'] === 'number' ? quote['version'] : Number(text(quote['version'])) || null
  if (currentVersion !== sentVersion)
    throw new Error(
      `Hay una versión posterior (v${currentVersion ?? '?'}) a la enviada (v${sentVersion}). Registra la aceptación cuando la fase del Lead esté en «Enviado al cliente».`,
    )
  const missing = [
    !text(quote['destinatario']) && 'destinatario',
    !text(quote['canal']) && 'canal',
    !text(quote['fechaEnvio']) && 'fecha de envío',
  ].filter(Boolean)
  if (missing.length) throw new Error(`Al envío registrado le falta: ${missing.join(', ')}.`)
  const withQuote = (next: RecordValue) => ({ ...data, presupuesto: next }) as Json
  const recorded = withQuote({ ...quote, estado: 'Envío registrado' })
  const steps: PasoAvance[] = []
  while (FASES[index + 1] !== 'engagement') {
    const next = FASES[index + 1]
    if (!next) break
    steps.push({
      detalles: recorded,
      transicion: {
        fase: next,
        subestado: SUBESTADOS[next] ?? 'Sin revisar',
        motivo: MOTIVO_AVANCE,
      },
    })
    index++
  }
  steps.push({
    detalles: withQuote({ ...quote, estado: 'Validado', validadoVersion: sentVersion }),
  })
  steps.push({
    detalles: withQuote({
      ...quote,
      estado: 'Enviado al cliente',
      validadoVersion: sentVersion,
      versionEnviada: sentVersion,
    }),
    transicion: {
      fase: 'engagement',
      subestado: SUBESTADOS['engagement'] ?? 'Enviado al cliente',
      motivo: MOTIVO_AVANCE,
    },
  })
  return steps
}
