import type { Json } from '@/shared/infrastructure/supabase'

export type LineaPresupuesto = {
  id: string
  servicioId: string | null
  codigo: string
  nombre: string
  descripcion: string
  cantidad: number
  precioCents: number
  ivaPct: number | null
  revisadoPrecioCero: boolean
  precioInvalido?: boolean
}

export type BloquePresupuesto = {
  id: string
  bloqueId: string | null
  titulo: string
  texto: string
  incluido: boolean
}

export type CopiaVersion = {
  version: number
  referencia: string
  fecha: string
  asunto: string
  lineas: LineaPresupuesto[]
  bloques: BloquePresupuesto[]
  condiciones: string
  instantanea?: {
    cliente: { nombre: string; email: string; nif?: string }
    despacho: string
    totales: { base: number; iva: number; total: number }
    finalizadoPor: string | null
  }
}

export type EstadoEditor =
  | 'borrador'
  | 'en_revision'
  | 'devuelto'
  | 'finalizado'
  | 'validado'
  | 'enviado'
  | 'aceptado'
export type Instantanea = {
  cliente: { nombre: string; email: string; nif?: string }
  despacho: string
  totales: { base: number; iva: number; total: number }
  finalizadoPor: string | null
}
export type Revision = {
  tareaId: string
  version: number
  asignadoId: string
  asignadoNombre: string
  solicitadaPor: string | null
  estado: 'pendiente' | 'validada' | 'devuelta' | 'obsoleta'
  huella: string
  copia: CopiaVersion
  observaciones: string
  venceEn?: string | null
  solicitadaEn?: string
  resolucion?: {
    por: string
    porNombre: string
    fecha: string
    decision: 'validada' | 'devuelta'
    observaciones?: string
  }
  obsoletaEn?: string
}

export type VersionPresupuesto = CopiaVersion & {
  estado: EstadoEditor
  finalizadoEn?: string
  revisiones?: Revision[]
  borradorEnvio?: {
    plantilla: { id: string; nombre: string } | null
    destinatario: string
    asunto: string
    mensaje: string
    guardadoEn: string
    guardadoPor: string | null
  }
  envioTarea?: { tareaId: string; asignadoId: string; asignadoNombre: string; creadaEn: string }
  validacion?: { fecha: string; por: string; tareaId: string }
  revision?: Revision
  envio?: {
    fecha: string
    destinatario: string
    canal: string
    asunto: string
    mensaje: string
    declaradoPor: string | null
    declaradoPorNombre?: string
    plantilla?: { id: string; nombre: string } | null
    copia?: CopiaVersion
  }
}

export type EditorPresupuesto = { actual: VersionPresupuesto; anteriores: VersionPresupuesto[] }
export type ServicioCatalogo = Pick<
  LineaPresupuesto,
  'id' | 'codigo' | 'nombre' | 'descripcion' | 'precioCents' | 'ivaPct'
>
export type BloqueMaestro = {
  id: string
  titulo: string
  texto: string
  orden: number
  activo: boolean
  porDefecto: boolean
  archivado: boolean
}

type RecordValue = Record<string, unknown>
const rec = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {}
const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
const round = (value: number) => Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON)

export function totalesLinea(linea: Pick<LineaPresupuesto, 'cantidad' | 'precioCents' | 'ivaPct'>) {
  const base = round(linea.cantidad * linea.precioCents)
  const iva = round((base * (linea.ivaPct ?? 0)) / 100)
  return { base, iva, total: base + iva }
}

export function totales(lineas: LineaPresupuesto[]) {
  return lineas.reduce(
    (sum, linea) => {
      const row = totalesLinea(linea)
      return { base: sum.base + row.base, iva: sum.iva + row.iva, total: sum.total + row.total }
    },
    { base: 0, iva: 0, total: 0 },
  )
}

export const euros = (cents: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)

export function parseEuros(value: string): number | null {
  let normalized = value.replace(/€/g, '').replace(/\s/g, '')
  if (!/^\d[\d.,]*$/.test(normalized)) return null
  const thousands = /^\d{1,3}(\.\d{3})+$/
  if (normalized.includes(',')) {
    const parts = normalized.split(',')
    if (parts.length !== 2) return null
    const [integer, decimals] = parts as [string, string]
    if (!/^\d{1,2}$/.test(decimals) || (integer.includes('.') && !thousands.test(integer)))
      return null
    normalized = `${integer.replace(/\./g, '')}.${decimals}`
  } else if (normalized.includes('.')) {
    if (thousands.test(normalized)) normalized = normalized.replace(/\./g, '')
    else if (!/^\d+\.\d{1,2}$/.test(normalized)) return null
  }
  const amount = Number(normalized)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null
}

export const lineaDesdeServicio = (service: ServicioCatalogo): LineaPresupuesto => ({
  ...service,
  id: uid(),
  servicioId: service.id,
  cantidad: 1,
  revisadoPrecioCero: false,
})

export const lineaPersonalizada = (): LineaPresupuesto => ({
  id: uid(),
  servicioId: null,
  codigo: '',
  nombre: '',
  descripcion: '',
  cantidad: 1,
  precioCents: 0,
  ivaPct: 21,
  revisadoPrecioCero: false,
})

export const bloquesIniciales = (blocks: BloqueMaestro[]): BloquePresupuesto[] =>
  [...blocks]
    .filter((block) => block.activo && block.porDefecto && !block.archivado)
    .sort((first, second) => first.orden - second.orden)
    .map((block) => ({
      id: uid(),
      bloqueId: block.id,
      titulo: block.titulo,
      texto: block.texto,
      incluido: true,
    }))

const CAMPOS_SEGUIMIENTO = [
  'estado',
  'fechaEnvio',
  'versionEnviada',
  'destinatario',
  'canal',
  'validadoVersion',
  'validadoPor',
  'fechaValidacion',
  'importeEnviado',
  'importeVigente',
] as const
const LEGADO: Array<[string, string]> = [
  ['alcance', 'Alcance incluido'],
  ['exclusiones', 'Exclusiones'],
  ['honorarios', 'Honorarios'],
  ['impuestos', 'Impuestos'],
  ['formaPago', 'Forma y calendario de pago'],
  ['gastos', 'Suplidos y gastos'],
  ['condiciones', 'Condiciones y observaciones'],
  ['vigencia', 'Vigencia'],
]

export function datosLegado(presupuesto: unknown): Array<{ etiqueta: string; valor: string }> {
  const quote = rec(presupuesto)
  return LEGADO.map(([key, etiqueta]) => ({ etiqueta, valor: text(quote[key]).trim() })).filter(
    (item) => item.valor,
  )
}

export function validacionReiniciada(presupuestoExterior: unknown): RecordValue {
  const quote = rec(presupuestoExterior)
  return {
    validadoVersion: null,
    validadoPor: null,
    fechaValidacion: null,
    estado: typeof quote['versionEnviada'] === 'number' ? ENVIO_REGISTRADO : 'En preparación',
  }
}

export function legadoComprometido(detalles: unknown): boolean {
  const base = rec(detalles)
  const quote = rec(base['presupuesto'])
  return (
    Boolean(text(quote['fechaEnvio'])) ||
    typeof quote['versionEnviada'] === 'number' ||
    ['Validado', 'Enviado al cliente', ENVIO_REGISTRADO, 'Aceptado'].includes(
      text(quote['estado']),
    ) ||
    Object.keys(rec(base['aceptacion'])).length > 0
  )
}

export function leerEditor(detalles: unknown): EditorPresupuesto | null {
  const editor = rec(rec(rec(detalles)['presupuesto'])['editor'])
  const actual = rec(editor['actual'])
  if (typeof actual['version'] !== 'number' || !Array.isArray(actual['lineas'])) return null
  return {
    actual: actual as unknown as VersionPresupuesto,
    anteriores: Array.isArray(editor['anteriores'])
      ? (editor['anteriores'] as VersionPresupuesto[])
      : [],
  }
}

export function nuevoBorrador(input: {
  detalles: unknown
  asunto: string
  referenciaLead: string
  bloques: BloqueMaestro[]
  hoy: string
  ahora?: string
}): { editor: EditorPresupuesto; extra: RecordValue } {
  const details = rec(input.detalles)
  const quote = rec(details['presupuesto'])
  const legacy = datosLegado(quote)
  const acceptedVersion = rec(details['aceptacion'])['version']
  const number = (value: unknown) => (typeof value === 'number' && value > 0 ? value : 0)
  const committed = legadoComprometido(input.detalles)
  const previousVersion = Math.max(
    number(quote['version']),
    number(quote['versionEnviada']),
    number(acceptedVersion),
  )
  const extra: RecordValue = {}
  if (!quote['legadoOriginal'] && (legacy.length || committed)) {
    const original: RecordValue = {
      version: quote['version'] ?? null,
      referencia: quote['referencia'] ?? null,
    }
    for (const [key] of LEGADO) if (quote[key] !== undefined) original[key] = quote[key]
    for (const key of CAMPOS_SEGUIMIENTO) if (quote[key] !== undefined) original[key] = quote[key]
    extra['legadoOriginal'] = original
  }
  if (committed) Object.assign(extra, validacionReiniciada(quote))
  return {
    editor: {
      actual: {
        version: committed ? Math.max(previousVersion, 1) + 1 : previousVersion || 1,
        estado: 'borrador',
        referencia: text(quote['referencia']) || `PR-${input.referenciaLead}`,
        fecha: input.hoy,
        asunto: input.asunto,
        lineas: [],
        bloques: bloquesIniciales(input.bloques),
        condiciones: legacy.map(({ etiqueta, valor }) => `${etiqueta}: ${valor}`).join('\n'),
      },
      anteriores: [],
    },
    extra,
  }
}

export function conEditor(
  detalles: unknown,
  editor: EditorPresupuesto,
  extra: RecordValue = {},
): Json {
  const base = rec(detalles)
  const quote = rec(base['presupuesto'])
  const isSend = extra['estado'] === 'Enviado al cliente'
  const state = extra['estado'] ?? quote['estado']
  return {
    ...base,
    presupuesto: {
      ...quote,
      ...extra,
      ...(state === 'Enviado al cliente' && !isSend ? { estado: ENVIO_REGISTRADO } : {}),
      referencia: editor.actual.referencia,
      version: editor.actual.version,
      editor: editor as unknown as Json,
    },
  } as Json
}

export function problemasParaFinalizar(version: VersionPresupuesto): string[] {
  const problems: string[] = []
  if (!version.lineas.length) problems.push('Añade al menos un servicio.')
  for (const line of version.lineas) {
    const label = line.nombre || line.codigo || 'Servicio sin nombre'
    if (!line.nombre.trim()) problems.push('Hay un servicio sin nombre.')
    if (line.ivaPct === null) problems.push(`Decide el IVA de «${label}».`)
    if (line.precioCents === 0 && !line.revisadoPrecioCero)
      problems.push(`Revisa el precio 0 de «${label}».`)
    if (!(line.cantidad > 0) || !Number.isFinite(line.cantidad))
      problems.push(`La cantidad de «${label}» debe ser mayor que 0.`)
    if (line.precioInvalido || !Number.isFinite(line.precioCents) || line.precioCents < 0)
      problems.push(`El precio de «${label}» no es un importe válido.`)
  }
  return [...new Set(problems)]
}

export const editable = (version: VersionPresupuesto) => version.estado === 'borrador'

const copiaDe = (version: VersionPresupuesto): CopiaVersion =>
  structuredClone({
    version: version.version,
    referencia: version.referencia,
    fecha: version.fecha,
    asunto: version.asunto,
    lineas: version.lineas,
    bloques: version.bloques,
    condiciones: version.condiciones,
    ...(version.instantanea ? { instantanea: version.instantanea } : {}),
  })

export function nuevaVersion(editor: EditorPresupuesto, hoy: string): EditorPresupuesto {
  const {
    envio: _envio,
    finalizadoEn: _finalizado,
    instantanea: _instantanea,
    validacion: _validacion,
    revision: _revision,
    revisiones: _revisiones,
    borradorEnvio: _borradorEnvio,
    ...rest
  } = editor.actual
  return {
    actual: {
      ...structuredClone(rest),
      version: editor.actual.version + 1,
      estado: 'borrador',
      fecha: hoy,
    },
    anteriores: [...editor.anteriores, editor.actual],
  }
}

export function huella(
  version: Pick<
    VersionPresupuesto,
    'version' | 'referencia' | 'fecha' | 'asunto' | 'lineas' | 'bloques' | 'condiciones'
  >,
) {
  const serialized = JSON.stringify([
    version.version,
    version.referencia,
    version.fecha,
    version.asunto,
    version.lineas,
    version.bloques,
    version.condiciones,
  ])
  let hash = 5381
  for (let index = 0; index < serialized.length; index++)
    hash = ((hash << 5) + hash + serialized.charCodeAt(index)) | 0
  return `${serialized.length}-${(hash >>> 0).toString(36)}`
}

export function nuevaVersionConSeguimiento(
  detalles: unknown,
  editor: EditorPresupuesto,
  hoy: string,
  _ahora?: string,
) {
  return {
    editor: nuevaVersion(editor, hoy),
    extra: validacionReiniciada(rec(detalles)['presupuesto']),
  }
}

export function editarVersion(
  detalles: unknown,
  editor: EditorPresupuesto,
  hoy: string,
  ahora: string,
) {
  const version = editor.actual
  if (version.estado === 'borrador') return { editor, extra: {}, nueva: false }
  if (version.estado === 'devuelto' || version.estado === 'finalizado') {
    const { instantanea: _instantanea, finalizadoEn: _finalizado, ...rest } = version
    return {
      editor: { ...editor, actual: { ...rest, estado: 'borrador' as const } },
      extra: {},
      nueva: false,
    }
  }
  const closed: VersionPresupuesto =
    version.estado === 'en_revision' && version.revision?.estado === 'pendiente'
      ? { ...version, revision: { ...version.revision, estado: 'obsoleta', obsoletaEn: ahora } }
      : version
  const next = nuevaVersionConSeguimiento(detalles, { ...editor, actual: closed }, hoy)
  return { ...next, nueva: true }
}

export const marcadorRevision = (leadId: string, version: number) =>
  `[presupuesto-lead:${leadId}:v${version}]`
export function leerMarcador(value: string): { leadId: string; version: number } | null {
  const match = new RegExp('\\[presupuesto-lead:([0-9a-fA-F-]{8,}):v(\\d+)\\]').exec(value)
  const leadId = match?.[1]
  return leadId ? { leadId, version: Number(match?.[2]) } : null
}

export function puedeSolicitarRevision(editor: EditorPresupuesto): string | null {
  const version = editor.actual
  if (version.estado === 'en_revision' && version.revision?.estado === 'pendiente')
    return 'Esta versión ya tiene una revisión pendiente.'
  if (!['borrador', 'devuelto', 'finalizado'].includes(version.estado))
    return 'Pulsa Editar para preparar una nueva versión.'
  return problemasParaFinalizar(version)[0] ?? null
}

export function sincronizarAsignado(
  editor: EditorPresupuesto,
  tareaId: string,
  asignadoId: string,
  asignadoNombre: string,
  ahora: string,
): EditorPresupuesto {
  const found = revisionDeTarea(editor, tareaId)
  if (!found?.vigente || !editor.actual.revision)
    throw new Error('Solo se sincroniza una revisión vigente.')
  if (!asignadoId) throw new Error('La tarea no tiene responsable.')
  const previous = editor.actual.revision
  return {
    ...editor,
    actual: {
      ...editor.actual,
      revision: {
        ...previous,
        asignadoId,
        asignadoNombre,
        observaciones: `${previous.observaciones ? `${previous.observaciones}\n` : ''}[${ahora.slice(0, 10)}] Responsable sincronizado desde la tarea: ${previous.asignadoNombre} → ${asignadoNombre}`,
      },
    },
  }
}

export function anularRevisionSinDecision(
  editor: EditorPresupuesto,
  ahora: string,
): EditorPresupuesto {
  const version = editor.actual
  if (version.estado !== 'en_revision' || version.revision?.estado !== 'pendiente')
    throw new Error('No hay revisión pendiente.')
  const { instantanea: _instantanea, finalizadoEn: _finalizado, revision, ...rest } = version
  return {
    ...editor,
    actual: {
      ...rest,
      estado: 'borrador',
      revisiones: [
        ...(version.revisiones ?? []),
        { ...revision, estado: 'obsoleta', obsoletaEn: ahora },
      ],
    },
  }
}

export function datosRevision(
  existente: { id: string; asignadoId: string | null; venceEn: string | null } | null,
  dialogo: { asignadoId: string; fecha: string },
  nombreDe: (id: string) => string,
) {
  if (existente) {
    if (!existente.asignadoId)
      throw new Error(
        'La tarea existente no tiene responsable: asígnalo en la tarea antes de continuar.',
      )
    return {
      reutiliza: true,
      tareaId: existente.id,
      asignadoId: existente.asignadoId,
      asignadoNombre: nombreDe(existente.asignadoId),
      venceEn: existente.venceEn ? existente.venceEn.slice(0, 10) : null,
      difiere: existente.asignadoId !== dialogo.asignadoId,
    }
  }
  return {
    reutiliza: false,
    tareaId: null,
    asignadoId: dialogo.asignadoId,
    asignadoNombre: nombreDe(dialogo.asignadoId),
    venceEn: dialogo.fecha || null,
    difiere: false,
  }
}

export function solicitarRevision(
  editor: EditorPresupuesto,
  input: {
    tareaId: string
    asignadoId: string
    asignadoNombre: string
    solicitadaPor: string | null
    observaciones: string
    cliente: Instantanea['cliente']
    despacho: string
    ahora: string
    venceEn?: string | null
  },
): EditorPresupuesto {
  const blocked = puedeSolicitarRevision(editor)
  if (blocked) throw new Error(blocked)
  if (!input.tareaId || !input.asignadoId)
    throw new Error('Falta la tarea o el responsable de revisión.')
  const fixed: VersionPresupuesto = {
    ...editor.actual,
    finalizadoEn: input.ahora,
    instantanea: {
      cliente: { ...input.cliente },
      despacho: input.despacho,
      totales: totales(editor.actual.lineas),
      finalizadoPor: input.solicitadaPor,
    },
  }
  const previousRevisions = [
    ...(editor.actual.revisiones ?? []),
    ...(editor.actual.revision ? [editor.actual.revision] : []),
  ]
  const revision: Revision = {
    tareaId: input.tareaId,
    version: fixed.version,
    asignadoId: input.asignadoId,
    asignadoNombre: input.asignadoNombre,
    solicitadaPor: input.solicitadaPor,
    venceEn: input.venceEn ?? null,
    solicitadaEn: input.ahora,
    estado: 'pendiente',
    huella: huella(fixed),
    copia: copiaDe(fixed),
    observaciones: input.observaciones,
  }
  return {
    ...editor,
    actual: { ...fixed, estado: 'en_revision', revisiones: previousRevisions, revision },
  }
}

export function revisionDeTarea(editor: EditorPresupuesto | null, tareaId: string) {
  if (!editor) return null
  for (const version of [editor.actual, ...editor.anteriores]) {
    const revisions = [
      ...(version.revision ? [version.revision] : []),
      ...(version.revisiones ?? []),
    ]
    for (const revision of revisions) {
      if (revision.tareaId !== tareaId) continue
      const vigente =
        version === editor.actual &&
        version.estado === 'en_revision' &&
        revision.estado === 'pendiente' &&
        version.revision?.tareaId === tareaId &&
        revision.huella === huella(version)
      return { revision, version, vigente }
    }
  }
  return null
}

export function resolverRevision(
  editor: EditorPresupuesto,
  input: {
    tareaId: string
    decision: 'validada' | 'devuelta'
    usuarioId: string | null
    usuarioNombre: string
    observaciones: string
    ahora: string
    tarea: { asignadoId: string | null; abierta: boolean }
  },
) {
  const found = revisionDeTarea(editor, input.tareaId)
  if (!found) throw new Error('Esta tarea no corresponde a una revisión del presupuesto.')
  if (!found.vigente)
    throw new Error('Revisión obsoleta: el presupuesto ha cambiado o ya se resolvió.')
  if (!input.tarea.abierta) throw new Error('La tarea está cerrada sin decisión.')
  if (input.tarea.asignadoId !== found.revision.asignadoId)
    throw new Error('La tarea se ha reasignado y la revisión no está sincronizada.')
  if (!input.usuarioId || input.usuarioId !== found.revision.asignadoId)
    throw new Error('Solo el responsable asignado puede resolver la revisión.')
  if (input.decision === 'devuelta' && !input.observaciones.trim())
    throw new Error('Para devolver indica las observaciones.')
  const revision = {
    ...found.revision,
    estado: input.decision,
    resolucion: {
      por: input.usuarioId,
      porNombre: input.usuarioNombre,
      fecha: input.ahora,
      decision: input.decision,
      observaciones: input.observaciones.trim(),
    },
  }
  if (input.decision === 'devuelta')
    return {
      editor: { ...editor, actual: { ...editor.actual, estado: 'devuelto' as const, revision } },
      extra: {},
    }
  const total = editor.actual.instantanea?.totales.total ?? totales(editor.actual.lineas).total
  return {
    editor: {
      ...editor,
      actual: {
        ...editor.actual,
        estado: 'validado' as const,
        revision,
        validacion: { fecha: input.ahora, por: input.usuarioNombre, tareaId: input.tareaId },
      },
    },
    extra: {
      estado: 'Validado',
      validadoVersion: editor.actual.version,
      validadoPor: input.usuarioNombre,
      fechaValidacion: input.ahora,
      importeVigente: Number((total / 100).toFixed(2)),
    },
  }
}

export const ENVIO_REGISTRADO = 'Envío registrado'
export function registrarEnvio(
  editor: EditorPresupuesto,
  envio: {
    fecha: string
    destinatario: string
    canal: string
    asunto: string
    mensaje: string
    declaradoPor: string | null
    declaradoPorNombre?: string
    plantilla?: { id: string; nombre: string } | null
  },
  declaracionExplicita: boolean,
  presupuestoExterior: unknown = {},
) {
  if (!declaracionExplicita) throw new Error('Falta la confirmación explícita del envío.')
  if (editor.actual.estado !== 'validado')
    throw new Error('La versión debe estar validada antes del envío.')
  const total = editor.actual.instantanea?.totales.total ?? totales(editor.actual.lineas).total
  const exterior = rec(presupuestoExterior)
  const history = Array.isArray(exterior['historialSeguimiento'])
    ? (exterior['historialSeguimiento'] as unknown[])
    : []
  const hadPreviousSend = typeof exterior['versionEnviada'] === 'number'
  const previous: RecordValue = {
    motivo: `Sustituido por envío de versión ${editor.actual.version}`,
    archivadoEn: envio.fecha,
    version: exterior['version'] ?? null,
  }
  for (const key of CAMPOS_SEGUIMIENTO) previous[key] = exterior[key] ?? null
  return {
    editor: {
      ...editor,
      actual: {
        ...editor.actual,
        estado: 'enviado' as const,
        envio: { ...envio, copia: copiaDe(editor.actual) },
      },
    },
    extra: {
      historialSeguimiento: hadPreviousSend ? [...history, previous] : history,
      estado: 'Enviado al cliente',
      destinatario: envio.destinatario,
      canal: envio.canal,
      fechaEnvio: envio.fecha.slice(0, 10),
      versionEnviada: editor.actual.version,
      importeEnviado: Number((total / 100).toFixed(2)),
      importeVigente: Number((total / 100).toFixed(2)),
    },
  }
}

export function versionesEnviadas(editor: EditorPresupuesto | null): VersionPresupuesto[] {
  return editor
    ? [editor.actual, ...editor.anteriores]
        .filter((version) => version.envio)
        .sort((a, b) => b.version - a.version)
    : []
}

export function copiaEnviada(version: VersionPresupuesto): CopiaVersion | null {
  if (version.envio?.copia) return version.envio.copia
  return version.instantanea && version.lineas.length && Array.isArray(version.bloques)
    ? copiaDe(version)
    : null
}

export const preparadaParaEnviar = (editor: EditorPresupuesto | null) =>
  editor?.actual.estado === 'validado' ? editor.actual : null
export function importeEnvioCents(
  version: VersionPresupuesto,
  presupuestoExterior: unknown = {},
): number | null {
  const snapshot = copiaEnviada(version)
  if (snapshot?.instantanea) return snapshot.instantanea.totales.total
  const quote = rec(presupuestoExterior)
  return quote['versionEnviada'] === version.version && typeof quote['importeEnviado'] === 'number'
    ? Math.round((quote['importeEnviado'] as number) * 100)
    : null
}

export function importeVigente(detalles: unknown): string {
  const quote = rec(rec(detalles)['presupuesto'])
  for (const key of ['importeEnviado', 'importeVigente']) {
    if (typeof quote[key] === 'number') return (quote[key] as number).toFixed(2)
  }
  if (leerEditor(detalles)) return ''
  return text(quote['honorarios'])
}

export function mensajeAvisoRevision(input: {
  referencia: string
  version: number
  fecha: string | null
  observaciones?: string
}): string {
  const due = input.fecha ? input.fecha.split('-').reverse().join('/') : 'sin plazo'
  const base = `Revisión de presupuesto ${input.referencia} · versión ${input.version} pendiente de validar. Plazo: ${due}.`
  const observations = input.observaciones?.trim()
  return observations ? `${base}\n${observations}` : base
}

export function fechaEnvioEs(value: string | null | undefined): string {
  const input = String(value ?? '').trim()
  if (!input) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input.split('-').reverse().join('/')
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  return `${date.toLocaleDateString('es-ES')} a las ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
