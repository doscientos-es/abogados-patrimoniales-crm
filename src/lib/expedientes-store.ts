// Capa de servicios del núcleo operativo (expedientes, líneas, ejecuciones,
// actuaciones, documentos, tareas, fechas, comunicaciones, intervinientes).
// Persiste hoy en localStorage con una API desacoplada: sustituir por Lovable
// Cloud no exigirá tocar las pantallas.
import { useSyncExternalStore } from 'react'

import { COMUNICACIONES_DEMO, TAREAS_COMUNICACIONES_DEMO } from '@/data/comunicaciones'
import { USUARIOS, type Prioridad } from '@/data/crm'
import {
  ESTADOS_TAREA_VIVOS,
  ESTADO_DOC_LEGADO,
  ESTADO_LINEA_LEGADO,
  ESTADO_TAREA_LEGADO,
  ETAPAS_INBOX,
  ETIQUETAS_INICIALES,
  SEMILLA_OPERATIVA,
  TITULOS_TAREA_INICIALES,
  claveEtiqueta,
  columnasDe,
  esRecibido,
  faseVigente,
  megafaseDe,
  requiereAccionLegado,
  tieneDefinitiva,
  type Actuacion,
  type AdjuntoComunicacion,
  type AsistenteReunion,
  type AuditoriaItem,
  type ColorEtiqueta,
  type Comunicacion,
  type DatosReunion,
  type Dependencia,
  type DestinatarioEmail,
  type Documento,
  type Ejecucion,
  type EstadoActuacion,
  type EstadoDocSimple,
  type EstadoGeneral,
  type EstadoLinea,
  type EstadoRecordatorio,
  type EstadoTareaOp,
  type EtapaInbox,
  type EtiquetaTarea,
  type EvidenciaTarea,
  type ExpedienteOp,
  type FechaCritica,
  type FranjaReunion,
  type FuenteIA,
  type IntervinienteOp,
  type LineaTrabajo,
  type MensajeTarea,
  type MotivoEspera,
  type MotivoRechazo,
  type Naturaleza,
  type Notificacion,
  type OrigenRelacion,
  type PrioridadLinea,
  type PuntoPreparacion,
  type Recordatorio,
  type RegistroTemporal,
  type ResumenIA,
  type SemillaOperativa,
  type SituacionLinea,
  type Subtarea,
  type TareaOp,
  type VersionDocumento,
} from '@/data/expedientes-model'
import { HOY, hoyTexto, parseFecha, sumarDias } from '@/data/pipeline'

/** Fecha en texto a N días desde hoy. */
const sumarDiasTexto = (dias: number) => sumarDias(dias)

export type VistaGuardada = {
  id: string
  nombre: string
  descripcion: string
  filtros: Record<string, string>
}

export type OpsState = SemillaOperativa & {
  version: number
  usuario: string
  /** Catálogo de etiquetas de tareas (relación muchos a muchos por id). */
  etiquetas: EtiquetaTarea[]
  /** Catálogo editable de títulos frecuentes de tarea (autocompletado). */
  titulosTarea: string[]
  vistas: VistaGuardada[]
  secuencias: Record<string, number>
}

const STORAGE_KEY = 'patrimonial-suite-ops'
const VERSION = 6
const isBrowser = typeof document !== 'undefined'

const VISTAS_BASE: VistaGuardada[] = [
  {
    id: 'v-mios',
    nombre: 'Mis expedientes',
    descripcion: 'Expedientes en los que soy responsable',
    filtros: { responsable: 'Marta Solé' },
  },
  {
    id: 'v-espera',
    nombre: 'En espera de tercero',
    descripcion: 'El avance no depende del despacho',
    filtros: { estadoOperativo: 'En espera' },
  },
  {
    id: 'v-nosotros',
    nombre: 'Debemos actuar nosotros',
    descripcion: 'Trabajo pendiente en el despacho',
    filtros: { dependencia: 'Debemos actuar nosotros' },
  },
  {
    id: 'v-ejecucion',
    nombre: 'En ejecución',
    descripcion: 'Expedientes con dimensión de ejecución activa',
    filtros: { fase: 'cumplimiento' },
  },
  {
    id: 'v-riesgo',
    nombre: 'Con alertas',
    descripcion: 'Expedientes con alguna alerta activa',
    filtros: { alertas: 'si' },
  },
]

/**
 * Numeración profesional definitiva: AP_N correlativo, permanente y único.
 * Conserva el código anterior como dato histórico interno (`codigoAnterior`)
 * y nunca reutiliza ni reasigna un número ya concedido. El identificador
 * técnico (`id`) no cambia, de modo que las URL y relaciones se mantienen.
 */
export function migrarCodigos(s: OpsState): OpsState {
  const usados = new Set<number>(
    s.expedientes.map((e) => e.numeroAp).filter((n): n is number => typeof n === 'number'),
  )
  let siguiente = Math.max(0, ...usados, s.secuencias?.['AP'] ?? 0)
  // Recorrido de más antiguo a más reciente para que el correlativo respete el orden de alta.
  const orden = [...s.expedientes].reverse()
  const asignados = new Map<string, { numeroAp: number; codigo: string; codigoAnterior?: string }>()
  for (const e of orden) {
    if (typeof e.numeroAp === 'number' && e.codigo === `AP_${e.numeroAp}`) continue
    let numero = typeof e.numeroAp === 'number' ? e.numeroAp : 0
    if (!numero || usados.has(numero)) {
      do {
        siguiente += 1
      } while (usados.has(siguiente))
      numero = siguiente
    }
    usados.add(numero)
    asignados.set(e.id, {
      numeroAp: numero,
      codigo: `AP_${numero}`,
      ...(e.codigoAnterior || e.codigo.startsWith('AP_') ? {} : { codigoAnterior: e.codigo }),
    })
  }
  if (!asignados.size) return s
  return {
    ...s,
    expedientes: s.expedientes.map((e) => ({ ...e, ...asignados.get(e.id) })),
    secuencias: { ...s.secuencias, AP: Math.max(siguiente, ...usados) },
  }
}

function semilla(): OpsState {
  return migrarSemillaOps({
    ...SEMILLA_OPERATIVA(),
    version: VERSION,
    usuario: 'Marta Solé',
    etiquetas: ETIQUETAS_INICIALES.map((e) => ({ ...e })),
    titulosTarea: [...TITULOS_TAREA_INICIALES],
    vistas: VISTAS_BASE,

    secuencias: {
      MS: 100,
      NT: 100,
      CAD: 100,
      LT: 100,
      EJ: 100,
      AC: 100,
      DOC: 100,
      TR: 100,
      FC: 100,
      CM: 100,
      IN: 100,
      AU: 100,
      EX: 200,
      AP: 0,
      ET: 100,
      HT: 100,
    },
  })
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const semillaBase: OpsState = isBrowser
  ? semilla()
  : {
      version: VERSION,
      usuario: '',
      etiquetas: [],
      titulosTarea: [],
      vistas: [],
      secuencias: {},
      expedientes: [],
      lineas: [],
      ejecuciones: [],
      actuaciones: [],
      documentos: [],
      tareas: [],
      fechas: [],
      comunicaciones: [],
      intervinientes: [],
      recordatorios: [],
      notificaciones: [],
      auditoria: [],
    }
let estado: OpsState = semillaBase
let hidratado = false
const listeners = new Set<() => void>()

function leerAlmacen(): OpsState {
  if (!isBrowser) return semillaBase
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return semilla()
    const parsed = JSON.parse(raw) as OpsState
    if (parsed.version !== VERSION) return semilla()
    // Catálogos añadidos después: se completan sin invalidar los datos guardados.
    // REUNIÓN es una tarea especial: no debe figurar entre los títulos preestablecidos.
    const titulos = (
      parsed.titulosTarea?.length ? parsed.titulosTarea : [...TITULOS_TAREA_INICIALES]
    ).filter((t) => !/reuni[oó]n/i.test(t))
    return { ...parsed, titulosTarea: titulos }
  } catch {
    return semilla()
  }
}

function persistir() {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado))
  } catch {
    /* almacenamiento no disponible */
  }
}

function set(fn: (s: OpsState) => OpsState) {
  estado = fn(estado)
  persistir()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * Migración segura de fases: traduce las fases antiguas (judiciales y
 * extrajudiciales) a las vigentes sin borrar ni duplicar expedientes, y
 * conserva "Requiere acción" como indicador transversal.
 */
function migrarFases(s: OpsState): OpsState {
  let cambios = 0
  const expedientes = s.expedientes.map((e) => {
    const vigente = faseVigente(e.naturaleza, e.fase)
    const marca = requiereAccionLegado(e.fase)
    if (vigente === e.fase && !marca) return e
    cambios += 1
    return {
      ...e,
      fase: vigente,
      ...(marca ? { requiereAccion: true } : {}),
    }
  })
  if (!cambios) return s
  return {
    ...s,
    expedientes,
    auditoria: [
      {
        id: `AU-MIG-${Date.now()}`,
        fecha: hoyTexto(),
        hora: '00:00',
        usuario: 'Sistema',
        accion: 'Migración de itinerario',
        entidad: 'Expediente',
        entidadId: '—',
        anterior: 'Fases anteriores',
        nuevo: `${cambios} expedientes migrados al itinerario vigente`,
      } as OpsState['auditoria'][number],
      ...s.auditoria,
    ],
  }
}

/**
 * Migración de actividades: los registros anteriores nacieron ya como
 * actuaciones, de modo que se marcan como tales sin duplicar información.
 * Se completa además la trazabilidad (fecha de registro y estado del registro).
 */
function migrarActuaciones(s: OpsState): OpsState {
  let cambios = 0
  const actuaciones = s.actuaciones.map((a) => {
    if (typeof a.esActuacion === 'boolean' && a.estadoRegistro && a.fechaRegistro) return a
    cambios += 1
    return {
      ...a,
      esActuacion: a.esActuacion ?? true,
      esHito: a.esHito ?? false,
      estadoRegistro:
        a.estadoRegistro ??
        (a.estado === 'Cancelada'
          ? 'Anulada'
          : a.estado === 'Borrador'
            ? 'Borrador'
            : 'Confirmada'),
      fechaRegistro: a.fechaRegistro ?? `${a.fecha} ${a.hora}`,
      creadoPor: a.creadoPor ?? a.autor,
    } as OpsState['actuaciones'][number]
  })
  if (!cambios) return s
  return { ...s, actuaciones }
}

/**
 * Migración de líneas de trabajo: traduce los estados históricos al catálogo
 * vigente y completa los campos nuevos (situación, prioridad, objetivo, orden
 * y trazabilidad) sin perder ningún dato existente.
 */
function migrarLineas(s: OpsState): OpsState {
  let cambios = 0
  const porExpediente = new Map<string, number>()
  const lineas = s.lineas.map((l) => {
    const n = (porExpediente.get(l.expedienteId) ?? 0) + 1
    porExpediente.set(l.expedienteId, n)
    const estado = (ESTADO_LINEA_LEGADO[l.estado as string] ?? l.estado) as EstadoLinea
    if (
      estado === l.estado &&
      l.situacion &&
      l.prioridad &&
      l.objetivo &&
      typeof l.orden === 'number'
    )
      return l
    cambios += 1
    const situacion: SituacionLinea =
      l.situacion ??
      (l.dependencia === 'Debemos actuar nosotros'
        ? 'Debemos trabajo'
        : l.dependencia === 'Sin acción inmediata'
          ? 'Sin acción inmediata'
          : l.dependencia === 'Pendiente del cliente'
            ? 'Depende de tercero'
            : 'Depende de tercero')
    return {
      ...l,
      estado,
      situacion,
      prioridad: (l.prioridad ?? 'Media') as PrioridadLinea,
      objetivo: l.objetivo ?? l.descripcion,
      orden: typeof l.orden === 'number' ? l.orden : n,
      ultimoAvance: l.ultimoAvance ?? l.dondeEstamos,
      fechaUltimoAvance: l.fechaUltimoAvance ?? l.fechaInicio,
      createdAt: l.createdAt ?? l.fechaInicio,
      createdBy: l.createdBy ?? l.responsable,
    } satisfies LineaTrabajo
  })
  if (!cambios) return s
  return { ...s, lineas }
}

/**
 * Migración del catálogo de etiquetas: garantiza el catálogo inicial y
 * traduce las etiquetas antiguas guardadas como texto libre en las tareas a
 * identificadores del catálogo, creando las que falten. Idempotente.
 */
function migrarEtiquetas(s: OpsState): OpsState {
  const catalogo: EtiquetaTarea[] = [...(s.etiquetas ?? [])]
  if (!catalogo.length) catalogo.push(...ETIQUETAS_INICIALES.map((e) => ({ ...e })))
  const porClave = new Map(catalogo.map((e) => [claveEtiqueta(e.nombre), e]))
  const porId = new Map(catalogo.map((e) => [e.id, e]))
  let extra = 0

  const tareas = s.tareas.map((t) => {
    const previas = t.etiquetas ?? []
    if (!previas.length) return t
    const ids = previas.map((valor) => {
      if (porId.has(valor)) return valor
      const clave = claveEtiqueta(valor)
      const existente = porClave.get(clave)
      if (existente) return existente.id
      extra += 1
      const nueva: EtiquetaTarea = {
        id: `ET-MIG-${extra}`,
        nombre: valor.trim(),
        color: 'gris',
        archivada: false,
        creadaEn: hoyTexto(),
        creadaPor: 'Sistema',
      }
      catalogo.push(nueva)
      porClave.set(clave, nueva)
      porId.set(nueva.id, nueva)
      return nueva.id
    })
    const unicas = [...new Set(ids)]
    return unicas.join('|') === previas.join('|') ? t : { ...t, etiquetas: unicas }
  })

  return { ...s, etiquetas: catalogo, tareas }
}

/**
 * Siembra etiquetas de ejemplo en las tareas de muestra que aún no tienen
 * ninguna, para que el sistema de etiquetas sea visible desde el inicio.
 * Idempotente: solo actúa sobre tareas sin etiquetas.
 */
function etiquetasSemilla(): Record<string, string[]> {
  return {
    'TR-0001': ['ET-GES'],
    'TR-0002': ['ET-COM'],
    'TR-0003': ['ET-ADM'],
    'TR-0004': ['ET-FAC'],
    'TR-0005': ['ET-ADM'],
  }
}

function sembrarEtiquetasTareas(s: OpsState): OpsState {
  const mapa = etiquetasSemilla()
  const validos = new Set((s.etiquetas ?? []).map((e) => e.id))
  let cambios = false
  const tareas = s.tareas.map((t) => {
    if ((t.etiquetas ?? []).length) return t
    const semilla = (mapa[t.id] ?? []).filter((id) => validos.has(id))

    if (!semilla.length) return t
    cambios = true
    return { ...t, etiquetas: semilla }
  })
  return cambios ? { ...s, tareas } : s
}

/**
 * Semilla de COMUNICACIONES (fase 1). Sólo añade los registros de prueba que
 * falten: nunca borra ni sobrescribe comunicaciones ni tareas existentes.
 */
function sembrarComunicaciones(s: OpsState): OpsState {
  const existentes = new Set(s.comunicaciones.map((c) => c.id))
  const nuevas = COMUNICACIONES_DEMO.filter((c) => !existentes.has(c.id))
  const idsTareas = new Set(s.tareas.map((t) => t.id))
  const tareasNuevas = (TAREAS_COMUNICACIONES_DEMO as TareaOp[]).filter((t) => !idsTareas.has(t.id))
  if (!nuevas.length && !tareasNuevas.length) return s
  return {
    ...s,
    comunicaciones: [...nuevas, ...s.comunicaciones],
    tareas: [...tareasNuevas, ...s.tareas],
  }
}

function migrarSemillaOps(s: OpsState): OpsState {
  return sembrarComunicaciones(
    unificarTareas(
      sembrarEtiquetasTareas(
        migrarEtiquetas(
          migrarTareas(migrarLineasFlexibles(migrarLineas(migrarActuaciones(migrarCodigos(s))))),
        ),
      ),
    ),
  )
}

/**
 * Migración del módulo de tareas: traduce los estados históricos a los cuatro
 * estados vigentes y garantiza los almacenes de trazabilidad.
 */
function migrarTareas(s: OpsState): OpsState {
  const cadenas = new Map<string, string>()
  // Reconstruye las cadenas existentes a partir de los enlaces bloqueadaPor/desbloquea.
  const raices = s.tareas.filter((t) => t.desbloquea && !t.bloqueadaPor)
  raices.forEach((raiz, i) => {
    const cadenaId = raiz.cadenaId ?? `CAD-${i + 1}`
    let actual: TareaOp | undefined = raiz
    let orden = 1
    const vistos = new Set<string>()
    while (actual && !vistos.has(actual.id)) {
      vistos.add(actual.id)
      cadenas.set(actual.id, `${cadenaId}#${orden}`)
      const siguiente: string | undefined = actual.desbloquea
      actual = siguiente ? s.tareas.find((x) => x.id === siguiente) : undefined
      orden += 1
    }
  })

  const tareas = s.tareas.map((t) => {
    const marca = cadenas.get(t.id)
    const [cadenaId, orden] = marca ? marca.split('#') : [undefined, undefined]
    // Las antiguas «indicaciones» pasan a ser el primer mensaje de la
    // conversación. La marca evita duplicarlas en sucesivas cargas.
    const conversacionPrevia = t.conversacion ?? []
    const indicacion = t.descripcion?.trim()
    const yaEsta =
      t.indicacionMigrada || conversacionPrevia.some((m) => m.indicacionInicial) || !indicacion
    const conversacion = yaEsta
      ? conversacionPrevia
      : [
          {
            id: `${t.id}-IND`,
            fecha: t.creadoEn || t.fechaInicio || '',
            hora: '',
            autor: t.creador ?? t.supervisor ?? t.responsable,
            texto: indicacion,
            clase: 'mensaje' as const,
            indicacionInicial: true,
          },
          ...conversacionPrevia,
        ]
    return {
      ...t,
      estado: ESTADO_TAREA_LEGADO[t.estado as string] ?? 'En curso',
      creador: t.creador ?? t.supervisor ?? t.responsable,
      creadoEn: t.creadoEn ?? t.fechaInicio ?? '',
      fechaEnvio: t.fechaEnvio ?? t.creadoEn ?? t.fechaInicio ?? '',
      horaLimite: t.horaLimite ?? (t.vencimiento ? '18:00' : ''),
      conversacion,
      indicacionMigrada: true,
      evidencias: t.evidencias ?? [],
      // El justificante documental se desarrollará con el gestor de documentos.
      evidenciaObligatoria: false,
      documentosVinculados: t.documentosVinculados ?? t.documentos ?? [],
      reclamaciones: t.reclamaciones ?? [],
      recordatorios: t.recordatorios ?? [],
      historico: t.historico ?? [],
      ...(cadenaId ? { cadenaId, ordenCadena: Number(orden) } : {}),
    } satisfies TareaOp
  })
  return { ...s, tareas, notificaciones: s.notificaciones ?? [] }
}

/**
 * Segunda migración de líneas: campos de la revisión de usabilidad
 * (responsable heredado, criterio de finalización, colaboradores de contactos)
 * y alta del almacén de recordatorios. No borra ni sustituye nada existente.
 */
function migrarLineasFlexibles(s: OpsState): OpsState {
  const expedientePorId = new Map(s.expedientes.map((e) => [e.id, e]))
  const lineas = s.lineas.map((l) => {
    if (typeof l.responsableHeredado === 'boolean' && 'criterioFinalizacion' in l) return l
    const exp = expedientePorId.get(l.expedienteId)
    return {
      ...l,
      responsableHeredado:
        l.responsableHeredado ??
        Boolean(exp && exp.responsable && exp.responsable === l.responsable),
      criterioFinalizacion: l.criterioFinalizacion ?? l.indicador ?? '',
      colaboradoresContactos: l.colaboradoresContactos ?? [],
    } satisfies LineaTrabajo
  })
  return { ...s, lineas, recordatorios: s.recordatorios ?? [] }
}

/**
 * Unificación del módulo TAREAS (revisión profunda):
 * - la checklist plana pasa a `subtareas` con autoría y orden manual;
 * - se fija un orden manual inicial por columna del tablero;
 * - los documentos adoptan el flujo mínimo de cuatro estados y la relación
 *   bidireccional con las tareas que los trabajan.
 * Idempotente: no borra datos ni reescribe lo ya migrado.
 */
function unificarTareas(s: OpsState): OpsState {
  const porColumna = new Map<string, number>()
  const tareas = s.tareas.map((t) => {
    const subtareas: Subtarea[] =
      t.subtareas ??
      (t.checklist ?? []).map((c, i) => ({
        id: `${t.id}-ST${i + 1}`,
        texto: c.texto,
        hecho: c.hecho,
        autor: t.creador ?? t.responsable,
        fecha: t.creadoEn || t.fechaInicio || hoyTexto(),
        orden: i + 1,
      }))
    const n = (porColumna.get(t.estado) ?? 0) + 1
    porColumna.set(t.estado, n)
    const limpia = { ...t } as TareaOp & { tipo?: unknown }
    delete limpia.tipo
    return {
      ...limpia,
      subtareas,
      ordenTablero: t.ordenTablero ?? n,
      prioridad: t.prioridad ?? 'Media',
      documentosVinculados: t.documentosVinculados ?? t.documentos ?? [],
    } satisfies TareaOp
  })

  const activasPorDoc = new Map<string, string[]>()
  for (const t of tareas)
    for (const d of t.documentosVinculados ?? [])
      activasPorDoc.set(d, [...(activasPorDoc.get(d) ?? []), t.id])

  const documentos = s.documentos.map((d) => {
    const vinculadas = activasPorDoc.get(d.id) ?? d.tareasVinculadas ?? []
    const hayActiva = vinculadas.some((id) => {
      const t = tareas.find((x) => x.id === id)
      return t ? ESTADOS_TAREA_VIVOS.includes(t.estado) : false
    })
    const simple = ESTADO_DOC_LEGADO[d.estado] ?? (d.estado as EstadoDocSimple)
    return {
      ...d,
      estado: hayActiva && simple !== 'Archivado / solo consulta' ? 'En tratamiento' : simple,
      tareasVinculadas: vinculadas,
    }
  })

  return { ...s, tareas, documentos }
}

if (isBrowser && !hidratado) {
  hidratado = true
  estado = sembrarComunicaciones(
    unificarTareas(
      sembrarEtiquetasTareas(
        migrarEtiquetas(
          migrarTareas(
            migrarLineasFlexibles(
              migrarLineas(migrarActuaciones(migrarCodigos(migrarFases(leerAlmacen())))),
            ),
          ),
        ),
      ),
    ),
  )

  persistir()
}

export function useOps<T>(selector: (s: OpsState) => T): T {
  const snap = useSyncExternalStore(
    subscribe,
    () => estado,
    () => semillaBase,
  )
  return selector(snap)
}

export const getOps = () => estado

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const hora = () => new Date().toTimeString().slice(0, 5)
const ahora = () => `${hoyTexto()} ${hora()}`

function nuevoId(prefijo: string) {
  const n = (estado.secuencias[prefijo] ?? 100) + 1
  estado = { ...estado, secuencias: { ...estado.secuencias, [prefijo]: n } }
  return `${prefijo}-${String(n).padStart(4, '0')}`
}

/** Siguiente número correlativo AP_N. Nunca reutiliza números ya asignados. */
function siguienteNumeroAp() {
  const maximo = Math.max(
    estado.secuencias['AP'] ?? 0,
    ...estado.expedientes.map((e) => e.numeroAp ?? 0),
  )
  const n = maximo + 1
  estado = { ...estado, secuencias: { ...estado.secuencias, AP: n } }
  return n
}

function auditar(item: Omit<AuditoriaItem, 'id' | 'fecha' | 'usuario'>) {
  set((s) => ({
    ...s,
    auditoria: [
      { id: `AU-${s.auditoria.length + 1}`, fecha: ahora(), usuario: s.usuario, ...item },
      ...s.auditoria,
    ],
  }))
}

export const diasDesde = (v: string | undefined) => {
  const d = parseFecha(v)
  if (!d) return null
  return Math.round((HOY.getTime() - d.getTime()) / 86400000)
}

export const diasHasta = (v: string | undefined) => {
  const d = parseFecha(v)
  if (!d) return null
  return Math.round((d.getTime() - HOY.getTime()) / 86400000)
}

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */

export const selLineas = (s: OpsState, expedienteId: string) =>
  s.lineas
    .filter((l) => l.expedienteId === expedienteId)
    .slice()
    .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))

/** Línea principal y sus sublíneas (jerarquía máxima de dos niveles). */
export const selArbolLineas = (s: OpsState, expedienteId: string) => {
  const todas = selLineas(s, expedienteId)
  const raiz = todas.filter((l) => !l.parentId)
  return raiz.map((l) => ({ linea: l, hijas: todas.filter((h) => h.parentId === l.id) }))
}

const enLinea = (lineaId: string, e: { lineaId?: string; lineasRelacionadas?: string[] }) =>
  e.lineaId === lineaId || (e.lineasRelacionadas ?? []).includes(lineaId)

/** Elementos vinculados a una línea. No se duplican: sólo se relacionan. */
export const vinculadosDeLinea = (s: OpsState, lineaId: string) => {
  const actividades = s.actuaciones.filter((a) => enLinea(lineaId, a)).sort(compararActuaciones)
  return {
    actividades,
    actuaciones: actividades.filter((a) => a.esActuacion !== false && esActuacionValida(a)),
    hitos: actividades.filter((a) => a.esHito),
    tareas: s.tareas.filter((t) => enLinea(lineaId, t)),
    documentos: s.documentos.filter((d) => enLinea(lineaId, d)),
    fechas: s.fechas.filter((f) => enLinea(lineaId, f)),
    comunicaciones: s.comunicaciones.filter((c) => enLinea(lineaId, c)),
    ejecuciones: s.ejecuciones.filter((e) => e.lineaId === lineaId),
  }
}

/* --------------------------- Recordatorios ------------------------- */

/** Recordatorios de un expediente (todos los estados). */
export const selRecordatorios = (s: OpsState, expedienteId: string) =>
  (s.recordatorios ?? []).filter((r) => r.expedienteId === expedienteId)

/** Recordatorios de una línea, ordenados por fecha ascendente. */
export const recordatoriosDeLinea = (s: OpsState, lineaId: string) =>
  (s.recordatorios ?? [])
    .filter((r) => r.lineaId === lineaId)
    .slice()
    .sort((a, b) => (parseFecha(a.fecha)?.getTime() ?? 0) - (parseFecha(b.fecha)?.getTime() ?? 0))

/** Próximo recordatorio pendiente de una línea. */
export const proximoRecordatorio = (s: OpsState, lineaId: string) =>
  recordatoriosDeLinea(s, lineaId).find((r) => r.estado === 'Pendiente' || r.estado === 'Aplazado')

/**
 * Responsable efectivo de la línea: por defecto el del expediente. Sólo se usa
 * el responsable propio cuando se ha asignado expresamente.
 */
export function responsableEfectivoLinea(s: OpsState, l: LineaTrabajo) {
  const exp = s.expedientes.find((e) => e.id === l.expedienteId)
  if (l.responsableHeredado === false && l.responsable)
    return { nombre: l.responsable, heredado: false }
  return { nombre: exp?.responsable || l.responsable || '—', heredado: true }
}

export type AlertaLinea = { id: string; tono: 'aviso' | 'riesgo' | 'info'; texto: string }

/**
 * Alertas de una línea. Sólo se avisa de situaciones reales: plazos, tareas
 * vencidas, recordatorios vencidos, bloqueos e inactividad prolongada. La
 * falta de datos opcionales nunca genera alerta.
 */
export function alertasDeLinea(s: OpsState, l: LineaTrabajo): AlertaLinea[] {
  const av: AlertaLinea[] = []
  const v = vinculadosDeLinea(s, l.id)
  const abierta = l.estado !== 'Cerrada' && l.estado !== 'Descartada'
  const tareasAbiertas = v.tareas.filter(
    (t) => t.estado !== 'Completada' && t.estado !== 'Cancelada',
  )
  const vencidas = tareasAbiertas.filter((t) => (diasHasta(t.vencimiento) ?? 99) < 0)
  const plazoProximo = v.fechas.find((f) => {
    const dh = diasHasta(f.fecha)
    return dh !== null && dh >= 0 && dh <= 7
  })
  const recordatorioVencido = recordatoriosDeLinea(s, l.id).find(
    (r) => (r.estado === 'Pendiente' || r.estado === 'Aplazado') && (diasHasta(r.fecha) ?? 1) < 0,
  )
  if (vencidas.length)
    av.push({
      id: 'tarea-vencida',
      tono: 'riesgo',
      texto: `Existe ${vencidas.length === 1 ? 'una tarea vencida' : `${vencidas.length} tareas vencidas`}.`,
    })
  if (plazoProximo)
    av.push({
      id: 'plazo',
      tono: 'aviso',
      texto: `Plazo próximo: ${plazoProximo.titulo} (${plazoProximo.fecha}).`,
    })
  if (abierta && recordatorioVencido)
    av.push({
      id: 'recordatorio',
      tono: 'aviso',
      texto: `Recordatorio vencido: ${recordatorioVencido.texto}`,
    })
  const dias = diasDesde(l.fechaUltimoAvance ?? l.fechaInicio)
  if (abierta && l.estado === 'En curso' && dias !== null && dias >= 30)
    av.push({ id: 'inactiva', tono: 'aviso', texto: `Sin movimiento desde hace ${dias} días.` })

  if (abierta && l.fechaObjetivo && (diasHasta(l.fechaObjetivo) ?? 1) < 0)
    av.push({
      id: 'objetivo',
      tono: 'riesgo',
      texto: `Fecha objetivo superada (${l.fechaObjetivo}).`,
    })
  if (abierta && l.bloqueo)
    av.push({ id: 'bloqueo', tono: 'riesgo', texto: `Bloqueada: ${l.bloqueo}` })
  if (
    abierta &&
    l.situacion === 'Depende de tercero' &&
    l.fechaSeguimiento &&
    (diasHasta(l.fechaSeguimiento) ?? 1) < 0
  )
    av.push({
      id: 'tercero',
      tono: 'aviso',
      texto: 'Pendiente de respuesta de tercero; fecha de seguimiento vencida.',
    })
  if (
    l.estado === 'Resuelta' &&
    (tareasAbiertas.length || v.fechas.some((f) => (diasHasta(f.fecha) ?? -1) >= 0))
  )
    av.push({
      id: 'resuelta-pendiente',
      tono: 'aviso',
      texto: `Objetivo alcanzado, pero quedan ${tareasAbiertas.length} tarea(s) abiertas o plazos vivos.`,
    })
  return av
}
export const selEjecuciones = (s: OpsState, expedienteId: string) =>
  s.ejecuciones.filter((e) => e.expedienteId === expedienteId)

/* ---------------------- Regla única de cronología ------------------ */

/**
 * Marca temporal efectiva de una actuación: fecha efectiva + hora efectiva.
 * No utiliza la fecha de creación del registro: sólo sirve de desempate.
 * Se calcula en horario local para que la conversión UTC no desplace el día.
 */
export function marcaActuacion(a: Actuacion): number {
  const d = parseFecha(a.fecha)
  if (!d) return Number.NEGATIVE_INFINITY
  const m = /^(\d{1,2}):(\d{2})/.exec((a.hora ?? '').trim())
  const minutos = m ? Number(m[1]) * 60 + Number(m[2]) : 0
  return d.getTime() + minutos * 60000
}

/** Una actuación cancelada no cuenta como actuación válida del expediente. */
export const esActuacionValida = (a: Actuacion) => a.estado !== 'Cancelada'

/**
 * Orden cronológico inverso: fecha efectiva, hora efectiva y, sólo como
 * desempate estable, el identificador correlativo.
 */
export function compararActuaciones(a: Actuacion, b: Actuacion) {
  const d = marcaActuacion(b) - marcaActuacion(a)
  if (d !== 0) return d
  return b.id.localeCompare(a.id)
}

/** Todas las actuaciones del expediente, siempre en orden cronológico inverso. */
export const selActuaciones = (s: OpsState, expedienteId: string) =>
  s.actuaciones.filter((a) => a.expedienteId === expedienteId).sort(compararActuaciones)

/** Actuaciones válidas (excluye canceladas), en orden cronológico inverso. */
export const selActuacionesValidas = (s: OpsState, expedienteId: string) =>
  selActuaciones(s, expedienteId).filter(esActuacionValida)

/**
 * Única fuente de verdad de "la última actuación" del expediente: se usa en
 * la situación de cabecera, el último movimiento, las últimas actuaciones,
 * el cálculo de inactividad y la detección de cambios del Resumen IA.
 */
export const selUltimaActuacion = (s: OpsState, expedienteId: string): Actuacion | undefined =>
  selActuacionesValidas(s, expedienteId)[0]

export const selDocumentos = (s: OpsState, expedienteId: string) =>
  s.documentos.filter((d) => d.expedienteId === expedienteId)

/**
 * INBOX personal: tareas capturadas por una persona, agrupadas por etapa de
 * procesamiento. La etapa no es un estado de la tarea.
 */
export const selInbox = (s: OpsState, usuario: string) => {
  const propias = s.tareas.filter((t) => t.capturada && (t.inboxDe ?? t.responsable) === usuario)
  return ETAPAS_INBOX.map((etapa) => ({
    etapa,
    tareas: propias
      .filter((t) => (t.etapaInbox ?? 'Bandeja de entrada') === etapa)
      .slice()
      .sort((a, b) => (a.ordenInbox ?? 999) - (b.ordenInbox ?? 999)),
  }))
}

/** Tareas vivas vinculadas a un documento. */
export const selTareasDeDocumento = (s: OpsState, documentoId: string) =>
  s.tareas.filter((t) => (t.documentosVinculados ?? []).includes(documentoId))

/**
 * Señales visuales de una tarea: vencimiento, falta de acuse de recibo,
 * bloqueo por cadena y reclamaciones abiertas.
 */
export type SenalesTarea = {
  vencida: boolean
  hoy: boolean
  proxima: boolean
  sinAbrir: boolean
  bloqueada: boolean
  reclamada: boolean
  rechazada: boolean
  diferidaVencida: boolean
  enCadena: boolean
  conRecordatorio: boolean
  delegada: boolean
  /** Señal operativa: se espera respuesta externa a un email relacionado. */
  esperandoRespuesta: boolean
  /** Emails relacionados ya enviados (no cuenta borradores). */
  emailsEnviados: number
  /** Posición en la cadena, ya calculada: "2/3". */
  posicionCadena?: string
}

export const senalesTarea = (s: OpsState, t: TareaOp): SenalesTarea => {
  const dias = diasHasta(t.vencimiento)
  const abierta = ESTADOS_TAREA_VIVOS.includes(t.estado)
  const previa = t.bloqueadaPor ? s.tareas.find((x) => x.id === t.bloqueadaPor) : undefined
  const dif = diasHasta(t.diferidaHasta)
  const cadena = t.cadenaId ? s.tareas.filter((x) => x.cadenaId === t.cadenaId) : []
  return {
    vencida: abierta && dias !== null && dias < 0,
    hoy: abierta && dias === 0,
    proxima: abierta && dias !== null && dias > 0 && dias <= 3,
    sinAbrir: abierta && !t.primeraApertura && t.responsable !== t.creador,
    bloqueada: Boolean(previa && previa.estado !== 'Completada' && previa.estado !== 'Cancelada'),
    reclamada: abierta && Boolean(t.reclamaciones?.length),
    rechazada: Boolean(t.rechazo && !t.rechazo.resuelto),
    diferidaVencida: t.estado === 'En espera' && dif !== null && dif < 0,
    enCadena: cadena.length > 1,
    conRecordatorio: recordatoriosDeTarea(s, t.id).length > 0,
    delegada: Boolean(t.creador && t.creador !== t.responsable),
    esperandoRespuesta: abierta && Boolean(t.esperandoRespuesta),
    emailsEnviados: s.comunicaciones.filter(
      (c) => c.tareaId === t.id && c.estadoEnvio === 'Enviado',
    ).length,
    ...(cadena.length > 1 && t.ordenCadena
      ? { posicionCadena: `${t.ordenCadena}/${cadena.length}` }
      : {}),
  }
}

/* ------------------------- SIGUIENTE ACCIÓN ------------------------ */

/**
 * SIGUIENTE ACCIÓN es un atributo de una tarea real, no un estado ni un
 * objeto paralelo. La unicidad es POR CONTEXTO: un Lead, un Onboarding, un
 * Expediente y cada Línea de trabajo pueden tener la suya.
 */
export type ContextoSA = { tipo: OrigenRelacion['tipo']; id: string; label?: string }

export const claveContexto = (c: ContextoSA) => `${c.tipo}:${c.id}`

/**
 * Contexto al que pertenece una tarea. Prioridad: línea de trabajo, origen
 * explícito (Lead, Onboarding, Presupuesto…) y, en último lugar, expediente.
 * Preparado para nuevos contextos sin tocar la UI.
 */
export const contextoDeTarea = (t: TareaOp): ContextoSA | null => {
  if (t.lineaId) return { tipo: 'Línea', id: t.lineaId }
  if (t.origen && t.origen.tipo !== 'Tarea' && t.origen.tipo !== 'Expediente')
    return { tipo: t.origen.tipo, id: t.origen.id, label: t.origen.label }
  if (t.expedienteId) return { tipo: 'Expediente', id: t.expedienteId }
  return null
}

const tareaViva = (t: TareaOp) => ESTADOS_TAREA_VIVOS.includes(t.estado)

/** Tarea marcada como Siguiente acción de un contexto (si existe y sigue viva). */
export const siguienteAccionDe = (s: OpsState, contexto: ContextoSA): TareaOp | undefined =>
  s.tareas.find((t) => {
    if (!t.esSiguienteAccion || !tareaViva(t)) return false
    const c = contextoDeTarea(t)
    return c ? claveContexto(c) === claveContexto(contexto) : false
  })

/** Un contexto activo sin Siguiente acción está en situación crítica. */
export const sinSiguienteAccion = (s: OpsState, contexto: ContextoSA) =>
  !siguienteAccionDe(s, contexto)

/** Fases de una cadena, ordenadas. */
export const selCadena = (s: OpsState, t: TareaOp): TareaOp[] =>
  t.cadenaId
    ? s.tareas
        .filter((x) => x.cadenaId === t.cadenaId)
        .slice()
        .sort((a, b) => (a.ordenCadena ?? 0) - (b.ordenCadena ?? 0))
    : [t]

/**
 * Recordatorios de una tarea: viven en "Fechas y plazos" (FechaCritica con
 * tipo Recordatorio y origen Tarea). No existe un segundo sistema paralelo.
 */
export const recordatoriosDeTarea = (s: OpsState, tareaId: string) =>
  s.fechas.filter((f) => f.origen?.tipo === 'Tarea' && f.origen.id === tareaId)

/* --------------------------- Notificaciones ------------------------ */

export const selNotificaciones = (s: OpsState) =>
  (s.notificaciones ?? []).filter((n) => n.usuario === s.usuario)

/** Avisos de vencimiento calculados en vivo: nunca se duplican en el almacén. */
export const avisosVencimiento = (s: OpsState) => {
  const avisos: { id: string; texto: string; tareaId: string; creador: boolean }[] = []
  for (const t of s.tareas) {
    if (!ESTADOS_TAREA_VIVOS.includes(t.estado)) continue
    const dias = diasHasta(t.vencimiento)
    if (dias === null || dias >= 0) continue
    if (t.responsable === s.usuario)
      avisos.push({
        id: `venc-resp-${t.id}`,
        texto: `La tarea «${t.titulo}» ha vencido y continúa pendiente.`,
        tareaId: t.id,
        creador: false,
      })
    if ((t.creador ?? '') === s.usuario && t.responsable !== s.usuario)
      avisos.push({
        id: `venc-crea-${t.id}`,
        texto: `Ha vencido la tarea «${t.titulo}», asignada a ${t.responsable}, y todavía no ha sido completada.`,
        tareaId: t.id,
        creador: true,
      })
  }
  return avisos
}

/** ¿El usuario conectado puede modificar el encargo (creador o supervisor)? */
/* ----------------------------- Etiquetas -------------------------- */

/** Catálogo vigente (sin archivadas ni fusionadas), por orden alfabético. */
export const etiquetasActivas = (s: OpsState) =>
  (s.etiquetas ?? [])
    .filter((e) => !e.archivada && !e.fusionadaEn)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

export const etiquetaPorId = (s: OpsState, id: string) =>
  (s.etiquetas ?? []).find((e) => e.id === id)

/** Etiquetas de una tarea, resueltas contra el catálogo (incluidas archivadas). */
export const etiquetasDeTarea = (s: OpsState, t: TareaOp): EtiquetaTarea[] =>
  (t.etiquetas ?? [])
    .map((id) => etiquetaPorId(s, id))
    .filter((e): e is EtiquetaTarea => Boolean(e))

/** Nº de tareas que usan una etiqueta. */
export const usoEtiqueta = (s: OpsState, id: string) =>
  s.tareas.filter((t) => (t.etiquetas ?? []).includes(id)).length

/**
 * Crear etiquetas nuevas y gestionar el catálogo queda reservado a los
 * perfiles con mando; el resto sólo puede aplicar las existentes.
 */
export const puedeGestionarEtiquetas = (s: OpsState) => {
  const rol = USUARIOS.find((u) => u.nombre === s.usuario)?.rol
  return rol === 'Administrador' || rol === 'Abogado responsable'
}

/** ¿Puede el usuario etiquetar esta tarea? Creador, responsable o colaborador. */
export const puedeEtiquetarTarea = (s: OpsState, t: TareaOp) =>
  puedeGestionarEtiquetas(s) ||
  s.usuario === (t.creador ?? t.responsable) ||
  s.usuario === t.responsable ||
  s.usuario === t.supervisor ||
  (t.colaboradores ?? []).includes(s.usuario)

export const puedeEditarEncargo = (s: OpsState, t: TareaOp) =>
  s.usuario === (t.creador ?? t.responsable) || s.usuario === t.supervisor

/**
 * ¿Puede el usuario conectado redactar y enviar comunicaciones relacionadas
 * con este encargo? Creador, responsable, supervisor o colaborador. Se
 * comprueba también en la capa de datos, no sólo ocultando el botón.
 */
export const puedeRedactarEmail = (s: OpsState, t: TareaOp) =>
  s.usuario === (t.creador ?? t.responsable) ||
  s.usuario === t.responsable ||
  s.usuario === t.supervisor ||
  (t.colaboradores ?? []).includes(s.usuario)

/** Comunicaciones (emails) vinculadas a una tarea. Mismo registro del módulo. */
export const comunicacionesDeTarea = (s: OpsState, tareaId: string) =>
  s.comunicaciones.filter((c) => c.tareaId === tareaId)

export const selTareasTodas = (s: OpsState) => s.tareas

export const selTareas = (s: OpsState, expedienteId: string) =>
  s.tareas.filter((t) => t.expedienteId === expedienteId)
export const selFechas = (s: OpsState, expedienteId: string) =>
  s.fechas.filter((f) => f.expedienteId === expedienteId)
/** Repositorio temporal completo (FECHAS Y PLAZOS). Fuente única. */
export const selRegistrosTemporales = (s: OpsState) => s.fechas
/** Recordatorios asociados a otro registro temporal. */
export const recordatoriosDeRegistro = (s: OpsState, padreId: string) =>
  s.fechas.filter((f) => f.padreId === padreId)
export const selComunicaciones = (s: OpsState, expedienteId: string) =>
  s.comunicaciones.filter(
    (c) =>
      c.expedienteId === expedienteId || (c.expedientesRelacionados ?? []).includes(expedienteId),
  )

/* --------------------- COMUNICACIONES (transversal) ---------------- */

/** Orden cronológico descendente (lo más reciente primero). */
export const ordenCronologico = (a: Comunicacion, b: Comunicacion) => {
  const fa = parseFecha(a.fecha)?.getTime() ?? 0
  const fb = parseFecha(b.fecha)?.getTime() ?? 0
  if (fa !== fb) return fb - fa
  return (b.hora ?? '').localeCompare(a.hora ?? '')
}

/** Cronología completa del despacho. */
export const selCronologia = (s: OpsState) => s.comunicaciones.slice().sort(ordenCronologico)

/** Todas las comunicaciones de un contacto, tenga o no contexto concreto. */
export const comunicacionesDeContacto = (s: OpsState, contactoId: string) =>
  s.comunicaciones.filter((c) => c.contactoId === contactoId).sort(ordenCronologico)

export const comunicacionesDeLead = (s: OpsState, leadId: string) =>
  s.comunicaciones.filter((c) => c.leadId === leadId).sort(ordenCronologico)

export const comunicacionesDeOnboarding = (s: OpsState, onboardingId: string) =>
  s.comunicaciones.filter((c) => c.onboardingId === onboardingId).sort(ordenCronologico)

export const comunicacionesDeExpediente = (s: OpsState, expedienteId: string) =>
  selComunicaciones(s, expedienteId).slice().sort(ordenCronologico)

/**
 * Propuesta de vinculación semiautomática. No hay IA: se propone el único
 * expediente abierto del contacto y, si hay varios, se ofrecen todos para
 * elegir. Si todos están cerrados, la comunicación queda en la ficha.
 */
export function propuestaVinculacion(s: OpsState, contactoId?: string) {
  if (!contactoId) return { propuesto: undefined, abiertos: [], cerrados: [] }
  const suyos = s.expedientes.filter((e) =>
    s.intervinientes.some((i) => i.expedienteId === e.id && i.contactoId === contactoId),
  )
  const cerrado = (e: ExpedienteOp) =>
    (e.estadoGeneral ?? '').toLowerCase().includes('cerr') ||
    (e.estadoGeneral ?? '').toLowerCase().includes('archiv')
  const abiertos = suyos.filter((e) => !cerrado(e))
  const cerrados = suyos.filter(cerrado)
  return {
    propuesto: abiertos.length === 1 ? abiertos[0] : undefined,
    abiertos,
    cerrados,
  }
}

export const selIntervinientes = (s: OpsState, expedienteId: string) =>
  s.intervinientes.filter((i) => i.expedienteId === expedienteId)
export const selAuditoria = (s: OpsState, expedienteId: string) =>
  s.auditoria.filter((a) => a.expedienteId === expedienteId)

export const bandejaSinAsignar = (s: OpsState) => s.documentos.filter((d) => !d.expedienteId)

/* ------------------------------------------------------------------ */
/* Motor de alertas                                                    */
/* ------------------------------------------------------------------ */

export type Alerta = {
  id: string
  texto: string
  nivel: 'riesgo' | 'aviso'
  expedienteId: string
  entidad: string
  entidadId: string
  /** Causa + tipo + acción requerida. Sólo se agrupan alertas con la misma clave. */
  clave: string
  /** Prioridad de presentación: 0 vencida/crítica, 1 urgente, 2 requiere acción, 3 informativa. */
  orden: 0 | 1 | 2 | 3
}

export function alertasDeExpediente(s: OpsState, e: ExpedienteOp): Alerta[] {
  const a: Alerta[] = []
  const push = (
    texto: string,
    nivel: Alerta['nivel'],
    entidad: string,
    entidadId: string,
    clave: string,
    orden: Alerta['orden'],
  ) =>
    a.push({
      id: `${e.id}-${entidad}-${entidadId}-${a.length}`,
      texto,
      nivel,
      expedienteId: e.id,
      entidad,
      entidadId,
      clave,
      orden,
    })

  // Documentos judiciales con posible plazo sin validar
  selDocumentos(s, e.id)
    .filter(
      (d) => d.judicial && d.datosJudiciales?.estadoPlazo === 'Posible plazo pendiente de validar',
    )
    .forEach((d) =>
      push(
        `Plazo sin validar: ${d.nombre}`,
        'riesgo',
        'Documento',
        d.id,
        'doc-plazo-sin-validar',
        0,
      ),
    )

  // Documentos recibidos sin clasificar
  selDocumentos(s, e.id)
    .filter((d) => esRecibido(d) && d.estado === 'Sin clasificar')
    .forEach((d) =>
      push(
        `Documento recibido sin clasificar`,
        'aviso',
        'Documento',
        d.id,
        'doc-sin-clasificar',
        2,
      ),
    )

  // Documentos judiciales presentados sin justificante
  selDocumentos(s, e.id)
    .filter(
      (d) => d.judicial && d.datosJudiciales?.fechaPresentacion && !d.datosJudiciales.justificante,
    )
    .forEach((d) =>
      push(
        `Presentación sin justificante: ${d.nombre}`,
        'aviso',
        'Documento',
        d.id,
        'doc-sin-justificante',
        2,
      ),
    )

  // Fechas críticas sin validar / vencidas
  selFechas(s, e.id).forEach((f) => {
    if (!f.validada)
      push(`Fecha sin validar: ${f.titulo}`, 'riesgo', 'Fecha', f.id, 'fecha-sin-validar', 1)
    const dh = diasHasta(f.fecha)
    if (dh !== null && dh < 0 && !f.resultado)
      push(`Fecha vencida sin resultado: ${f.titulo}`, 'riesgo', 'Fecha', f.id, 'fecha-vencida', 0)
    else if (dh !== null && dh >= 0 && dh <= 3)
      push(`Vencimiento próximo: ${f.titulo}`, 'aviso', 'Fecha', f.id, 'fecha-proxima', 1)
  })

  // Tareas vencidas
  selTareas(s, e.id)
    .filter((t) => t.estado !== 'Completada' && t.estado !== 'Cancelada')
    .forEach((t) => {
      const dh = diasHasta(t.vencimiento)
      if (dh !== null && dh < 0)
        push(`Tarea vencida: ${t.titulo}`, 'riesgo', 'Tarea', t.id, 'tarea-vencida', 0)
    })

  // Actuaciones pendientes de reportar al cliente
  selActuacionesValidas(s, e.id)
    .filter(
      (x) =>
        x.estado === 'Pendiente de reportar' ||
        (x.visibleCliente && !x.clienteInformado && x.estado === 'Completada'),
    )
    .forEach((x) =>
      push(
        `Pendiente de reportar al cliente: ${x.titulo}`,
        'aviso',
        'Actuación',
        x.id,
        'act-sin-reportar',
        2,
      ),
    )

  // Sin actuación válida registrada en 15 días (regla única de última actuación)
  const ultimaActuacion = selUltimaActuacion(s, e.id)
  const dias = ultimaActuacion ? diasDesde(ultimaActuacion.fecha) : null
  if (!ultimaActuacion || (dias !== null && dias > 15))
    push(
      'Sin actuaciones registradas en más de 15 días',
      'aviso',
      'Expediente',
      e.id,
      'sin-actividad',
      3,
    )

  // Sin próxima acción definida
  if (!e.proximaAccion.trim())
    push('Sin próxima acción definida', 'riesgo', 'Expediente', e.id, 'sin-proxima-accion', 2)

  // Ejecuciones sin control ni presupuesto
  selEjecuciones(s, e.id).forEach((ej) => {
    if (!ej.proximoControl)
      push(
        `Ejecución sin próximo control: ${ej.titulo}`,
        'aviso',
        'Ejecución',
        ej.id,
        'eje-sin-control',
        2,
      )
    if (
      ej.situacionPresupuestaria === 'No incluida' ||
      ej.situacionPresupuestaria === 'Requiere nuevo presupuesto'
    )
      push(
        'Ejecución fuera de presupuesto',
        'riesgo',
        'Ejecución',
        ej.id,
        'eje-fuera-presupuesto',
        1,
      )
  })

  // Documentos entregables sin versión definitiva presentados
  selDocumentos(s, e.id)
    .filter(
      (d) =>
        d.entregable &&
        (d.estado === 'Presentado' || d.estado === 'Entregado') &&
        !tieneDefinitiva(d),
    )
    .forEach((d) =>
      push(
        `Entregable sin versión definitiva: ${d.nombre}`,
        'aviso',
        'Documento',
        d.id,
        'doc-sin-definitiva',
        2,
      ),
    )

  return a
}

/** Alerta agrupada: una sola línea por causa, con recuento y detalle desplegable. */
export type AlertaAgrupada = {
  clave: string
  nivel: Alerta['nivel']
  orden: Alerta['orden']
  texto: string
  total: number
  items: Alerta[]
}

const ENUNCIADO_GRUPO: Record<string, (n: number) => string> = {
  'doc-plazo-sin-validar': (n) => `${n} documentos judiciales con plazo sin validar`,
  'doc-sin-clasificar': (n) => `${n} documentos recibidos sin clasificar`,
  'doc-sin-justificante': (n) => `${n} presentaciones sin justificante`,
  'doc-sin-definitiva': (n) => `${n} entregables sin versión definitiva`,
  'fecha-sin-validar': (n) => `${n} fechas críticas sin validar`,
  'fecha-vencida': (n) => `${n} fechas vencidas sin resultado`,
  'fecha-proxima': (n) => `${n} vencimientos en los próximos 3 días`,
  'tarea-vencida': (n) => `${n} tareas vencidas`,
  'act-sin-reportar': (n) => `${n} actuaciones pendientes de reportar al cliente`,
  'eje-sin-control': (n) => `${n} ejecuciones sin próximo control`,
}

/**
 * Agrupa alertas repetidas de la misma causa en una sola línea y las ordena por
 * criticidad: vencidas, urgentes, requieren acción e informativas.
 */
export function agruparAlertas(alertas: Alerta[]): AlertaAgrupada[] {
  const mapa = new Map<string, AlertaAgrupada>()
  alertas.forEach((al) => {
    const g = mapa.get(al.clave)
    if (g) {
      g.items.push(al)
      g.total += 1
      if (al.nivel === 'riesgo') g.nivel = 'riesgo'
      if (al.orden < g.orden) g.orden = al.orden
    } else {
      mapa.set(al.clave, {
        clave: al.clave,
        nivel: al.nivel,
        orden: al.orden,
        texto: al.texto,
        total: 1,
        items: [al],
      })
    }
  })
  return Array.from(mapa.values())
    .map((g) => ({
      ...g,
      texto:
        g.total > 1
          ? (ENUNCIADO_GRUPO[g.clave]?.(g.total) ?? `${g.texto} (+${g.total - 1})`)
          : g.texto,
    }))
    .sort((x, y) => x.orden - y.orden || y.total - x.total)
}

export function alertasGlobales(s: OpsState): Alerta[] {
  const de = s.expedientes.flatMap((e) => alertasDeExpediente(s, e))
  const bandeja = bandejaSinAsignar(s).map<Alerta>((d) => ({
    id: `bandeja-${d.id}`,
    texto: `Documento sin expediente asignado: ${d.nombre}`,
    nivel: 'riesgo',
    expedienteId: '',
    entidad: 'Documento',
    entidadId: d.id,
    clave: 'doc-sin-expediente',
    orden: 1,
  }))
  return [...bandeja, ...de]
}

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

function mapExp(id: string, fn: (e: ExpedienteOp) => ExpedienteOp) {
  set((s) => ({ ...s, expedientes: s.expedientes.map((e) => (e.id === id ? fn(e) : e)) }))
}

export const ops = {
  usuarioActual() {
    return estado.usuario
  },

  setUsuario(usuario: string) {
    set((s) => ({ ...s, usuario }))
  },

  /* ---------------------------- Expediente ------------------------- */

  crearExpediente(
    data: Partial<ExpedienteOp> & { nombre: string; contactoId: string; naturaleza: Naturaleza },
  ) {
    const id = nuevoId('EX')
    const numeroAp = siguienteNumeroAp()
    const e: ExpedienteOp = {
      id,
      numeroAp,
      codigo: `AP_${numeroAp}`,

      nombre: data.nombre,
      contactoId: data.contactoId,
      otrosClientes: [],
      responsable: data.responsable ?? estado.usuario,
      equipo: data.equipo ?? [data.responsable ?? estado.usuario],
      area: data.area ?? 'Civil patrimonial',
      tipoAsunto: data.tipoAsunto ?? 'Por determinar',
      naturaleza: data.naturaleza,
      estadoGeneral: 'Activo',
      fase: data.fase ?? 'diagnostico',
      estadoOperativo: 'En curso',
      dondeEstamos: data.dondeEstamos ?? 'Expediente recién abierto.',
      proximaAccion: data.proximaAccion ?? '',
      dependencia: data.dependencia ?? 'Debemos actuar nosotros',
      prioridad: data.prioridad ?? 'Media',
      carga: 'Media',
      fechaApertura: hoyTexto(),
      ultimoMovimiento: hoyTexto(),
      tiempoRegistrado: 0,
      ...(data.presupuestoId ? { presupuestoId: data.presupuestoId } : {}),
      ...(data.oportunidadId ? { oportunidadId: data.oportunidadId } : {}),
    }
    set((s) => ({ ...s, expedientes: [e, ...s.expedientes] }))
    auditar({
      accion: 'Alta de expediente',
      entidad: 'Expediente',
      entidadId: id,
      expedienteId: id,
      anterior: '—',
      nuevo: e.nombre,
    })
    return e
  },

  actualizarExpediente(id: string, cambios: Partial<ExpedienteOp>) {
    mapExp(id, (e) => ({ ...e, ...cambios, ultimoMovimiento: hoyTexto() }))
    auditar({
      accion: 'Edición de expediente',
      entidad: 'Expediente',
      entidadId: id,
      expedienteId: id,
      anterior: '—',
      nuevo: Object.keys(cambios).join(', '),
    })
  },

  moverFase(id: string, fase: string) {
    const exp = estado.expedientes.find((e) => e.id === id)
    if (!exp) return { ok: false as const, motivo: 'Expediente no encontrado' }
    const valida = columnasDe(exp.naturaleza).some((c) => c.id === fase)
    if (!valida) return { ok: false as const, motivo: 'Fase no válida para esta naturaleza' }
    if (fase === 'finalizado') {
      const pendientes = [
        ...selTareas(estado, id)
          .filter((t) => t.estado !== 'Completada' && t.estado !== 'Cancelada')
          .map((t) => `Tarea: ${t.titulo}`),
        ...selFechas(estado, id)
          .filter((f) => !f.resultado && (diasHasta(f.fecha) ?? 0) >= 0)
          .map((f) => `Fecha: ${f.titulo}`),
        ...selEjecuciones(estado, id)
          .filter((e) => e.estado !== 'Cumplido' && e.estado !== 'Liquidación y cierre')
          .map((e) => `Ejecución: ${e.titulo}`),
      ]
      if (pendientes.length)
        return { ok: false as const, motivo: 'Existen elementos abiertos', pendientes }
    }
    const anterior = exp.fase
    const enCierre =
      fase === 'cierre-encargo' || fase === 'cierre-procedimiento' || fase === 'liquidacion'
    mapExp(id, (e) => {
      const { suspension, ...resto } = e
      const siguiente: ExpedienteOp = {
        ...resto,
        fase,
        estadoGeneral:
          fase === 'finalizado'
            ? 'Cerrado'
            : fase === 'aparcado'
              ? 'Aparcado'
              : enCierre
                ? 'Cierre pendiente'
                : 'Activo',
        ...(fase === 'finalizado' ? { fechaCierre: hoyTexto() } : {}),
        ultimoMovimiento: hoyTexto(),
      }
      if (fase === 'aparcado') {
        siguiente.suspension = suspension ?? {
          faseOrigen: anterior,
          megafaseOrigen: megafaseDe(e.naturaleza, anterior),
          fecha: hoyTexto(),
          motivo: 'Pendiente de indicar',
        }
      }
      return siguiente
    })

    auditar({
      accion: 'Cambio de fase',
      entidad: 'Expediente',
      entidadId: id,
      expedienteId: id,
      anterior,
      nuevo: fase,
    })
    return { ok: true as const }
  },

  /** Devuelve un expediente suspendido a su fase de procedencia. */
  reanudarExpediente(id: string) {
    const exp = estado.expedientes.find((e) => e.id === id)
    if (!exp?.suspension) return { ok: false as const, motivo: 'El expediente no está suspendido' }
    return ops.moverFase(id, faseVigente(exp.naturaleza, exp.suspension.faseOrigen))
  },

  /** Síntesis operativa editable. Nunca se sobrescribe automáticamente. */
  actualizarDondeEstamos(id: string, texto: string) {
    mapExp(id, (e) => ({
      ...e,
      dondeEstamos: texto,
      dondeEstamosMeta: { fecha: ahora(), autor: estado.usuario },
    }))
    auditar({
      accion: 'Cambio de «Dónde estamos»',
      entidad: 'Expediente',
      entidadId: id,
      expedienteId: id,
      anterior: '—',
      nuevo: texto.slice(0, 120),
    })
  },

  /** Próxima acción principal: única activa por expediente. */
  fijarProximaAccionPrincipal(id: string, opciones: { actuacionId?: string; texto?: string }) {
    const actuacion = opciones.actuacionId
      ? estado.actuaciones.find((a) => a.id === opciones.actuacionId)
      : undefined
    const texto = actuacion ? actuacion.titulo : (opciones.texto ?? '')
    mapExp(id, (e) => {
      const { proximaAccionActuacionId: _previo, ...resto } = e
      return {
        ...resto,
        proximaAccion: texto,
        ...(actuacion ? { proximaAccionActuacionId: actuacion.id } : {}),
      }
    })
    auditar({
      accion: 'Cambio de próxima acción principal',
      entidad: 'Expediente',
      entidadId: id,
      expedienteId: id,
      anterior: '—',
      nuevo: texto || 'Sin definir',
    })
  },

  /** Guarda el resumen IA generado. No modifica ningún otro dato operativo. */
  guardarResumenIA(id: string, datos: { texto: string; fuentes: FuenteIA[]; huella: string }) {
    const previo = estado.expedientes.find((e) => e.id === id)?.resumenIA
    const resumen: ResumenIA = {
      version: (previo?.version ?? 0) + 1,
      texto: datos.texto,
      fecha: ahora(),
      usuario: estado.usuario,
      fuentes: datos.fuentes,
      huella: datos.huella,
    }
    // No se toca `ultimoMovimiento`: el resumen no es actividad del expediente.
    set((s) => ({
      ...s,
      expedientes: s.expedientes.map((e) => (e.id === id ? { ...e, resumenIA: resumen } : e)),
    }))
    auditar({
      accion: previo ? 'Actualización del resumen IA' : 'Generación del resumen IA',
      entidad: 'Expediente',
      entidadId: id,
      expedienteId: id,
      anterior: previo ? `v${previo.version}` : '—',
      nuevo: `v${resumen.version} · ${resumen.fuentes.length} fuentes`,
    })
    return resumen
  },

  valorarResumenIA(id: string, valoracion: 'util' | 'incorrecto') {
    set((s) => ({
      ...s,
      expedientes: s.expedientes.map((e) =>
        e.id === id && e.resumenIA ? { ...e, resumenIA: { ...e.resumenIA, valoracion } } : e,
      ),
    }))
  },

  cambiarEstadoGeneral(id: string, estadoGeneral: EstadoGeneral) {
    mapExp(id, (e) => ({ ...e, estadoGeneral }))
    auditar({
      accion: 'Cambio de estado general',
      entidad: 'Expediente',
      entidadId: id,
      expedienteId: id,
      anterior: '—',
      nuevo: estadoGeneral,
    })
  },

  /* ------------------------------ Líneas --------------------------- */

  crearLinea(data: Omit<LineaTrabajo, 'id'>) {
    const id = nuevoId('LT')
    set((s) => ({ ...s, lineas: [...s.lineas, { ...data, id }] }))
    auditar({
      accion: 'Alta de línea de trabajo',
      entidad: 'Línea',
      entidadId: id,
      expedienteId: data.expedienteId,
      anterior: '—',
      nuevo: data.nombre,
    })
    return id
  },

  /** Edición con trazabilidad campo a campo (usuario, fecha, valor anterior y nuevo). */
  actualizarLinea(
    id: string,
    cambios: Partial<LineaTrabajo>,
    accion = 'Edición de línea de trabajo',
  ) {
    const prev = estado.lineas.find((l) => l.id === id)
    if (!prev) return
    set((s) => ({
      ...s,
      lineas: s.lineas.map((l) =>
        l.id === id ? { ...l, ...cambios, updatedAt: ahora(), updatedBy: s.usuario } : l,
      ),
    }))
    const trazables: (keyof LineaTrabajo)[] = [
      'nombre',
      'responsable',
      'estado',
      'situacion',
      'prioridad',
      'objetivo',
      'tesis',
      'decision',
      'bloqueo',
      'proximaAccion',
      'ultimoAvance',
      'parentId',
      'archivada',
    ]
    const tocados = trazables.filter(
      (k) => k in cambios && String(cambios[k] ?? '') !== String(prev[k] ?? ''),
    )
    if (!tocados.length) {
      auditar({
        accion,
        entidad: 'Línea',
        entidadId: id,
        expedienteId: prev.expedienteId,
        anterior: '—',
        nuevo: prev.nombre,
      })
      return
    }
    for (const k of tocados) {
      auditar({
        accion: `${accion} · ${String(k)}`,
        entidad: 'Línea',
        entidadId: id,
        expedienteId: prev.expedienteId,
        anterior: String(prev[k] ?? '—') || '—',
        nuevo: String(cambios[k] ?? '—') || '—',
      })
    }
  },

  /** Cambio de estado con las fechas de resolución y cierre asociadas. */
  cambiarEstadoLinea(id: string, nuevoEstado: EstadoLinea, motivo?: string) {
    const extra: Partial<LineaTrabajo> = { estado: nuevoEstado }
    if (nuevoEstado === 'Resuelta') extra.fechaResolucion = hoyTexto()
    if (nuevoEstado === 'Cerrada' || nuevoEstado === 'Descartada') extra.fechaCierre = hoyTexto()
    if (nuevoEstado !== 'Cerrada' && nuevoEstado !== 'Descartada')
      extra.fechaCierre = undefined as never
    if (motivo) extra.motivoCierre = motivo
    ops.actualizarLinea(id, extra, 'Cambio de estado de línea')
  },

  archivarLinea(id: string, archivada: boolean) {
    ops.actualizarLinea(id, { archivada }, archivada ? 'Archivo de línea' : 'Desarchivo de línea')
  },

  reordenarLineas(expedienteId: string, ids: string[]) {
    set((s) => ({
      ...s,
      lineas: s.lineas.map((l) =>
        l.expedienteId === expedienteId && ids.includes(l.id)
          ? { ...l, orden: ids.indexOf(l.id) + 1 }
          : l,
      ),
    }))
    auditar({
      accion: 'Reordenación de líneas',
      entidad: 'Línea',
      entidadId: '—',
      expedienteId,
      anterior: '—',
      nuevo: `${ids.length} líneas`,
    })
  },

  /** Sube o baja una línea una posición dentro de su expediente. */
  moverLinea(expedienteId: string, id: string, direccion: -1 | 1) {
    const orden = selLineas(estado, expedienteId)
      .filter((l) => !l.parentId)
      .map((l) => l.id)
    const i = orden.indexOf(id)
    const j = i + direccion
    if (i < 0 || j < 0 || j >= orden.length) return
    const copia = [...orden]
    const [x] = copia.splice(i, 1)
    if (!x) return
    copia.splice(j, 0, x)
    ops.reordenarLineas(expedienteId, copia)
  },

  /**
   * Creación rápida: sólo exige nombre. Todo lo demás puede completarse
   * después de forma progresiva.
   */
  crearLineaRapida(datos: {
    expedienteId: string
    nombre: string
    objetivo?: string
    estado?: EstadoLinea
    responsable?: string
    tipo?: string
  }) {
    const exp = estado.expedientes.find((e) => e.id === datos.expedienteId)
    const orden = selLineas(estado, datos.expedienteId).length + 1
    return ops.crearLinea({
      expedienteId: datos.expedienteId,
      nombre: datos.nombre.trim(),
      tipo: datos.tipo ?? '',
      descripcion: '',
      estado: datos.estado ?? 'En curso',
      situacion: 'Debemos trabajo',
      prioridad: 'Media',
      responsable: datos.responsable ?? exp?.responsable ?? '',
      responsableHeredado: !datos.responsable,
      colaboradores: [],
      colaboradoresContactos: [],
      fechaInicio: hoyTexto(),
      dondeEstamos: '',
      proximaAccion: '',
      dependencia: 'Debemos actuar nosotros',
      presupuesto: '',
      objetivo: datos.objetivo ?? '',
      criterioFinalizacion: '',
      orden,
      createdAt: hoyTexto(),
      createdBy: estado.usuario,
    })
  },

  /** Registro manual (o desde un elemento) del último avance de la línea. */
  registrarAvance(id: string, texto: string, fecha = hoyTexto()) {
    ops.actualizarLinea(
      id,
      { ultimoAvance: texto, fechaUltimoAvance: fecha, dondeEstamos: texto },
      'Actualización del último avance',
    )
  },

  /** Marca la siguiente acción como realizada: pasa a último avance y se limpia. */
  completarSiguienteAccion(id: string) {
    const l = estado.lineas.find((x) => x.id === id)
    if (!l || !l.proximaAccion.trim()) return
    ops.actualizarLinea(
      id,
      {
        ultimoAvance: l.proximaAccion,
        dondeEstamos: l.proximaAccion,
        fechaUltimoAvance: hoyTexto(),
        proximaAccion: '',
        fechaSiguienteAccion: '',
        responsableSiguienteAccion: '',
      },
      'Siguiente acción realizada',
    )
  },

  /* ------------------------- Recordatorios ------------------------- */

  crearRecordatorio(datos: Omit<Recordatorio, 'id' | 'estado'> & { estado?: EstadoRecordatorio }) {
    const id = nuevoId('RC')
    const recordatorio: Recordatorio = {
      estado: 'Pendiente',
      creadoPor: estado.usuario,
      creadoEl: hoyTexto(),
      ...datos,
      id,
    }
    set((s) => ({ ...s, recordatorios: [...(s.recordatorios ?? []), recordatorio] }))
    auditar({
      accion: 'Alta de recordatorio',
      entidad: 'Línea',
      entidadId: datos.lineaId ?? '—',
      expedienteId: datos.expedienteId,
      anterior: '—',
      nuevo: `${datos.fecha} · ${datos.texto}`,
    })
    return id
  },

  actualizarRecordatorio(id: string, cambios: Partial<Recordatorio>) {
    set((s) => ({
      ...s,
      recordatorios: (s.recordatorios ?? []).map((r) => (r.id === id ? { ...r, ...cambios } : r)),
    }))
  },

  cambiarEstadoRecordatorio(id: string, nuevo: EstadoRecordatorio, fecha?: string) {
    const r = (estado.recordatorios ?? []).find((x) => x.id === id)
    if (!r) return
    ops.actualizarRecordatorio(id, { estado: nuevo, ...(fecha ? { fecha } : {}) })
    auditar({
      accion: 'Cambio de estado de recordatorio',
      entidad: 'Línea',
      entidadId: r.lineaId ?? '—',
      expedienteId: r.expedienteId,
      anterior: r.estado,
      nuevo,
    })
  },

  /** Aplaza un recordatorio un número de días sobre su fecha actual. */
  aplazarRecordatorio(id: string, dias: number) {
    const r = (estado.recordatorios ?? []).find((x) => x.id === id)
    if (!r) return
    const base = parseFecha(r.fecha) ?? HOY
    const destino = new Date(Math.max(base.getTime(), HOY.getTime()) + dias * 86400000)
    const texto = `${String(destino.getDate()).padStart(2, '0')}/${String(destino.getMonth() + 1).padStart(2, '0')}/${destino.getFullYear()}`
    ops.cambiarEstadoRecordatorio(id, 'Aplazado', texto)
  },

  eliminarRecordatorio(id: string) {
    set((s) => ({ ...s, recordatorios: (s.recordatorios ?? []).filter((r) => r.id !== id) }))
  },

  /** Convierte un recordatorio en tarea real sin perder el aviso original. */
  tareaDesdeRecordatorio(id: string) {
    const r = (estado.recordatorios ?? []).find((x) => x.id === id)
    if (!r) return null
    const linea = estado.lineas.find((l) => l.id === r.lineaId)
    const tareaId = ops.crearTarea({
      titulo: r.texto,
      descripcion: linea
        ? `Recordatorio de la línea «${linea.nombre}».`
        : 'Recordatorio convertido en tarea.',
      expedienteId: r.expedienteId,
      ...(r.lineaId ? { lineaId: r.lineaId } : {}),
      responsable: r.responsable,
      colaboradores: [],
      prioridad: 'Media' as never,
      estado: 'En curso',
      fechaInicio: hoyTexto(),
      vencimiento: r.fecha,
      recordatorio: r.fecha,
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
    })
    ops.actualizarRecordatorio(id, { tareaId })
    return tareaId
  },

  definirSiguienteAccion(
    id: string,
    datos: { texto: string; responsable?: string; fecha?: string },
  ) {
    ops.actualizarLinea(
      id,
      {
        proximaAccion: datos.texto,
        ...(datos.responsable ? { responsableSiguienteAccion: datos.responsable } : {}),
        ...(datos.fecha ? { fechaSiguienteAccion: datos.fecha } : {}),
      },
      'Siguiente acción de la línea',
    )
  },

  /** Convierte la siguiente acción en una tarea real del módulo de Tareas. */
  tareaDesdeSiguienteAccion(id: string) {
    const l = estado.lineas.find((x) => x.id === id)
    if (!l || !l.proximaAccion.trim()) return null
    const tareaId = ops.crearTarea({
      titulo: l.proximaAccion,
      descripcion: `Siguiente acción de la línea «${l.nombre}».`,
      expedienteId: l.expedienteId,
      lineaId: l.id,
      responsable: l.responsableSiguienteAccion || l.responsable,
      colaboradores: [],
      prioridad: (l.prioridad ?? 'Media') as never,
      estado: 'En curso',
      fechaInicio: hoyTexto(),
      vencimiento: l.fechaSiguienteAccion || hoyTexto(),
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
    })
    return tareaId
  },

  /**
   * Vincula (o desvincula) un elemento existente con una línea. No duplica el
   * registro: el elemento sigue viviendo en su módulo de origen.
   */
  vincularElemento(
    tipo: 'actuacion' | 'tarea' | 'documento' | 'fecha' | 'comunicacion',
    elementoId: string,
    lineaId: string | null,
    modo: 'principal' | 'relacionada' = 'principal',
  ) {
    const clave = (
      {
        actuacion: 'actuaciones',
        tarea: 'tareas',
        documento: 'documentos',
        fecha: 'fechas',
        comunicacion: 'comunicaciones',
      } as const
    )[tipo]
    let expedienteId: string | undefined
    let etiqueta = elementoId
    set(
      (s) =>
        ({
          ...s,
          [clave]: (
            s[clave] as {
              id: string
              expedienteId?: string
              lineaId?: string
              lineasRelacionadas?: string[]
              titulo?: string
              nombre?: string
              asunto?: string
            }[]
          ).map((el) => {
            if (el.id !== elementoId) return el
            expedienteId = el.expedienteId
            etiqueta = el.titulo ?? el.nombre ?? el.asunto ?? el.id
            if (modo === 'principal') return { ...el, lineaId: lineaId ?? undefined }
            const actuales = new Set(el.lineasRelacionadas ?? [])
            if (lineaId) actuales.add(lineaId)
            return { ...el, lineasRelacionadas: [...actuales] }
          }),
        }) as OpsState,
    )
    auditar({
      accion: lineaId ? 'Vinculación con línea de trabajo' : 'Desvinculación de línea de trabajo',
      entidad: 'Línea',
      entidadId: lineaId ?? '—',
      ...(expedienteId ? { expedienteId } : {}),
      anterior: '—',
      nuevo: `${tipo}: ${etiqueta}`,
    })
  },

  desvincularRelacionada(
    tipo: 'actuacion' | 'tarea' | 'documento' | 'fecha' | 'comunicacion',
    elementoId: string,
    lineaId: string,
  ) {
    const clave = (
      {
        actuacion: 'actuaciones',
        tarea: 'tareas',
        documento: 'documentos',
        fecha: 'fechas',
        comunicacion: 'comunicaciones',
      } as const
    )[tipo]
    set(
      (s) =>
        ({
          ...s,
          [clave]: (
            s[clave] as { id: string; lineaId?: string; lineasRelacionadas?: string[] }[]
          ).map((el) =>
            el.id === elementoId
              ? {
                  ...el,
                  ...(el.lineaId === lineaId ? { lineaId: undefined } : {}),
                  lineasRelacionadas: (el.lineasRelacionadas ?? []).filter((x) => x !== lineaId),
                }
              : el,
          ),
        }) as OpsState,
    )
  },

  /* --------------------------- Ejecuciones ------------------------- */

  activarEjecucion(data: Omit<Ejecucion, 'id' | 'lineaId'> & { lineaId?: string }) {
    const lineaId =
      data.lineaId ??
      ops.crearLinea({
        expedienteId: data.expedienteId,
        nombre:
          data.modalidad === 'Ejecución judicial'
            ? 'Ejecución judicial'
            : 'Cumplimiento y ejecución',
        tipo: 'Ejecución',
        descripcion: data.objeto,
        estado: 'En curso',
        responsable: data.responsable,
        fechaInicio: hoyTexto(),
        dondeEstamos: data.dondeEstamos,
        proximaAccion: data.proximaAccion,
        dependencia: data.dependencia,
        presupuesto: data.situacionPresupuestaria,
        esEjecucion: true,
      })
    const id = nuevoId('EJ')
    const ejecucion: Ejecucion = { ...data, lineaId, id }
    set((s) => ({
      ...s,
      ejecuciones: [...s.ejecuciones, ejecucion],
      expedientes: s.expedientes.map((e) =>
        e.id === data.expedienteId
          ? { ...e, fase: 'cumplimiento', ultimoMovimiento: hoyTexto() }
          : e,
      ),
    }))
    auditar({
      accion: 'Activación de ejecución',
      entidad: 'Ejecución',
      entidadId: id,
      expedienteId: data.expedienteId,
      anterior: '—',
      nuevo: data.titulo,
    })
    return id
  },

  actualizarEjecucion(id: string, cambios: Partial<Ejecucion>) {
    const prev = estado.ejecuciones.find((e) => e.id === id)
    set((s) => ({
      ...s,
      ejecuciones: s.ejecuciones.map((e) => (e.id === id ? { ...e, ...cambios } : e)),
    }))
    if (prev)
      auditar({
        accion: 'Edición de ejecución',
        entidad: 'Ejecución',
        entidadId: id,
        expedienteId: prev.expedienteId,
        anterior: prev.estado,
        nuevo: cambios.estado ?? prev.estado,
      })
  },

  derivarAJudicial(id: string) {
    const e = estado.ejecuciones.find((x) => x.id === id)
    if (!e) return
    ops.actualizarEjecucion(id, { estado: 'Derivado a ejecución judicial' })
    ops.activarEjecucion({
      expedienteId: e.expedienteId,
      modalidad: 'Ejecución judicial',
      tipo: 'Título extrajudicial',
      estado: 'Preparación de demanda ejecutiva',
      titulo: `Derivada de ${e.titulo}`,
      objeto: e.objeto,
      obligado: e.obligado,
      beneficiario: e.beneficiario,
      prestacion: e.prestacion,
      importeReclamado: e.importeReclamado - e.importeRecuperado,
      importeRecuperado: 0,
      responsable: e.responsable,
      fechaInicio: hoyTexto(),
      dondeEstamos: 'Ejecución derivada desde el ámbito extrajudicial.',
      proximaAccion: 'Preparar demanda ejecutiva',
      dependencia: 'Debemos actuar nosotros',
      alcance: 'Pendiente de definir alcance y presupuesto.',
      situacionPresupuestaria: 'Requiere nuevo presupuesto',
      proximoControl: '',
      derivadaDe: e.id,
      naturalezaOriginal: e.naturalezaOriginal,
    })
  },

  /* --------------------------- Actuaciones ------------------------- */

  crearActuacion(data: Omit<Actuacion, 'id'>) {
    const id = nuevoId('AC')
    set((s) => ({
      ...s,
      actuaciones: [{ ...data, id }, ...s.actuaciones],
      expedientes: s.expedientes.map((e) =>
        e.id === data.expedienteId
          ? {
              ...e,
              ultimoMovimiento: data.fecha,
              tiempoRegistrado: e.tiempoRegistrado + data.tiempo,
              ...(data.proximaAccion ? { proximaAccion: data.proximaAccion } : {}),
            }
          : e,
      ),
    }))
    auditar({
      accion: 'Alta de actuación',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: data.expedienteId,
      anterior: '—',
      nuevo: data.titulo,
    })
    return id
  },

  actualizarActuacion(id: string, cambios: Partial<Actuacion>) {
    set((s) => ({
      ...s,
      actuaciones: s.actuaciones.map((a) => (a.id === id ? { ...a, ...cambios } : a)),
    }))
  },

  /* ----- Calificación manual de actividades (nunca automática) ----- */

  /** Eleva una actividad a actuación relevante. */
  marcarComoActuacion(id: string, datos: Partial<Actuacion> = {}) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return
    ops.actualizarActuacion(id, {
      ...datos,
      esActuacion: true,
      tipoActuacion: datos.tipoActuacion ?? a.tipoActuacion ?? 'Extrajudicial',
      modificadoPor: estado.usuario,
      fechaModificacion: ahora(),
    })
    auditar({
      accion: 'Marcada como actuación',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: 'Actividad',
      nuevo: 'Actuación',
    })
  },

  /** Devuelve la actuación a su condición de actividad ordinaria (y retira el hito). */
  desmarcarActuacion(id: string) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return
    ops.actualizarActuacion(id, {
      esActuacion: false,
      esHito: false,
      modificadoPor: estado.usuario,
      fechaModificacion: ahora(),
    })
    auditar({
      accion: 'Deja de destacarse como actuación',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: 'Actuación',
      nuevo: 'Actividad',
    })
  },

  /** Marca una actuación como hito histórico. Exige que sea actuación. */
  marcarHito(
    id: string,
    datos: { tituloHito: string; categoriaHito?: Actuacion['categoriaHito'] },
  ) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return { ok: false as const, motivo: 'Actividad no encontrada' }
    if (!a.esActuacion)
      return { ok: false as const, motivo: 'Solo una actuación puede marcarse como hito.' }
    ops.actualizarActuacion(id, {
      esHito: true,
      tituloHito: datos.tituloHito || a.titulo,
      ...(datos.categoriaHito ? { categoriaHito: datos.categoriaHito } : {}),
      modificadoPor: estado.usuario,
      fechaModificacion: ahora(),
    })
    auditar({
      accion: 'Marcada como hito histórico',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: 'Actuación',
      nuevo: datos.tituloHito || a.titulo,
    })
    return { ok: true as const }
  },

  desmarcarHito(id: string) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return
    ops.actualizarActuacion(id, {
      esHito: false,
      modificadoPor: estado.usuario,
      fechaModificacion: ahora(),
    })
    auditar({
      accion: 'Retirada de los hitos',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: 'Hito',
      nuevo: 'Actuación',
    })
  },

  /** Rectificación con conservación del dato anterior en el histórico. */
  rectificarActividad(id: string, cambios: Partial<Actuacion>, motivo: string) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return
    ops.actualizarActuacion(id, {
      ...cambios,
      estadoRegistro: 'Rectificada',
      motivoRectificacion: motivo,
      modificadoPor: estado.usuario,
      fechaModificacion: ahora(),
    })
    auditar({
      accion: 'Rectificación de actividad',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: `${a.fecha} · ${a.titulo}`,
      nuevo: `${cambios.fecha ?? a.fecha} · ${cambios.titulo ?? a.titulo} — motivo: ${motivo}`,
    })
  },

  /** La actividad anulada permanece visible en el histórico. */
  anularActuacion(id: string, motivo: string) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return
    ops.actualizarActuacion(id, {
      estadoRegistro: 'Anulada',
      estado: 'Cancelada',
      motivoRectificacion: motivo,
      modificadoPor: estado.usuario,
      fechaModificacion: ahora(),
    })
    auditar({
      accion: 'Anulación de actividad',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: a.estadoRegistro ?? 'Confirmada',
      nuevo: `Anulada — ${motivo}`,
    })
  },

  confirmarActuacion(id: string) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return
    ops.actualizarActuacion(id, {
      estadoRegistro: 'Confirmada',
      modificadoPor: estado.usuario,
      fechaModificacion: ahora(),
    })
    auditar({
      accion: 'Confirmación de actividad',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: a.estadoRegistro ?? 'Borrador',
      nuevo: 'Confirmada',
    })
  },

  cambiarEstadoActuacion(id: string, estadoNuevo: EstadoActuacion) {
    const a = estado.actuaciones.find((x) => x.id === id)
    if (!a) return
    ops.actualizarActuacion(id, { estado: estadoNuevo })
    auditar({
      accion: 'Cambio de estado de actuación',
      entidad: 'Actuación',
      entidadId: id,
      expedienteId: a.expedienteId,
      anterior: a.estado,
      nuevo: estadoNuevo,
    })
  },

  /* ---------------------------- Documentos ------------------------- */

  crearDocumento(data: Omit<Documento, 'id'>) {
    const id = nuevoId('DOC')
    set((s) => ({ ...s, documentos: [{ ...data, id }, ...s.documentos] }))
    auditar({
      accion: 'Alta de documento',
      entidad: 'Documento',
      entidadId: id,
      ...(data.expedienteId ? { expedienteId: data.expedienteId } : {}),
      anterior: '—',
      nuevo: data.nombre,
    })
    return id
  },

  actualizarDocumento(id: string, cambios: Partial<Documento>) {
    set((s) => ({
      ...s,
      documentos: s.documentos.map((d) => (d.id === id ? { ...d, ...cambios } : d)),
    }))
  },

  cambiarEstadoDocumento(id: string, estadoNuevo: string) {
    const d = estado.documentos.find((x) => x.id === id)
    if (!d) return { ok: false as const, motivo: 'Documento no encontrado' }
    if (
      d.entregable &&
      (estadoNuevo === 'Presentado' || estadoNuevo === 'Entregado') &&
      !tieneDefinitiva(d)
    )
      return {
        ok: false as const,
        motivo: 'Antes de presentar o entregar debe existir una versión definitiva.',
      }
    ops.actualizarDocumento(id, { estado: estadoNuevo })
    auditar({
      accion: 'Cambio de estado de documento',
      entidad: 'Documento',
      entidadId: id,
      ...(d.expedienteId ? { expedienteId: d.expedienteId } : {}),
      anterior: d.estado,
      nuevo: estadoNuevo,
    })
    return { ok: true as const }
  },

  nuevaVersion(id: string, version: Omit<VersionDocumento, 'numero'>) {
    const d = estado.documentos.find((x) => x.id === id)
    if (!d) return { ok: false as const, motivo: 'Documento no encontrado' }
    if (tieneDefinitiva(d) && !version.definitiva)
      return {
        ok: false as const,
        motivo: 'El documento tiene versión definitiva: crea un documento sustituto.',
      }
    const numero = d.versiones.length + 1
    ops.actualizarDocumento(id, {
      versiones: [...d.versiones, { ...version, numero }],
      version: numero,
    })
    auditar({
      accion: 'Nueva versión de documento',
      entidad: 'Documento',
      entidadId: id,
      ...(d.expedienteId ? { expedienteId: d.expedienteId } : {}),
      anterior: `v${d.version}`,
      nuevo: `v${numero}`,
    })
    return { ok: true as const }
  },

  asignarDocumento(id: string, expedienteId: string, lineaId?: string) {
    ops.actualizarDocumento(id, {
      expedienteId,
      ...(lineaId ? { lineaId } : {}),
      estado: 'En curso',
    })
    auditar({
      accion: 'Asignación de documento',
      entidad: 'Documento',
      entidadId: id,
      expedienteId,
      anterior: 'Sin asignar',
      nuevo: expedienteId,
    })
  },

  validarPlazoDocumento(
    id: string,
    fecha: {
      titulo: string
      fecha: string
      responsable: string
      criticidad: FechaCritica['criticidad']
    },
  ) {
    const d = estado.documentos.find((x) => x.id === id)
    if (!d || !d.datosJudiciales) return
    ops.actualizarDocumento(id, {
      datosJudiciales: { ...d.datosJudiciales, estadoPlazo: 'Plazo validado' },
    })
    ops.crearFecha({
      ...(d.expedienteId ? { expedienteId: d.expedienteId } : {}),
      origen: { tipo: 'Documento', id, label: d.nombre },
      tipo: 'Plazo procesal',
      titulo: fecha.titulo,
      fecha: fecha.fecha,
      hora: '23:59',
      responsable: fecha.responsable,
      validada: true,
      validadaPor: estado.usuario,
      criticidad: fecha.criticidad,
      avisos: 'Aviso 5 y 2 días antes',
      observaciones: 'Plazo validado profesionalmente.',
      resultado: '',
      sincronizadaCalendar: false,
    })
  },

  /* ------------------------------ Tareas --------------------------- */

  crearTarea(data: Omit<TareaOp, 'id'>) {
    const id = nuevoId('TR')
    // El texto con el que se encarga la tarea no es un campo aparte: es el
    // primer mensaje de la conversación interna (indicación inicial).
    const indicacion = data.descripcion?.trim()
    const conversacionInicial = indicacion
      ? [
          {
            id: nuevoId('MS'),
            fecha: hoyTexto(),
            hora: hora(),
            autor: estado.usuario,
            texto: indicacion,
            clase: 'mensaje' as const,
            indicacionInicial: true,
          },
        ]
      : []
    const tarea: TareaOp = {
      creador: estado.usuario,
      creadoEn: ahora(),
      fechaEnvio: ahora(),
      evidencias: [],
      reclamaciones: [],
      recordatorios: [],
      documentosVinculados: [],
      historico: [
        {
          id: nuevoId('HT'),
          fecha: ahora(),
          autor: estado.usuario,
          accion: 'Creación',
          detalle: data.titulo,
        },
      ],
      ...data,
      conversacion: [...conversacionInicial, ...(data.conversacion ?? [])],
      indicacionMigrada: true,
      id,
    }
    set((s) => ({ ...s, tareas: [tarea, ...s.tareas] }))

    auditar({
      accion: 'Alta de tarea',
      entidad: 'Tarea',
      entidadId: id,
      ...(data.expedienteId ? { expedienteId: data.expedienteId } : {}),
      anterior: '—',
      nuevo: data.titulo,
    })
    // Sólo se avisa cuando el encargo es para otra persona (nunca por autotareas).
    if (!tarea.bloqueadaPor)
      ops.notificar(tarea.responsable, `Nuevo encargo: «${tarea.titulo}».`, 'Encargo', id)
    return id
  },

  /** Creación rápida: título, responsable y fecha/hora bastan. */
  crearTareaRapida(datos: {
    titulo: string
    responsable?: string
    vencimiento?: string
    horaLimite?: string
    prioridad?: Prioridad
    expedienteId?: string
    lineaId?: string
    descripcion?: string
    etiquetas?: string[]
    origen?: OrigenRelacion
    /** Documento que se vincula a la tarea recién creada (relación bidireccional). */
    documentoId?: string
    /** Nace ya marcada como SIGUIENTE ACCIÓN de su contexto. */
    esSiguienteAccion?: boolean
  }) {
    const nuevaId = ops.crearTarea({
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? '',
      responsable: datos.responsable ?? estado.usuario,
      colaboradores: [],
      prioridad: datos.prioridad ?? 'Media',
      estado: 'Pendiente',
      fechaInicio: hoyTexto(),
      vencimiento: datos.vencimiento ?? '',
      horaLimite: datos.horaLimite ?? '',
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      ...(datos.expedienteId ? { expedienteId: datos.expedienteId } : {}),
      ...(datos.lineaId ? { lineaId: datos.lineaId } : {}),
      ...(datos.etiquetas?.length ? { etiquetas: [...new Set(datos.etiquetas)] } : {}),
      ...(datos.origen ? { origen: datos.origen } : {}),
    })
    if (datos.documentoId) ops.vincularDocumentoTarea(nuevaId, datos.documentoId)
    if (datos.esSiguienteAccion) ops.marcarSiguienteAccion(nuevaId)
    return nuevaId
  },

  /* ----------------------- SIGUIENTE ACCIÓN ------------------------ */

  /**
   * Marca la tarea como Siguiente acción de su contexto. La anterior pierde
   * la marca automáticamente (no se elimina ni se completa).
   */
  marcarSiguienteAccion(id: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    const contexto = contextoDeTarea(t)
    if (!contexto)
      return { ok: false as const, error: 'La tarea no está vinculada a ningún contexto.' }
    const anterior = siguienteAccionDe(estado, contexto)
    if (anterior && anterior.id !== id) {
      ops.actualizarTarea(anterior.id, { esSiguienteAccion: undefined })
      ops.registrarHistoricoTarea(
        anterior.id,
        'Siguiente acción',
        `Deja de ser la siguiente acción: la sustituye «${t.titulo}».`,
      )
    }
    ops.actualizarTarea(id, { esSiguienteAccion: true })
    ops.registrarHistoricoTarea(
      id,
      'Siguiente acción',
      `Marcada como SIGUIENTE ACCIÓN de ${contexto.label ?? claveContexto(contexto)}.`,
    )
    auditar({
      accion: 'Siguiente acción',
      entidad: 'Tarea',
      entidadId: id,
      ...(t.expedienteId ? { expedienteId: t.expedienteId } : {}),
      anterior: anterior ? anterior.titulo : 'SIN SIGUIENTE ACCIÓN',
      nuevo: t.titulo,
    })
    return { ok: true as const }
  },

  /** Retira la marca sin tocar el estado ordinario de la tarea. */
  quitarSiguienteAccion(id: string, motivo = 'Retirada manualmente.') {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t?.esSiguienteAccion) return
    ops.actualizarTarea(id, { esSiguienteAccion: undefined })
    ops.registrarHistoricoTarea(id, 'Siguiente acción', motivo)
    auditar({
      accion: 'Siguiente acción',
      entidad: 'Tarea',
      entidadId: id,
      ...(t.expedienteId ? { expedienteId: t.expedienteId } : {}),
      anterior: t.titulo,
      nuevo: 'SIN SIGUIENTE ACCIÓN',
    })
  },

  actualizarTarea(id: string, cambios: { [K in keyof TareaOp]?: TareaOp[K] | undefined }) {
    set((s) => ({
      ...s,
      tareas: s.tareas.map((t) => (t.id === id ? ({ ...t, ...cambios } as TareaOp) : t)),
    }))
  },

  /* ---------------------------- Etiquetas -------------------------- */

  crearEtiqueta(nombre: string, color: ColorEtiqueta = 'gris', descripcion = '') {
    const limpio = nombre.trim()
    if (!limpio) return { ok: false as const, error: 'Indica un nombre para la etiqueta.' }
    if (!puedeGestionarEtiquetas(estado))
      return { ok: false as const, error: 'Tu perfil sólo puede aplicar etiquetas existentes.' }
    const clave = claveEtiqueta(limpio)
    const existente = (estado.etiquetas ?? []).find((e) => claveEtiqueta(e.nombre) === clave)
    if (existente) {
      if (existente.archivada || existente.fusionadaEn)
        return { ok: false as const, error: `«${existente.nombre}» existe pero está archivada.` }
      return { ok: true as const, id: existente.id, reutilizada: true }
    }
    const etiqueta: EtiquetaTarea = {
      id: nuevoId('ET'),
      nombre: limpio,
      color,
      archivada: false,
      creadaEn: hoyTexto(),
      creadaPor: estado.usuario,
      ...(descripcion ? { descripcion } : {}),
    }
    set((s) => ({ ...s, etiquetas: [...(s.etiquetas ?? []), etiqueta] }))
    auditar({
      accion: 'Alta de etiqueta',
      entidad: 'Tarea',
      entidadId: etiqueta.id,
      anterior: '—',
      nuevo: etiqueta.nombre,
    })
    return { ok: true as const, id: etiqueta.id, reutilizada: false }
  },

  actualizarEtiqueta(
    id: string,
    cambios: Partial<Pick<EtiquetaTarea, 'nombre' | 'color' | 'descripcion'>>,
  ) {
    if (!puedeGestionarEtiquetas(estado))
      return { ok: false as const, error: 'Tu perfil no puede editar el catálogo de etiquetas.' }
    const nombre = cambios.nombre?.trim()
    if (nombre) {
      const clave = claveEtiqueta(nombre)
      const choque = (estado.etiquetas ?? []).find(
        (e) => e.id !== id && claveEtiqueta(e.nombre) === clave,
      )
      if (choque) return { ok: false as const, error: `Ya existe una etiqueta «${choque.nombre}».` }
    }
    set((s) => ({
      ...s,
      etiquetas: (s.etiquetas ?? []).map((e) =>
        e.id === id ? { ...e, ...cambios, ...(nombre ? { nombre } : {}) } : e,
      ),
    }))
    return { ok: true as const }
  },

  archivarEtiqueta(id: string, archivada: boolean) {
    if (!puedeGestionarEtiquetas(estado))
      return { ok: false as const, error: 'Tu perfil no puede archivar etiquetas.' }
    // Archivar no borra la relación: las tareas conservan la trazabilidad.
    set((s) => ({
      ...s,
      etiquetas: (s.etiquetas ?? []).map((e) => (e.id === id ? { ...e, archivada } : e)),
    }))
    return { ok: true as const }
  },

  /** Fusiona el origen en el destino: reasigna tareas y archiva la absorbida. */
  fusionarEtiquetas(origenId: string, destinoId: string) {
    if (!puedeGestionarEtiquetas(estado))
      return { ok: false as const, error: 'Tu perfil no puede fusionar etiquetas.' }
    if (origenId === destinoId)
      return { ok: false as const, error: 'Elige dos etiquetas distintas.' }
    const origen = etiquetaPorId(estado, origenId)
    const destino = etiquetaPorId(estado, destinoId)
    if (!origen || !destino) return { ok: false as const, error: 'Etiqueta no encontrada.' }
    let afectadas = 0
    set((s) => ({
      ...s,
      etiquetas: (s.etiquetas ?? []).map((e) =>
        e.id === origenId ? { ...e, archivada: true, fusionadaEn: destinoId } : e,
      ),
      tareas: s.tareas.map((t) => {
        if (!(t.etiquetas ?? []).includes(origenId)) return t
        afectadas += 1
        return {
          ...t,
          etiquetas: [...new Set((t.etiquetas ?? []).map((x) => (x === origenId ? destinoId : x)))],
        }
      }),
    }))
    ops.registrarHistoricoGlobalEtiqueta(origen.nombre, destino.nombre, afectadas)
    return { ok: true as const, afectadas }
  },

  registrarHistoricoGlobalEtiqueta(origen: string, destino: string, afectadas: number) {
    auditar({
      accion: 'Fusión de etiquetas',
      entidad: 'Tarea',
      entidadId: '—',
      anterior: origen,
      nuevo: `${destino} · ${afectadas} tareas`,
    })
  },

  /** Fija las etiquetas de una tarea y deja constancia en su histórico. */
  aplicarEtiquetasTarea(tareaId: string, ids: string[]) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t) return { ok: false as const, error: 'Tarea no encontrada.' }
    if (!puedeEtiquetarTarea(estado, t))
      return { ok: false as const, error: 'No participas en esta tarea.' }
    const previas = t.etiquetas ?? []
    const nuevas = [...new Set(ids)]
    const añadidas = nuevas.filter((x) => !previas.includes(x))
    const quitadas = previas.filter((x) => !nuevas.includes(x))
    if (!añadidas.length && !quitadas.length) return { ok: true as const }
    ops.actualizarTarea(tareaId, { etiquetas: nuevas })
    const nombre = (id: string) => etiquetaPorId(estado, id)?.nombre ?? id
    if (añadidas.length)
      ops.registrarHistoricoTarea(tareaId, 'Etiquetas añadidas', añadidas.map(nombre).join(', '))
    if (quitadas.length)
      ops.registrarHistoricoTarea(tareaId, 'Etiquetas retiradas', quitadas.map(nombre).join(', '))
    return { ok: true as const }
  },

  /** Acción masiva: añade y/o retira etiquetas en un conjunto de tareas. */
  etiquetarTareas(tareaIds: string[], añadir: string[] = [], quitar: string[] = []) {
    let aplicadas = 0
    for (const id of tareaIds) {
      const t = estado.tareas.find((x) => x.id === id)
      if (!t || !puedeEtiquetarTarea(estado, t)) continue
      const previas = t.etiquetas ?? []
      const resultado = [...new Set([...previas, ...añadir])].filter((x) => !quitar.includes(x))
      const r = ops.aplicarEtiquetasTarea(id, resultado)
      if (r.ok) aplicadas += 1
    }
    return { ok: true as const, aplicadas, omitidas: tareaIds.length - aplicadas }
  },

  /* ------------------------- Notificaciones ------------------------ */

  /** Aviso interno. Nunca se notifica al propio autor de la acción. */
  notificar(
    usuario: string,
    texto: string,
    tipo: Notificacion['tipo'],
    tareaId?: string,
    fechaId?: string,
  ) {
    if (!usuario || usuario === estado.usuario) return
    const n: Notificacion = {
      id: nuevoId('NT'),
      usuario,
      fecha: hoyTexto(),
      hora: hora(),
      texto,
      tipo,
      leida: false,
      ...(tareaId ? { tareaId } : {}),
      ...(fechaId ? { fechaId } : {}),
    }
    set((s) => ({ ...s, notificaciones: [n, ...(s.notificaciones ?? [])] }))
  },

  marcarNotificacionLeida(id: string) {
    set((s) => ({
      ...s,
      notificaciones: (s.notificaciones ?? []).map((n) =>
        n.id === id ? { ...n, leida: true } : n,
      ),
    }))
  },

  marcarTodasLeidas() {
    set((s) => ({
      ...s,
      notificaciones: (s.notificaciones ?? []).map((n) =>
        n.usuario === s.usuario ? { ...n, leida: true } : n,
      ),
    }))
  },

  /* ---------------------- Trazabilidad de tarea -------------------- */

  /** Traza cualquier acontecimiento relevante en el histórico de la tarea. */
  registrarHistoricoTarea(
    id: string,
    accion: string,
    detalle: string,
    anterior?: string,
    nuevo?: string,
  ) {
    const entrada = {
      id: nuevoId('HT'),
      fecha: ahora(),
      autor: estado.usuario,
      accion,
      detalle,
      ...(anterior !== undefined ? { anterior } : {}),
      ...(nuevo !== undefined ? { nuevo } : {}),
    }
    set((s) => ({
      ...s,
      tareas: s.tareas.map((t) =>
        t.id === id ? { ...t, historico: [entrada, ...(t.historico ?? [])] } : t,
      ),
    }))
  },

  /** Primera apertura de la tarea por su responsable (control de acuse de recibo). */
  registrarAperturaTarea(id: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    const cambios: Partial<TareaOp> = { ultimaApertura: ahora() }
    if (!t.primeraApertura && t.responsable === estado.usuario) {
      cambios.primeraApertura = { fecha: ahora(), autor: estado.usuario }
      ops.registrarHistoricoTarea(id, 'Primera apertura', `Abierta por ${estado.usuario}.`)
    }
    ops.actualizarTarea(id, cambios)
  },

  /* --------------------------- Conversación ------------------------ */

  enviarMensajeTarea(id: string, texto: string, clase: MensajeTarea['clase'] = 'mensaje') {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t || !texto.trim()) return
    const m: MensajeTarea = {
      id: nuevoId('MS'),
      fecha: hoyTexto(),
      hora: hora(),
      autor: estado.usuario,
      texto: texto.trim(),
      clase,
    }
    ops.actualizarTarea(id, { conversacion: [...(t.conversacion ?? []), m] })
    ops.registrarHistoricoTarea(id, clase === 'reclamacion' ? 'Reclamación' : 'Mensaje', m.texto)
    const otro = estado.usuario === t.responsable ? (t.creador ?? '') : t.responsable
    ops.notificar(otro, `Nuevo mensaje en «${t.titulo}»: ${m.texto.slice(0, 80)}`, 'Mensaje', id)
  },

  /* ---------------------- Edición del encargo ---------------------- */

  /**
   * Sólo el creador o el supervisor pueden alterar el contenido del encargo.
   * La restricción es de datos, no meramente visual.
   */
  editarEncargo(
    id: string,
    cambios: Partial<
      Pick<
        TareaOp,
        | 'titulo'
        | 'descripcion'
        | 'vencimiento'
        | 'horaLimite'
        | 'prioridad'
        | 'expedienteId'
        | 'lineaId'
      >
    >,
  ) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (!puedeEditarEncargo(estado, t))
      return {
        ok: false as const,
        error: 'Sólo quien encargó la tarea puede modificar su contenido.',
      }
    const campos = Object.entries(cambios).filter(
      ([k, v]) => (t as Record<string, unknown>)[k] !== v,
    )
    if (!campos.length) return { ok: true as const }
    ops.actualizarTarea(id, cambios)
    for (const [campo, valor] of campos) {
      ops.registrarHistoricoTarea(
        id,
        'Modificación del encargo',
        campo,
        String((t as Record<string, unknown>)[campo] ?? '—'),
        String(valor ?? '—'),
      )
    }
    ops.notificar(t.responsable, `Se ha modificado el encargo «${t.titulo}».`, 'Cambio', id)
    return { ok: true as const }
  },

  ampliarPlazoTarea(id: string, vencimiento: string, horaLimite: string, motivo = '') {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (!puedeEditarEncargo(estado, t))
      return { ok: false as const, error: 'Sólo quien encargó la tarea puede ampliar el plazo.' }
    ops.actualizarTarea(id, { vencimiento, horaLimite })
    ops.registrarHistoricoTarea(
      id,
      'Ampliación de plazo',
      motivo || 'Nuevo plazo fijado por el solicitante.',
      `${t.vencimiento} ${t.horaLimite ?? ''}`.trim(),
      `${vencimiento} ${horaLimite}`.trim(),
    )
    ops.notificar(
      t.responsable,
      `Nuevo plazo de «${t.titulo}»: ${vencimiento} ${horaLimite}.`,
      'Cambio',
      id,
    )
    return { ok: true as const }
  },

  cambiarEstadoTarea(id: string, estadoNuevo: EstadoTareaOp) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    if (estadoNuevo === 'Completada') {
      ops.completarTarea(id)
      return
    }
    if (estadoNuevo === 'Cancelada' && t.esSiguienteAccion)
      ops.quitarSiguienteAccion(id, 'Cancelada: el contexto queda SIN SIGUIENTE ACCIÓN.')
    ops.actualizarTarea(id, { estado: estadoNuevo })
    ops.registrarHistoricoTarea(
      id,
      'Cambio de estado',
      `${t.estado} → ${estadoNuevo}`,
      t.estado,
      estadoNuevo,
    )
    auditar({
      accion: 'Cambio de estado de tarea',
      entidad: 'Tarea',
      entidadId: id,
      ...(t.expedienteId ? { expedienteId: t.expedienteId } : {}),
      anterior: t.estado,
      nuevo: estadoNuevo,
    })
  },

  /** Motivos por los que una tarea todavía no puede cerrarse. */
  impedimentosCierre(id: string): string[] {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return []
    const motivos: string[] = []
    if (t.bloqueadaPor) {
      const previa = estado.tareas.find((x) => x.id === t.bloqueadaPor)
      if (previa && previa.estado !== 'Completada' && previa.estado !== 'Cancelada')
        motivos.push(`Depende de «${previa.titulo}», todavía sin cerrar.`)
    }
    return motivos
  },

  completarTarea(id: string, resultado?: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, motivos: ['La tarea no existe.'] }
    const motivos = ops.impedimentosCierre(id)
    if (motivos.length) return { ok: false as const, motivos }
    if (t.esSiguienteAccion)
      ops.quitarSiguienteAccion(id, 'Completada: el contexto queda SIN SIGUIENTE ACCIÓN.')
    ops.actualizarTarea(id, {
      estado: 'Completada',
      esperandoRespuesta: undefined,
      ...(resultado ? { resultado } : {}),
    })
    ops.registrarHistoricoTarea(
      id,
      'Cierre',
      resultado || 'Tarea completada.',
      t.estado,
      'Completada',
    )
    auditar({
      accion: 'Cambio de estado de tarea',
      entidad: 'Tarea',
      entidadId: id,
      ...(t.expedienteId ? { expedienteId: t.expedienteId } : {}),
      anterior: t.estado,
      nuevo: 'Completada',
    })
    ops.notificar(
      t.creador ?? '',
      `«${t.titulo}» completada por ${estado.usuario}.${resultado ? ` ${resultado}` : ''}`,
      'Cierre',
      id,
    )
    ops.activarSiguienteFase(id)
    ops.revisarDocumentosDeTarea(id)
    return { ok: true as const, motivos: [] }
  },

  /**
   * Flujo documental simple: si al cerrar la tarea no queda ninguna otra tarea
   * viva sobre el documento, éste pasa de EN TRATAMIENTO a TRATADO.
   */
  revisarDocumentosDeTarea(id: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    for (const docId of t.documentosVinculados ?? []) {
      const d = estado.documentos.find((x) => x.id === docId)
      if (!d || d.estado === 'Archivado / solo consulta') continue
      const vivas = estado.tareas.filter(
        (x) =>
          (x.documentosVinculados ?? []).includes(docId) && ESTADOS_TAREA_VIVOS.includes(x.estado),
      )
      if (!vivas.length && d.estado === 'En tratamiento')
        ops.actualizarDocumento(docId, { estado: 'Tratado' })
    }
  },

  /** Activa la fase siguiente de la cadena y calcula su vencimiento. */
  activarSiguienteFase(id: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t?.desbloquea) return
    const sig = estado.tareas.find((x) => x.id === t.desbloquea)
    if (!sig || sig.estado === 'Completada' || sig.estado === 'Cancelada') return
    const modo =
      sig.plazoModo ?? (sig.diasTrasPredecesora ? 'dias' : sig.vencimiento ? 'fija' : 'sin')
    const vencimiento =
      modo === 'dias'
        ? sumarDiasTexto(sig.diasTrasPredecesora ?? 7)
        : modo === 'fija'
          ? sig.vencimiento
          : ''
    ops.actualizarTarea(sig.id, {
      estado: 'Pendiente',
      bloqueadaPor: undefined,
      fechaInicio: hoyTexto(),
      fechaEnvio: ahora(),
      vencimiento,
      ...(sig.motivoDiferimiento ? { motivoDiferimiento: undefined } : {}),
    })
    ops.registrarHistoricoTarea(
      sig.id,
      'Activación en cadena',
      `Se activa al completarse «${t.titulo}».${vencimiento ? ` Vencimiento: ${vencimiento} ${sig.horaLimite ?? ''}.` : ''}`,
    )
    ops.notificar(sig.responsable, `Se ha activado tu tarea «${sig.titulo}».`, 'Cadena', sig.id)
  },

  /**
   * EN ESPERA: la tarea sigue viva pero detenida. Exige motivo tasado y fecha
   * de revisión; si el motivo es «Otro», también explicación.
   */
  ponerEnEspera(id: string, hasta: string, motivo: MotivoEspera, detalle = '') {
    if (!hasta.trim()) return { ok: false as const, error: 'Indica la fecha de revisión.' }
    if (motivo === 'Otro' && !detalle.trim())
      return { ok: false as const, error: 'El motivo «Otro» exige una explicación.' }
    const t = estado.tareas.find((x) => x.id === id)
    ops.actualizarTarea(id, {
      estado: 'En espera',
      diferidaHasta: hasta,
      motivoDiferimiento: motivo,
      motivoEsperaDetalle: detalle,
    })
    ops.registrarHistoricoTarea(
      id,
      'En espera',
      `${motivo}${hasta ? ` · revisión ${hasta}` : ''}. ${detalle}`.trim(),
      t?.estado,
      'En espera',
    )
    return { ok: true as const }
  },

  /** Reactiva una tarea EN ESPERA devolviéndola al trabajo vivo. */
  reactivarTarea(id: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    ops.actualizarTarea(id, {
      estado: 'En curso',
      diferidaHasta: undefined,
      motivoDiferimiento: undefined,
      motivoEsperaDetalle: undefined,
    })
    ops.registrarHistoricoTarea(
      id,
      'Reactivación',
      'La tarea vuelve al trabajo vivo.',
      t.estado,
      'En curso',
    )
  },

  /* ------------------------------ Subtareas ------------------------ */

  añadirSubtarea(id: string, texto: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t || !texto.trim()) return
    const previas = t.subtareas ?? []
    const sub: Subtarea = {
      id: nuevoId('ST'),
      texto: texto.trim(),
      hecho: false,
      autor: estado.usuario,
      fecha: hoyTexto(),
      orden: previas.length + 1,
    }
    ops.actualizarTarea(id, { subtareas: [...previas, sub] })
  },

  /** Completar una subtarea nunca cambia su posición. */
  alternarSubtarea(id: string, subId: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    ops.actualizarTarea(id, {
      subtareas: (t.subtareas ?? []).map((x) => (x.id === subId ? { ...x, hecho: !x.hecho } : x)),
    })
  },

  eliminarSubtarea(id: string, subId: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    ops.actualizarTarea(id, { subtareas: (t.subtareas ?? []).filter((x) => x.id !== subId) })
  },

  /** Orden manual de la checklist (drag & drop): se conserva tal cual. */
  reordenarSubtareas(id: string, orden: string[]) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    const mapa = new Map((t.subtareas ?? []).map((x) => [x.id, x]))
    const nuevas = orden
      .map((sid, i) => {
        const s = mapa.get(sid)
        return s ? { ...s, orden: i + 1 } : undefined
      })
      .filter(Boolean) as Subtarea[]
    if (nuevas.length !== (t.subtareas ?? []).length) return
    ops.actualizarTarea(id, { subtareas: nuevas })
  },

  /**
   * Cierra la conversión de una subtarea: la tarea ya se ha creado desde el
   * formulario normal (con validación del usuario) y aquí sólo se guarda la
   * trazabilidad bidireccional.
   */
  marcarSubtareaConvertida(id: string, subId: string, nuevaId: string) {
    const t = estado.tareas.find((x) => x.id === id)
    const sub = (t?.subtareas ?? []).find((x) => x.id === subId)
    if (!t || !sub) return { ok: false as const, error: 'La subtarea no existe.' }
    ops.actualizarTarea(id, {
      subtareas: (t.subtareas ?? []).map((x) =>
        x.id === subId ? { ...x, convertidaEn: nuevaId } : x,
      ),
    })
    ops.actualizarTarea(nuevaId, { origenSubtareaDe: id, origenSubtareaId: subId })
    ops.registrarHistoricoTarea(id, 'Subtarea convertida', `«${sub.texto}» → ${nuevaId}.`)
    ops.registrarHistoricoTarea(nuevaId, 'Origen', `Procede de una subtarea de ${id}.`)
    return { ok: true as const }
  },

  /* ------------------- Documentos vinculados a tareas -------------- */

  /** Relación bidireccional tarea ↔ documento. Nunca duplica archivos. */
  vincularDocumentoTarea(tareaId: string, documentoId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    const d = estado.documentos.find((x) => x.id === documentoId)
    if (!t || !d) return
    ops.actualizarTarea(tareaId, {
      documentosVinculados: [...new Set([...(t.documentosVinculados ?? []), documentoId])],
    })
    ops.actualizarDocumento(documentoId, {
      tareasVinculadas: [...new Set([...(d.tareasVinculadas ?? []), tareaId])],
      ...(ESTADOS_TAREA_VIVOS.includes(t.estado) && d.estado !== 'Archivado / solo consulta'
        ? { estado: 'En tratamiento' }
        : {}),
    })
    ops.registrarHistoricoTarea(tareaId, 'Documento vinculado', d.nombre)
  },

  desvincularDocumentoTarea(tareaId: string, documentoId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    const d = estado.documentos.find((x) => x.id === documentoId)
    if (!t || !d) return
    ops.actualizarTarea(tareaId, {
      documentosVinculados: (t.documentosVinculados ?? []).filter((x) => x !== documentoId),
    })
    ops.actualizarDocumento(documentoId, {
      tareasVinculadas: (d.tareasVinculadas ?? []).filter((x) => x !== tareaId),
    })
  },

  /* --------------------------- INBOX (GTD) ------------------------- */

  /**
   * Captura rápida personal: sólo exige título. Nace sin contexto y se
   * contextualiza después; es la misma entidad TAREA, no otro tipo.
   */
  capturarEnInbox(titulo: string, mensaje = '') {
    if (!titulo.trim()) return { ok: false as const, error: 'Escribe un título.' }
    const id = ops.crearTareaRapida({
      titulo: titulo.trim(),
      responsable: estado.usuario,
      ...(mensaje.trim() ? { descripcion: mensaje.trim() } : {}),
    })
    const orden =
      estado.tareas.filter(
        (t) => t.inboxDe === estado.usuario && t.etapaInbox === 'Bandeja de entrada',
      ).length + 1
    ops.actualizarTarea(id, {
      capturada: true,
      etapaInbox: 'Bandeja de entrada',
      inboxDe: estado.usuario,
      ordenInbox: orden,
    })
    ops.registrarHistoricoTarea(id, 'Inbox', 'Captura rápida en la bandeja de entrada personal.')
    return { ok: true as const, id }
  },

  /** Mueve la tarea entre etapas del INBOX. La etapa NO es un estado. */
  moverEtapaInbox(id: string, etapa: EtapaInbox) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    const orden =
      estado.tareas.filter(
        (x) => x.inboxDe === (t.inboxDe ?? estado.usuario) && x.etapaInbox === etapa,
      ).length + 1
    ops.actualizarTarea(id, {
      etapaInbox: etapa,
      inboxDe: t.inboxDe ?? estado.usuario,
      capturada: true,
      ordenInbox: orden,
    })
    ops.registrarHistoricoTarea(id, 'Inbox', `Etapa personal: ${etapa}.`)
  },

  /** Orden manual dentro de una etapa del INBOX. */
  reordenarInbox(etapa: EtapaInbox, orden: string[]) {
    set((s) => ({
      ...s,
      tareas: s.tareas.map((t) => {
        const i = orden.indexOf(t.id)
        return i >= 0 && t.etapaInbox === etapa ? { ...t, ordenInbox: i + 1 } : t
      }),
    }))
  },

  /** La tarea sale del INBOX personal: sigue siendo la misma tarea. */
  sacarDeInbox(id: string) {
    ops.actualizarTarea(id, { capturada: undefined, etapaInbox: undefined, ordenInbox: undefined })
    ops.registrarHistoricoTarea(id, 'Inbox', 'Procesada: sale de la bandeja personal.')
  },

  /** Aclarar y decidir: la tarea deja el Inbox al quedar contextualizada. */
  procesarDeInbox(id: string, cambios: Partial<TareaOp>) {
    ops.actualizarTarea(id, {
      ...cambios,
      capturada: undefined,
      etapaInbox: undefined,
      ordenInbox: undefined,
    })
    ops.registrarHistoricoTarea(id, 'Inbox', 'Tarea aclarada y contextualizada.')
  },

  /* ------------------ Catálogo de títulos de tarea ----------------- */

  añadirTituloTarea(titulo: string) {
    const limpio = titulo.trim()
    if (!limpio) return { ok: false as const, error: 'Escribe un título.' }
    if (estado.titulosTarea.some((t) => t.toLowerCase() === limpio.toLowerCase()))
      return { ok: false as const, error: 'Ese título ya está en el catálogo.' }
    set((s) => ({ ...s, titulosTarea: [...s.titulosTarea, limpio] }))
    return { ok: true as const }
  },

  editarTituloTarea(anterior: string, nuevo: string) {
    const limpio = nuevo.trim()
    if (!limpio) return { ok: false as const, error: 'El título no puede quedar vacío.' }
    set((s) => ({ ...s, titulosTarea: s.titulosTarea.map((t) => (t === anterior ? limpio : t)) }))
    return { ok: true as const }
  },

  eliminarTituloTarea(titulo: string) {
    set((s) => ({ ...s, titulosTarea: s.titulosTarea.filter((t) => t !== titulo) }))
  },

  /* ------------------------- Orden del tablero --------------------- */

  /** Orden manual dentro de una columna: nunca se recoloca solo. */
  reordenarTablero(estadoColumna: EstadoTareaOp, orden: string[]) {
    set((s) => ({
      ...s,
      tareas: s.tareas.map((t) => {
        const i = orden.indexOf(t.id)
        return i >= 0 && t.estado === estadoColumna ? { ...t, ordenTablero: i + 1 } : t
      }),
    }))
  },

  /**
   * Cierre con calificación profesional: COMPLETAR o COMPLETAR Y MARCAR COMO
   * ACTUACIÓN. La actuación hereda título, fecha, responsable, resultado,
   * expediente, línea y documentos vinculados.
   */
  completarYMarcarActuacion(id: string, resultado?: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, motivos: ['La tarea no existe.'] }
    if (!t.expedienteId)
      return {
        ok: false as const,
        motivos: ['Sólo las tareas de un expediente generan actuación.'],
      }
    const cierre = ops.completarTarea(id, resultado)
    if (!cierre.ok) return cierre
    const actuacionId = ops.crearActuacion({
      expedienteId: t.expedienteId,
      ...(t.lineaId ? { lineaId: t.lineaId } : {}),
      tipo: 'Gestión',
      titulo: t.titulo,
      descripcion: t.descripcion ?? '',
      fecha: hoyTexto(),
      hora: '',
      fechaRegistro: ahora(),
      autor: estado.usuario,
      responsable: t.responsable,
      participantes: [],
      documentos: t.documentosVinculados ?? [],
      origenRef: { tipo: 'Tarea', id: t.id, label: t.titulo },
      estado: 'Realizada' as EstadoActuacion,
      resultado: resultado ?? t.resultado ?? '',
      proximaAccion: '',
      tiempo: t.tiempo ?? 0,
      facturable: false,
      visibleCliente: false,
      clienteInformado: false,
      esActuacion: true,
    })
    ops.actualizarTarea(id, { actuacionId })
    ops.registrarHistoricoTarea(id, 'Actuación', `Se registra la actuación ${actuacionId}.`)
    return { ok: true as const, motivos: [], actuacionId }
  },

  cancelarTarea(id: string, motivo: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (t?.esSiguienteAccion)
      ops.quitarSiguienteAccion(id, 'Cancelada: el contexto queda SIN SIGUIENTE ACCIÓN.')
    ops.actualizarTarea(id, {
      estado: 'Cancelada',
      motivoCierre: motivo,
      esperandoRespuesta: undefined,
    })
    ops.registrarHistoricoTarea(id, 'Cancelación', motivo || 'Sin motivo indicado.')
    if (t) {
      const otro = estado.usuario === t.responsable ? (t.creador ?? '') : t.responsable
      ops.notificar(otro, `Se ha cancelado «${t.titulo}»: ${motivo}`, 'Cambio', id)
    }
  },

  reasignarTarea(id: string, responsable: string, motivo = '') {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (!puedeEditarEncargo(estado, t))
      return { ok: false as const, error: 'Sólo quien encargó la tarea puede reasignarla.' }
    ops.actualizarTarea(id, { responsable, primeraApertura: undefined, fechaEnvio: ahora() })
    ops.registrarHistoricoTarea(
      id,
      'Reasignación',
      motivo || 'Cambio de responsable.',
      t.responsable,
      responsable,
    )
    ops.notificar(responsable, `Se te ha asignado «${t.titulo}».`, 'Encargo', id)
    ops.notificar(t.responsable, `«${t.titulo}» se ha reasignado a ${responsable}.`, 'Cambio', id)
    return { ok: true as const }
  },

  /* ------------------------------ Rechazo -------------------------- */

  /** El destinatario rechaza motivadamente el encargo. No lo borra ni lo cancela. */
  rechazarTarea(id: string, motivo: MotivoRechazo, explicacion: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (estado.usuario !== t.responsable)
      return { ok: false as const, error: 'Sólo el destinatario puede rechazar el encargo.' }
    if (!explicacion.trim())
      return { ok: false as const, error: 'Explica brevemente el motivo del rechazo.' }
    ops.actualizarTarea(id, {
      rechazo: {
        fecha: hoyTexto(),
        hora: hora(),
        autor: estado.usuario,
        motivo,
        explicacion: explicacion.trim(),
        resuelto: false,
      },
    })
    ops.enviarMensajeTarea(id, `Rechazo la tarea — ${motivo}: ${explicacion.trim()}`, 'sistema')
    ops.registrarHistoricoTarea(id, 'Rechazo', `${motivo}: ${explicacion.trim()}`)
    ops.notificar(
      t.creador ?? '',
      `${estado.usuario} ha rechazado «${t.titulo}»: ${motivo}.`,
      'Rechazo',
      id,
    )
    return { ok: true as const }
  },

  /** El creador actúa sobre un rechazo. La cadena nunca salta sola. */
  gestionarRechazo(
    id: string,
    accion: 'reenviar' | 'reasignar' | 'mantener' | 'saltar' | 'cancelar',
    datos: { mensaje?: string; responsable?: string; motivo?: string } = {},
  ) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (!puedeEditarEncargo(estado, t))
      return {
        ok: false as const,
        error: 'Sólo quien encargó la tarea puede gestionar el rechazo.',
      }
    const cerrar = (resolucion: string) =>
      ops.actualizarTarea(id, {
        rechazo: t.rechazo ? { ...t.rechazo, resuelto: true, resolucion } : undefined,
      })

    if (accion === 'reenviar' || accion === 'mantener') {
      cerrar(accion === 'reenviar' ? 'Reenviada con aclaración' : 'Mantenida')
      if (datos.mensaje) ops.enviarMensajeTarea(id, datos.mensaje)
      ops.registrarHistoricoTarea(
        id,
        'Gestión del rechazo',
        datos.mensaje || 'Se mantiene el encargo.',
      )
      ops.notificar(t.responsable, `El encargo «${t.titulo}» se mantiene.`, 'Cambio', id)
      return { ok: true as const }
    }
    if (accion === 'reasignar') {
      if (!datos.responsable) return { ok: false as const, error: 'Indica el nuevo responsable.' }
      cerrar(`Reasignada a ${datos.responsable}`)
      ops.reasignarTarea(id, datos.responsable, 'Reasignación tras rechazo.')
      return { ok: true as const }
    }
    if (accion === 'saltar') {
      if (!datos.motivo?.trim())
        return { ok: false as const, error: 'Saltar una fase exige motivo.' }
      cerrar('Fase saltada')
      ops.actualizarTarea(id, {
        estado: 'Cancelada',
        motivoCierre: `Fase saltada: ${datos.motivo}`,
      })
      ops.registrarHistoricoTarea(id, 'Salto de fase', datos.motivo)
      ops.activarSiguienteFase(id)
      return { ok: true as const }
    }
    cerrar('Cancelada')
    ops.cancelarFasesRestantes(id, datos.motivo || 'Cancelación tras rechazo.')
    return { ok: true as const }
  },

  /** Cancela esta fase y todas las posteriores de la cadena. */
  cancelarFasesRestantes(id: string, motivo: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    const cadena = selCadena(estado, t)
    for (const f of cadena) {
      if ((f.ordenCadena ?? 0) >= (t.ordenCadena ?? 0) && f.estado !== 'Completada')
        ops.cancelarTarea(f.id, motivo)
    }
    if (!t.cadenaId) ops.cancelarTarea(id, motivo)
  },

  /* --------------------------- Reclamación ------------------------- */

  /** Reclamación del creador o supervisor. Vive dentro de la tarea original. */
  reclamarTarea(id: string, mensaje: string, respuestaAntesDe = '') {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    const rec = {
      id: nuevoId('RT'),
      fecha: ahora(),
      autor: estado.usuario,
      destinatario: t.responsable,
      mensaje: mensaje || 'Se solicita avance de la tarea.',
    }
    ops.actualizarTarea(id, { reclamaciones: [rec, ...(t.reclamaciones ?? [])] })
    ops.enviarMensajeTarea(id, rec.mensaje, 'reclamacion')
    ops.registrarHistoricoTarea(
      id,
      'Reclamación',
      `A ${t.responsable}: ${rec.mensaje}${respuestaAntesDe ? ` · respuesta antes de ${respuestaAntesDe}` : ''}`,
    )
    ops.notificar(t.responsable, `Reclamación en «${t.titulo}».`, 'Reclamación', id)
  },

  añadirEvidenciaTarea(
    id: string,
    datos: { tipo: EvidenciaTarea['tipo']; descripcion: string; refId?: string },
  ) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    const ev: EvidenciaTarea = {
      id: nuevoId('EV'),
      fecha: hoyTexto(),
      autor: estado.usuario,
      tipo: datos.tipo,
      descripcion: datos.descripcion,
      ...(datos.refId ? { refId: datos.refId } : {}),
    }
    ops.actualizarTarea(id, { evidencias: [ev, ...(t.evidencias ?? [])] })
    ops.registrarHistoricoTarea(id, 'Evidencia', `${ev.tipo}: ${ev.descripcion}`)
  },

  /* ----------------- Recordatorios (Fechas y plazos) --------------- */

  /**
   * Crea un recordatorio de la tarea en el módulo general de fechas.
   * No hay un segundo sistema de recordatorios: es una FechaCritica de tipo
   * Recordatorio con origen en la tarea.
   */
  crearRecordatorioTarea(
    tareaId: string,
    datos: { fecha: string; hora: string; responsable?: string; titulo?: string },
  ) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (!datos.fecha.trim() || !datos.hora.trim())
      return { ok: false as const, error: 'La fecha y la hora del recordatorio son obligatorias.' }
    const responsable = datos.responsable ?? estado.usuario
    const id = ops.crearFecha({
      ...(t.expedienteId ? { expedienteId: t.expedienteId } : {}),
      ...(t.lineaId ? { lineaId: t.lineaId } : {}),
      origen: { tipo: 'Tarea', id: tareaId, label: t.titulo },
      tipo: 'Recordatorio',
      titulo: datos.titulo?.trim() || `Recordar: ${t.titulo}`,
      fecha: datos.fecha,
      hora: datos.hora,
      responsable,
      validada: false,
      criticidad: 'Media',
      avisos: 'Aviso interno en el momento',
      observaciones: `Recordatorio vinculado a la tarea ${tareaId}.`,
      resultado: '',
      sincronizadaCalendar: false,
    })
    ops.registrarHistoricoTarea(
      tareaId,
      'Recordatorio',
      `${datos.fecha} ${datos.hora} · ${responsable}`,
    )
    ops.notificar(
      responsable,
      `Recordatorio creado para «${t.titulo}» el ${datos.fecha} ${datos.hora}.`,
      'Recordatorio',
      tareaId,
      id,
    )
    return { ok: true as const, id }
  },

  atenderRecordatorio(fechaId: string) {
    const f = estado.fechas.find((x) => x.id === fechaId)
    ops.actualizarFecha(fechaId, { resultado: 'Atendido' })
    if (f?.origen?.tipo === 'Tarea')
      ops.registrarHistoricoTarea(f.origen.id, 'Recordatorio atendido', f.titulo)
  },

  posponerRecordatorio(fechaId: string, dias: number) {
    const f = estado.fechas.find((x) => x.id === fechaId)
    if (!f) return
    const nueva = sumarDiasTexto(dias)
    ops.actualizarFecha(fechaId, { fecha: nueva })
    if (f.origen?.tipo === 'Tarea')
      ops.registrarHistoricoTarea(f.origen.id, 'Recordatorio pospuesto', `${f.fecha} → ${nueva}`)
  },

  eliminarRecordatorioFecha(fechaId: string) {
    const f = estado.fechas.find((x) => x.id === fechaId)
    set((s) => ({ ...s, fechas: s.fechas.filter((x) => x.id !== fechaId) }))
    if (f?.origen?.tipo === 'Tarea')
      ops.registrarHistoricoTarea(f.origen.id, 'Recordatorio eliminado', f.titulo)
  },

  atenderRecordatorioTarea(tareaId: string, recordatorioId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t) return
    ops.actualizarTarea(tareaId, {
      recordatorios: (t.recordatorios ?? []).map((r) =>
        r.id === recordatorioId ? { ...r, atendido: true } : r,
      ),
    })
  },

  duplicarTarea(id: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return
    const {
      id: _omit,
      historico: _h,
      reclamaciones: _r,
      evidencias: _e,
      conversacion: _c,
      rechazo: _rz,
      cadenaId: _cd,
      ordenCadena: _oc,
      bloqueadaPor: _bp,
      desbloquea: _db,
      ...resto
    } = t
    return ops.crearTarea({
      ...resto,
      titulo: `${t.titulo} (copia)`,
      estado: 'En curso',
      fechaInicio: hoyTexto(),
      evidencias: [],
      reclamaciones: [],
      conversacion: [],
    })
  },

  /* -------------------------- Cadena de tareas --------------------- */

  /**
   * Añade una fase consecutiva al final de la cadena de la tarea indicada.
   * La nueva fase nace bloqueada y se activa al completarse la anterior.
   */
  añadirSiguienteTarea(
    id: string,
    datos: {
      titulo: string
      descripcion?: string
      responsable: string
      prioridad?: Prioridad
      plazoModo: 'fija' | 'dias' | 'sin'
      vencimiento?: string
      horaLimite?: string
      dias?: number
    },
  ) {
    const base = estado.tareas.find((x) => x.id === id)
    if (!base) return { ok: false as const, error: 'La tarea no existe.' }
    if (!puedeEditarEncargo(estado, base))
      return { ok: false as const, error: 'Sólo quien encargó la tarea puede encadenar fases.' }
    let cadenaId = base.cadenaId
    if (!cadenaId) {
      cadenaId = nuevoId('CAD')
      ops.actualizarTarea(base.id, { cadenaId, ordenCadena: 1 })
    }
    const cadena = estado.tareas
      .filter((x) => x.cadenaId === cadenaId)
      .sort((a, b) => (a.ordenCadena ?? 0) - (b.ordenCadena ?? 0))
    const ultima = cadena[cadena.length - 1] ?? base
    const orden = (ultima.ordenCadena ?? cadena.length) + 1
    const nueva = ops.crearTarea({
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? '',
      responsable: datos.responsable,
      colaboradores: [],
      prioridad: datos.prioridad ?? 'Media',
      estado: 'Pendiente',
      fechaInicio: '',
      vencimiento: datos.plazoModo === 'fija' ? (datos.vencimiento ?? '') : '',
      horaLimite: datos.horaLimite ?? '',
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      cadenaId,
      ordenCadena: orden,
      bloqueadaPor: ultima.id,
      plazoModo: datos.plazoModo,
      ...(datos.plazoModo === 'dias' ? { diasTrasPredecesora: datos.dias ?? 7 } : {}),
      ...(base.expedienteId ? { expedienteId: base.expedienteId } : {}),
      ...(base.lineaId ? { lineaId: base.lineaId } : {}),
    })
    ops.actualizarTarea(ultima.id, { desbloquea: nueva })
    ops.registrarHistoricoTarea(
      ultima.id,
      'Cadena',
      `Se añade la fase ${orden}: «${datos.titulo}».`,
    )
    return { ok: true as const, id: nueva }
  },

  /** Reordena las fases futuras (no activadas) de una cadena. */
  moverFaseCadena(id: string, direccion: -1 | 1) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t?.cadenaId) return { ok: false as const, error: 'La tarea no pertenece a una cadena.' }
    if (!puedeEditarEncargo(estado, t))
      return { ok: false as const, error: 'Sin permiso para reordenar la cadena.' }
    const cadena = selCadena(estado, t)
    const i = cadena.findIndex((x) => x.id === id)
    const j = i + direccion
    if (i < 0 || j < 0 || j >= cadena.length)
      return { ok: false as const, error: 'Movimiento no posible.' }
    const actual = cadena[i]
    const destino = cadena[j]
    if (!actual || !destino) return { ok: false as const, error: 'Movimiento no posible.' }
    const bloqueada = (x: TareaOp) => x.estado === 'Pendiente' && Boolean(x.bloqueadaPor)
    if (!bloqueada(actual) || !bloqueada(destino))
      return {
        ok: false as const,
        error: 'Sólo pueden reordenarse fases futuras todavía no activadas.',
      }
    const orden = [...cadena]
    orden[i] = destino
    orden[j] = actual
    ops.recablearCadena(orden)
    ops.registrarHistoricoTarea(id, 'Cadena', 'Reordenación de fases futuras.')
    return { ok: true as const }
  },

  /** Elimina una fase futura todavía no activada. */
  eliminarFaseFutura(id: string) {
    const t = estado.tareas.find((x) => x.id === id)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (!puedeEditarEncargo(estado, t))
      return { ok: false as const, error: 'Sin permiso para eliminar la fase.' }
    if (t.estado !== 'Pendiente' || !t.bloqueadaPor)
      return { ok: false as const, error: 'Sólo pueden eliminarse fases futuras no activadas.' }
    const resto = selCadena(estado, t).filter((x) => x.id !== id)
    set((s) => ({ ...s, tareas: s.tareas.filter((x) => x.id !== id) }))
    ops.recablearCadena(resto)
    return { ok: true as const }
  },

  /** Recalcula orden y enlaces de una cadena a partir de la secuencia dada. */
  recablearCadena(orden: TareaOp[]) {
    orden.forEach((t, i) => {
      const anterior = orden[i - 1]
      const siguiente = orden[i + 1]
      ops.actualizarTarea(t.id, {
        ordenCadena: i + 1,
        bloqueadaPor: anterior ? anterior.id : undefined,
        desbloquea: siguiente ? siguiente.id : undefined,
      })
    })
  },

  /* --------------------------- Fechas críticas --------------------- */

  crearFecha(data: Omit<FechaCritica, 'id'>) {
    const id = nuevoId('FC')
    set((s) => ({ ...s, fechas: [...s.fechas, { ...data, id }] }))
    auditar({
      accion: 'Alta de fecha',
      entidad: 'Fecha',
      entidadId: id,
      ...(data.expedienteId ? { expedienteId: data.expedienteId } : {}),
      anterior: '—',
      nuevo: `${data.titulo} (${data.fecha})`,
    })
    return id
  },

  actualizarFecha(id: string, cambios: Partial<FechaCritica>) {
    set((s) => ({ ...s, fechas: s.fechas.map((f) => (f.id === id ? { ...f, ...cambios } : f)) }))
  },

  validarFecha(id: string) {
    const f = estado.fechas.find((x) => x.id === id)
    if (!f) return
    ops.actualizarFecha(id, { validada: true, validadaPor: estado.usuario })
    auditar({
      accion: 'Validación de fecha',
      entidad: 'Fecha',
      entidadId: id,
      ...(f.expedienteId ? { expedienteId: f.expedienteId } : {}),
      anterior: 'Sin validar',
      nuevo: `Validada por ${estado.usuario}`,
    })
  },

  /* ------------------ FECHAS Y PLAZOS · registro temporal ------------ */

  /** Alta de cualquiera de los cuatro registros temporales. */
  crearRegistroTemporal(
    data: Partial<FechaCritica> & { registro: RegistroTemporal; titulo: string; fecha: string },
  ) {
    const tipoLegado: FechaCritica['tipo'] =
      data.registro === 'Recordatorio'
        ? 'Recordatorio'
        : data.registro === 'Evento'
          ? 'Evento o cita'
          : data.registro === 'Plazo'
            ? data.clasePlazo === 'Extrajudicial'
              ? 'Vencimiento interno'
              : 'Plazo procesal'
            : 'Fecha informativa'

    const id = ops.crearFecha({
      ...data,
      tipo: tipoLegado,
      titulo: data.titulo,
      fecha: data.fecha,
      hora: data.hora ?? '',
      responsable: data.responsable ?? estado.usuario,
      validada: data.registro === 'Plazo' ? Boolean(data.vencimientoValidado) : true,
      criticidad: data.criticidad ?? (data.critico ? 'Alta' : 'Media'),
      avisos: data.avisos ?? '',
      observaciones: data.observaciones ?? '',
      resultado: '',
      sincronizadaCalendar: data.sincronizadaCalendar ?? data.registro === 'Evento',
      estadoTemporal: data.estadoTemporal ?? 'Pendiente',
      historicoVencimiento: data.historicoVencimiento ?? [],
      aplazamientos: data.aplazamientos ?? [],
    } as Omit<FechaCritica, 'id'>)
    return id
  },

  /** Recordatorio asociado a otro registro temporal (fecha, evento o plazo). */
  añadirRecordatorioARegistro(
    padreId: string,
    datos: { fecha: string; hora?: string; titulo?: string },
  ) {
    const p = estado.fechas.find((x) => x.id === padreId)
    if (!p) return { ok: false as const, error: 'El registro no existe.' }
    const id = ops.crearRegistroTemporal({
      registro: 'Recordatorio',
      titulo: datos.titulo?.trim() || `Recordar: ${p.titulo}`,
      fecha: datos.fecha,
      hora: datos.hora ?? '',
      responsable: p.responsable,
      padreId,
      ...(p.expedienteId ? { expedienteId: p.expedienteId } : {}),
      ...(p.origen ? { origen: p.origen } : {}),
      observaciones: `Recordatorio asociado a ${p.titulo}.`,
    })
    return { ok: true as const, id }
  },

  /** Confirmación humana del vencimiento propuesto para un plazo. */
  validarVencimiento(id: string, nueva: string) {
    const f = estado.fechas.find((x) => x.id === id)
    if (!f) return
    const cambio = {
      anterior: f.fecha,
      nueva,
      momento: ahora(),
      usuario: estado.usuario,
    }
    ops.actualizarFecha(id, {
      fecha: nueva,
      vencimientoValidado: true,
      validada: true,
      validadaPor: estado.usuario,
      historicoVencimiento: [cambio, ...(f.historicoVencimiento ?? [])],
    })
    auditar({
      accion: 'Validación de vencimiento',
      entidad: 'Fecha',
      entidadId: id,
      ...(f.expedienteId ? { expedienteId: f.expedienteId } : {}),
      anterior: f.fecha || '—',
      nuevo: `${nueva} validado por ${estado.usuario}`,
    })
  },

  marcarRegistroRealizado(id: string) {
    const f = estado.fechas.find((x) => x.id === id)
    ops.actualizarFecha(id, { estadoTemporal: 'Realizado', resultado: 'Atendido' })
    if (f?.origen?.tipo === 'Tarea')
      ops.registrarHistoricoTarea(f.origen.id, 'Recordatorio atendido', f.titulo)
  },

  /** Posponer un recordatorio: sigue siendo el mismo objeto temporal. */
  posponerRegistro(id: string, minutos: number, destino?: { fecha: string; hora: string }) {
    const f = estado.fechas.find((x) => x.id === id)
    if (!f) return
    let nuevaFecha = f.fecha
    let nuevaHora = f.hora
    if (destino) {
      nuevaFecha = destino.fecha
      nuevaHora = destino.hora
    } else {
      const base = parseFecha(f.fecha) ?? new Date()
      const m = (f.hora || '09:00').match(/^(\d{1,2}):(\d{2})$/)
      base.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0)
      base.setMinutes(base.getMinutes() + minutos)
      nuevaFecha = `${String(base.getDate()).padStart(2, '0')}/${String(base.getMonth() + 1).padStart(2, '0')}/${base.getFullYear()}`
      nuevaHora = `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`
    }
    const aplazamiento = {
      fecha: f.fecha,
      hora: f.hora,
      anterior: `${f.fecha} ${f.hora}`.trim(),
      nuevo: `${nuevaFecha} ${nuevaHora}`.trim(),
      usuario: estado.usuario,
      registradoEn: ahora(),
    }
    ops.actualizarFecha(id, {
      fecha: nuevaFecha,
      hora: nuevaHora,
      estadoTemporal: 'Pospuesto',
      aplazamientos: [aplazamiento, ...(f.aplazamientos ?? [])],
    })
    if (f.origen?.tipo === 'Tarea')
      ops.registrarHistoricoTarea(
        f.origen.id,
        'Recordatorio pospuesto',
        `${aplazamiento.anterior} → ${aplazamiento.nuevo}`,
      )
  },

  /** Baja de un registro temporal. Los plazos dejan rastro en histórico. */
  eliminarRegistroTemporal(id: string) {
    const f = estado.fechas.find((x) => x.id === id)
    if (!f) return
    set((s) => ({ ...s, fechas: s.fechas.filter((x) => x.id !== id && x.padreId !== id) }))
    auditar({
      accion: 'Baja de registro temporal',
      entidad: 'Fecha',
      entidadId: id,
      ...(f.expedienteId ? { expedienteId: f.expedienteId } : {}),
      anterior: `${f.titulo} (${f.fecha})${f.critico ? ' · CRÍTICO' : ''}`,
      nuevo: 'Eliminado',
    })
    if (f.origen?.tipo === 'Tarea')
      ops.registrarHistoricoTarea(f.origen.id, 'Registro temporal eliminado', f.titulo)
  },

  /** Borra en bloque los registros marcados como demostración. */
  eliminarRegistrosDemo() {
    set((s) => ({ ...s, fechas: s.fechas.filter((f) => !f.demo) }))
  },

  /* -------------------------- Comunicaciones ----------------------- */

  crearComunicacion(data: Omit<Comunicacion, 'id'>) {
    const id = nuevoId('CM')
    set((s) => ({ ...s, comunicaciones: [{ ...data, id }, ...s.comunicaciones] }))
    auditar({
      accion: 'Registro de comunicación',
      entidad: 'Comunicación',
      entidadId: id,
      ...(data.expedienteId ? { expedienteId: data.expedienteId } : {}),
      anterior: '—',
      nuevo: data.asunto,
    })
    return id
  },

  /* ------------------- COMUNICACIONES (fase 1) --------------------- */

  /**
   * Registro único de una comunicación. Se guarda una sola vez y se muestra
   * en todos los contextos que le corresponden (contacto, lead, onboarding,
   * expediente): nunca se duplica el registro.
   */
  registrarComunicacion(datos: {
    canal: 'Email' | 'WhatsApp' | 'Llamada'
    direccion: 'Entrada' | 'Salida'
    asunto: string
    contenido?: string
    notasInternas?: string
    fecha?: string
    hora?: string
    emisor?: string
    destinatarios?: string[]
    cuenta?: string
    contactoId?: string
    leadId?: string
    onboardingId?: string
    expedienteId?: string
    origen?: OrigenRelacion
    adjuntosRef?: AdjuntoComunicacion[]
    estadoEnvio?: 'Borrador' | 'Enviado' | 'Error'
    triaje?: 'Pendiente' | 'Tratada'
    pendienteContestar?: boolean
    respuestaDe?: string
  }) {
    const id = ops.crearComunicacion({
      tipo:
        datos.canal === 'Llamada' ? 'Llamada' : datos.canal === 'WhatsApp' ? 'Mensaje' : 'Email',
      canal: datos.canal,
      direccion: datos.direccion,
      fecha: datos.fecha || hoyTexto(),
      hora: datos.hora || hora(),
      emisor: datos.emisor ?? estado.usuario,
      destinatarios: datos.destinatarios ?? [],
      participantes: [],
      asunto: datos.asunto,
      contenido: datos.contenido ?? '',
      resultado: '',
      adjuntos: [],
      proximaAccion: '',
      clienteInformado: false,
      incluibleReporte: true,
      responsable: estado.usuario,
      enviada: datos.direccion === 'Entrada',
      triaje: datos.triaje ?? (datos.direccion === 'Entrada' ? 'Pendiente' : 'Tratada'),
      ...(datos.pendienteContestar ? { pendienteContestar: true } : {}),
      ...(datos.notasInternas ? { notasInternas: datos.notasInternas } : {}),
      ...(datos.cuenta ? { cuenta: datos.cuenta } : {}),
      ...(datos.contactoId ? { contactoId: datos.contactoId } : {}),
      ...(datos.leadId ? { leadId: datos.leadId } : {}),
      ...(datos.onboardingId ? { onboardingId: datos.onboardingId } : {}),
      ...(datos.expedienteId ? { expedienteId: datos.expedienteId } : {}),
      ...(datos.origen ? { origen: datos.origen } : {}),
      ...(datos.adjuntosRef?.length ? { adjuntosRef: datos.adjuntosRef } : {}),
      ...(datos.estadoEnvio ? { estadoEnvio: datos.estadoEnvio } : {}),
      ...(datos.respuestaDe ? { respuestaDe: datos.respuestaDe } : {}),
    })
    return id
  },

  /** Actualización puntual de una comunicación ya registrada. */
  actualizarComunicacion(
    id: string,
    cambios: { [K in keyof Comunicacion]?: Comunicacion[K] | undefined },
  ) {
    set((s) => ({
      ...s,
      comunicaciones: s.comunicaciones.map((c) =>
        c.id === id ? ({ ...c, ...cambios, id } as Comunicacion) : c,
      ),
    }))
  },

  /**
   * Vinculación (o cambio de vinculación) de una comunicación a su contexto.
   * Cada comunicación se vincula individualmente; excepcionalmente puede
   * relacionarse con más de un expediente.
   */
  vincularComunicacion(
    id: string,
    ctx: {
      contactoId?: string
      leadId?: string
      onboardingId?: string
      expedienteId?: string
      expedientesRelacionados?: string[]
    },
  ) {
    const c = estado.comunicaciones.find((x) => x.id === id)
    if (!c) return
    ops.actualizarComunicacion(id, {
      contactoId: ctx.contactoId ?? c.contactoId,
      leadId: ctx.leadId,
      onboardingId: ctx.onboardingId,
      expedienteId: ctx.expedienteId,
      expedientesRelacionados: ctx.expedientesRelacionados ?? [],
    })
    auditar({
      accion: 'Vinculación de comunicación',
      entidad: 'Comunicación',
      entidadId: id,
      ...(ctx.expedienteId ? { expedienteId: ctx.expedienteId } : {}),
      anterior: c.expedienteId ?? c.leadId ?? c.onboardingId ?? 'Sin vincular',
      nuevo: ctx.expedienteId ?? ctx.leadId ?? ctx.onboardingId ?? 'Ficha de contacto',
    })
  },

  /** TRIAJE: la gestión de comunicación ya no está pendiente. */
  marcarTriada(id: string, tratada = true) {
    ops.actualizarComunicacion(id, {
      triaje: tratada ? 'Tratada' : 'Pendiente',
      ...(tratada ? { pendienteContestar: false } : {}),
    })
  },

  /** Marca la comunicación como contestada: sale del filtro «Pendientes». */
  marcarContestada(id: string) {
    ops.actualizarComunicacion(id, {
      pendienteContestar: false,
      contestadaEn: ahora(),
      triaje: 'Tratada',
    })
  },

  /** Referencia (no copia) del adjunto en el bloque documental correspondiente. */
  ubicarAdjunto(id: string, nombre: string, documentoId: string) {
    const c = estado.comunicaciones.find((x) => x.id === id)
    if (!c) return
    ops.actualizarComunicacion(id, {
      adjuntosRef: (c.adjuntosRef ?? []).map((a) =>
        a.nombre === nombre ? { ...a, documentoId } : a,
      ),
    })
  },

  /**
   * Guarda un adjunto de la comunicación EN DOCUMENTOS: el archivo vive en el
   * gestor documental y la comunicación conserva sólo la referencia. Nunca se
   * duplica el documento dentro de COMUNICACIONES.
   */
  guardarAdjuntoEnDocumentos(id: string, nombre: string, destino?: { expedienteId?: string }) {
    const c = estado.comunicaciones.find((x) => x.id === id)
    if (!c) return undefined
    const ya = (c.adjuntosRef ?? []).find((a) => a.nombre === nombre)?.documentoId
    if (ya) return ya
    const expedienteId = destino?.expedienteId ?? c.expedienteId
    const docId = ops.crearDocumento({
      nombre,
      ...(expedienteId ? { expedienteId } : {}),
      actuacionesRelacionadas: [],
      archivo: nombre,
      descripcion: `Adjunto de la comunicación ${c.id} (${c.asunto || 'sin asunto'}).`,
      tipoDocumental: 'Sin clasificar',
      origen: (c.direccion ?? 'Entrada') === 'Entrada' ? 'Recibido' : 'Elaborado por el despacho',
      autorEmisor: c.emisor || '—',
      destinatario: (c.destinatarios ?? []).join(', '),
      fechaDocumento: c.fecha,
      fechaIncorporacion: hoyTexto(),
      responsable: estado.usuario,
      estado: 'Sin clasificar',
      version: 1,
      versiones: [],
      confidencialidad: 'Normal',
      etiquetas: ['Comunicaciones'],
      observaciones: '',
      judicial: false,
      entregable: false,
      clienteInformado: false,
    })
    ops.ubicarAdjunto(id, nombre, docId)
    return docId
  },

  /** Relaciona una tarea NORMAL ya creada con la comunicación de origen. */
  vincularTareaComunicacion(id: string, tareaId: string) {
    const c = estado.comunicaciones.find((x) => x.id === id)
    if (!c) return
    ops.actualizarComunicacion(id, {
      tareasVinculadas: [...new Set([...(c.tareasVinculadas ?? []), tareaId])],
    })
  },

  /**
   * TAREA ESPECIAL «DEVOLVER LLAMADA». Usa el sistema de tareas existente:
   * sólo añade los datos de la llamada recibida.
   */
  crearTareaDevolverLlamada(datos: {
    contacto: string
    contactoId?: string
    telefono?: string
    fecha?: string
    hora?: string
    motivo?: string
    responsable?: string
    expedienteId?: string
    origen?: OrigenRelacion
    comunicacionId?: string
  }) {
    const fecha = datos.fecha || hoyTexto()
    const horaLlamada = datos.hora || hora()
    const tareaId = ops.crearTareaRapida({
      titulo: `Devolver llamada · ${datos.contacto}`,
      descripcion: [
        `Llamada recibida el ${fecha} a las ${horaLlamada}.`,
        datos.telefono ? `Teléfono: ${datos.telefono}.` : '',
        datos.motivo ? `Motivo: ${datos.motivo}` : '',
      ]
        .filter(Boolean)
        .join(' '),
      ...(datos.responsable ? { responsable: datos.responsable } : {}),
      ...(datos.expedienteId ? { expedienteId: datos.expedienteId } : {}),
      ...(datos.origen ? { origen: datos.origen } : {}),
      vencimiento: fecha,
    })
    ops.actualizarTarea(tareaId, {
      plantilla: 'Devolver llamada',
      devolverLlamada: {
        contacto: datos.contacto,
        ...(datos.contactoId ? { contactoId: datos.contactoId } : {}),
        ...(datos.telefono ? { telefono: datos.telefono } : {}),
        fecha,
        hora: horaLlamada,
        ...(datos.motivo ? { motivo: datos.motivo } : {}),
        ...(datos.comunicacionId ? { comunicacionId: datos.comunicacionId } : {}),
      },
    })
    ops.actualizarTarea(tareaId, {
      especial: {
        tipo: 'Comunicación',
        canal: 'Llamada',
        contacto: datos.contacto,
        ...(datos.contactoId ? { contactoId: datos.contactoId } : {}),
        ...(datos.telefono ? { destino: datos.telefono } : {}),
        ...(datos.comunicacionId ? { comunicacionId: datos.comunicacionId } : {}),
      },
    })
    if (datos.comunicacionId) {
      ops.vincularTareaComunicacion(datos.comunicacionId, tareaId)
      ops.actualizarComunicacion(datos.comunicacionId, { tareaEspecialId: tareaId })
    }
    return tareaId
  },

  /* ---------------- TAREA ESPECIAL DE COMUNICACIÓN ------------------- */

  /**
   * Crea una TAREA ESPECIAL DE COMUNICACIÓN. Es una TAREA normal del sistema
   * existente (mismo modelo, mismo tablero, mismos estados) con el bloque
   * `especial` que la identifica y enlaza con la comunicación original.
   *
   * Sólo debe usarse cuando lo que hay que hacer es COMUNICAR. Si el encargo
   * es trabajo jurídico u operativo, se crea una tarea normal.
   */
  crearTareaEspecialComunicacion(datos: {
    canal: 'Email' | 'WhatsApp' | 'Llamada'
    titulo?: string
    indicaciones?: string
    responsable?: string
    vencimiento?: string
    comunicacionId?: string
    contactoId?: string
    contacto?: string
    destino?: string
    leadId?: string
    onboardingId?: string
    expedienteId?: string
    origen?: OrigenRelacion
  }) {
    const accion =
      datos.canal === 'Llamada'
        ? 'Devolver llamada'
        : datos.canal === 'WhatsApp'
          ? 'Responder WhatsApp'
          : 'Contestar email'
    const tareaId = ops.crearTareaRapida({
      titulo: datos.titulo?.trim() || `${accion} · ${datos.contacto ?? 'contacto'}`,
      ...(datos.indicaciones ? { descripcion: datos.indicaciones } : {}),
      ...(datos.responsable ? { responsable: datos.responsable } : {}),
      ...(datos.vencimiento ? { vencimiento: datos.vencimiento } : {}),
      ...(datos.expedienteId ? { expedienteId: datos.expedienteId } : {}),
      ...(datos.origen ? { origen: datos.origen } : {}),
    })
    ops.actualizarTarea(tareaId, {
      plantilla: `Tarea especial · Comunicación (${datos.canal})`,
      especial: {
        tipo: 'Comunicación',
        canal: datos.canal,
        ...(datos.comunicacionId ? { comunicacionId: datos.comunicacionId } : {}),
        ...(datos.contactoId ? { contactoId: datos.contactoId } : {}),
        ...(datos.contacto ? { contacto: datos.contacto } : {}),
        ...(datos.destino ? { destino: datos.destino } : {}),
      },
    })
    if (datos.comunicacionId) {
      ops.vincularTareaComunicacion(datos.comunicacionId, tareaId)
      ops.actualizarComunicacion(datos.comunicacionId, { tareaEspecialId: tareaId })
    }
    ops.registrarHistoricoTarea(
      tareaId,
      'Apertura',
      `Tarea especial de comunicación (${datos.canal}).`,
    )
    return tareaId
  },

  /**
   * CONTESTADO: resuelve la tarea especial de comunicación y, si procede, la
   * comunicación original deja de estar pendiente. Es el mismo cierre de
   * cualquier tarea: no hay un segundo sistema de estados.
   */
  contestarTareaComunicacion(
    tareaId: string,
    datos?: { nota?: string; respuestaComunicacionId?: string },
  ) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.especial) return { ok: false as const, motivos: ['No es una tarea especial.'] }
    ops.actualizarTarea(tareaId, {
      especial: {
        ...t.especial,
        contestadoEn: ahora(),
        contestadoPor: estado.usuario,
        ...(datos?.respuestaComunicacionId
          ? { respuestaComunicacionId: datos.respuestaComunicacionId }
          : {}),
      },
    })
    if (t.especial.comunicacionId) ops.marcarContestada(t.especial.comunicacionId)
    const r = ops.completarTarea(tareaId, datos?.nota || 'Comunicación contestada.')
    if (r.ok)
      ops.registrarHistoricoTarea(tareaId, 'Cierre', 'CONTESTADO: la comunicación queda resuelta.')
    return r
  },

  /* ------------------ TAREA ESPECIAL DE REUNIÓN ---------------------- */

  /**
   * Crea la REUNIÓN. Es una TAREA del sistema existente con el bloque
   * `reunion`: misma pieza durante todo el ciclo, mismo tablero, mismos
   * estados de tarea. Nace siempre en PREPARACIÓN.
   */
  crearTareaReunion(datos: {
    tipo: string
    conQuien: string
    objeto: string
    responsable?: string
    duracionEstimada?: string
    preferenciasFecha?: string
    preferenciasLugar?: string
    preferenciaFechaValor?: string
    franja?: FranjaReunion
    direccion?: string
    indicaciones?: string
    asistentes?: { nombre: string; clase: AsistenteReunion['clase']; rol?: string }[]
    expedienteId?: string
    lineaId?: string
    origen?: OrigenRelacion
  }) {
    const tareaId = ops.crearTareaRapida({
      titulo: `Reunión · ${datos.objeto || datos.conQuien}`,
      ...(datos.indicaciones ? { descripcion: datos.indicaciones } : {}),
      ...(datos.responsable ? { responsable: datos.responsable } : {}),
      ...(datos.expedienteId ? { expedienteId: datos.expedienteId } : {}),
      ...(datos.lineaId ? { lineaId: datos.lineaId } : {}),
      ...(datos.origen ? { origen: datos.origen } : {}),
    })
    const reunion: DatosReunion = {
      estado: 'Preparación',
      tipo: datos.tipo,
      conQuien: datos.conQuien,
      objeto: datos.objeto,
      ...(datos.duracionEstimada ? { duracionEstimada: datos.duracionEstimada } : {}),
      ...(datos.preferenciasFecha ? { preferenciasFecha: datos.preferenciasFecha } : {}),
      ...(datos.preferenciasLugar ? { preferenciasLugar: datos.preferenciasLugar } : {}),
      ...(datos.preferenciaFechaValor
        ? { preferenciaFechaValor: datos.preferenciaFechaValor }
        : {}),
      ...(datos.franja ? { franja: datos.franja } : {}),
      ...(datos.direccion ? { direccion: datos.direccion } : {}),
      ...(datos.indicaciones ? { indicaciones: datos.indicaciones } : {}),
      asistentes: (datos.asistentes ?? []).map((a, i) => ({
        id: `AS-${Date.now()}-${i}`,
        nombre: a.nombre,
        clase: a.clase,
        ...(a.rol ? { rol: a.rol } : {}),
      })),
      preparacion: [],
      notas: [],
      notasIds: [],
    }
    ops.actualizarTarea(tareaId, {
      plantilla: 'Tarea especial · Reunión',
      especial: { tipo: 'Reunión' },
      reunion,
    })
    ops.registrarHistoricoTarea(tareaId, 'Apertura', 'Tarea especial de reunión: PREPARACIÓN.')
    return tareaId
  },

  actualizarReunion(tareaId: string, cambios: Partial<DatosReunion>) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarTarea(tareaId, { reunion: { ...t.reunion, ...cambios } })
  },

  añadirNotaReunion(tareaId: string, texto: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion || !texto.trim()) return
    const nota = {
      id: `NR-${Date.now()}`,
      texto: texto.trim(),
      autor: estado.usuario,
      fecha: hoyTexto(),
      hora: hora(),
      etapa: t.reunion.estado,
    }
    ops.actualizarReunion(tareaId, { notas: [...t.reunion.notas, nota] })
  },

  añadirPuntoPreparacion(
    tareaId: string,
    punto: { clase: PuntoPreparacion['clase']; texto: string },
  ) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion || !punto.texto.trim()) return
    ops.actualizarReunion(tareaId, {
      preparacion: [
        ...t.reunion.preparacion,
        {
          id: `PR-${Date.now()}`,
          clase: punto.clase,
          texto: punto.texto.trim(),
          hecho: false,
          autor: estado.usuario,
          fecha: hoyTexto(),
        },
      ],
    })
  },

  alternarPuntoPreparacion(tareaId: string, puntoId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, {
      preparacion: t.reunion.preparacion.map((p) =>
        p.id === puntoId ? { ...p, hecho: !p.hecho } : p,
      ),
    })
  },

  eliminarPuntoPreparacion(tareaId: string, puntoId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, {
      preparacion: t.reunion.preparacion.filter((p) => p.id !== puntoId),
    })
  },

  añadirAsistenteReunion(
    tareaId: string,
    a: { nombre: string; clase: AsistenteReunion['clase']; rol?: string; contactoId?: string },
  ) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion || !a.nombre.trim()) return
    ops.actualizarReunion(tareaId, {
      asistentes: [
        ...t.reunion.asistentes,
        {
          id: `AS-${Date.now()}`,
          nombre: a.nombre.trim(),
          clase: a.clase,
          ...(a.rol ? { rol: a.rol } : {}),
          ...(a.contactoId ? { contactoId: a.contactoId } : {}),
        },
      ],
    })
    if (a.clase !== 'Externo')
      ops.notificar(
        a.nombre.trim(),
        `Te han invitado a una reunión: «${t.titulo}».`,
        'Encargo',
        tareaId,
      )
  },

  eliminarAsistenteReunion(tareaId: string, asistenteId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, {
      asistentes: t.reunion.asistentes.filter((a) => a.id !== asistenteId),
    })
  },

  /** CON QUIÉN: sustituye por completo la lista de participantes. */
  fijarParticipantesReunion(
    tareaId: string,
    participantes: {
      nombre: string
      clase: AsistenteReunion['clase']
      rol?: string
      contactoId?: string
    }[],
  ) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    const previos = t.reunion.asistentes
    ops.actualizarReunion(tareaId, {
      asistentes: participantes.map((p, i) => {
        const anterior = previos.find(
          (a) => (p.contactoId && a.contactoId === p.contactoId) || a.nombre === p.nombre,
        )
        return {
          ...anterior,
          id: anterior?.id ?? `AS-${Date.now()}-${i}`,
          nombre: p.nombre,
          clase: p.clase,
          ...(p.rol ? { rol: p.rol } : {}),
          ...(p.contactoId ? { contactoId: p.contactoId } : {}),
        }
      }),
      conQuien: participantes.map((p) => p.nombre).join(', '),
    })
  },

  /** Vincula a la reunión una nota del sistema general de NOTAS. */
  vincularNotaReunion(tareaId: string, notaId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, {
      notasIds: [...new Set([...(t.reunion.notasIds ?? []), notaId])],
    })
  },

  confirmarAsistenteReunion(tareaId: string, asistenteId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, {
      asistentes: t.reunion.asistentes.map((a) =>
        a.id === asistenteId ? { ...a, confirmado: !a.confirmado } : a,
      ),
    })
  },

  /** PREPARACIÓN → AGENDADA. Crea el EVENTO en el repositorio temporal. */
  agendarReunion(tareaId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return { ok: false as const, motivos: ['No es una reunión.'] }
    const r = t.reunion
    const motivos: string[] = []
    if (!r.fecha) motivos.push('Falta el día.')
    if (!r.hora) motivos.push('Falta la hora.')
    if (!r.lugar && !r.enlace) motivos.push('Falta el lugar o el enlace.')
    if (motivos.length) return { ok: false as const, motivos }
    const { fecha, hora } = r
    if (!fecha || !hora) return { ok: false as const, motivos: ['Falta fecha u hora.'] }

    const fechaId = ops.crearRegistroTemporal({
      registro: 'Evento',
      titulo: `Reunión · ${r.objeto || r.conQuien}`,
      fecha,
      hora,
      responsable: t.responsable,
      ...(t.expedienteId ? { expedienteId: t.expedienteId } : {}),
      origen: { tipo: 'Tarea', id: tareaId, label: t.titulo },
      observaciones: [
        r.modalidad ? `Modalidad: ${r.modalidad}.` : '',
        r.lugar ? `Lugar: ${r.lugar}.` : '',
        r.enlace ? `Enlace: ${r.enlace}` : '',
      ]
        .filter(Boolean)
        .join(' '),
      sincronizadaCalendar: true,
    })

    ops.actualizarReunion(tareaId, {
      estado: 'Agendada',
      agendadaEn: ahora(),
      fechaCriticaId: fechaId,
      asistentes: r.asistentes.map((a) => ({ ...a, calendar: true })),
    })
    ops.actualizarTarea(tareaId, { vencimiento: fecha, horaLimite: hora })
    ops.registrarHistoricoTarea(
      tareaId,
      'Reunión',
      `AGENDADA para el ${r.fecha} a las ${r.hora}. Reflejada en el calendario del despacho.`,
    )
    return { ok: true as const, fechaId }
  },

  /** AGENDADA → EN REUNIÓN. Arranca el cómputo de duración real. */
  comenzarReunion(tareaId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, { estado: 'En reunión', inicioReal: ahora() })
    if (t.estado === 'Pendiente') ops.cambiarEstadoTarea(tareaId, 'En curso')
    ops.registrarHistoricoTarea(tareaId, 'Reunión', `COMENZADA a las ${hora()}.`)
  },

  /** EN REUNIÓN → FINALIZADA. Guarda duración real frente a la programada. */
  finalizarReunion(tareaId: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    // Duración real medida por reloj de pared (hora de inicio → hora de fin).
    const minutosDe = (hhmm: string) => {
      const [h, m] = hhmm.split(':')
      return Number(h) * 60 + Number(m)
    }
    const inicio = t.reunion.inicioReal ? minutosDe(t.reunion.inicioReal.slice(-5)) : null
    const minutos = inicio === null ? 0 : Math.max(0, minutosDe(hora()) - inicio)
    ops.actualizarReunion(tareaId, {
      estado: 'Finalizada',
      finReal: ahora(),
      duracionRealMin: minutos,
    })
    ops.registrarHistoricoTarea(tareaId, 'Reunión', `FINALIZADA. Duración real: ${minutos} min.`)
  },

  reprogramarReunion(tareaId: string, motivo: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, { estado: 'Preparación', motivo, fecha: '', hora: '' })
    ops.registrarHistoricoTarea(tareaId, 'Reunión', `REPROGRAMADA: ${motivo}`)
  },

  cancelarReunion(tareaId: string, motivo: string, noCelebrada = false) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t?.reunion) return
    ops.actualizarReunion(tareaId, {
      estado: noCelebrada ? 'No celebrada' : 'Cancelada',
      motivo,
    })
    ops.registrarHistoricoTarea(
      tareaId,
      'Reunión',
      `${noCelebrada ? 'NO CELEBRADA' : 'CANCELADA'}: ${motivo}`,
    )
  },

  /* ------------------ Emails redactados desde una tarea -------------- */

  /**
   * Guarda (o actualiza) el borrador de email de una tarea. Es el MISMO
   * registro del módulo COMUNICACIONES: no se crea ninguna tabla paralela ni
   * se duplican los contactos, de los que sólo se conserva la dirección usada.
   */
  guardarBorradorEmail(
    tareaId: string,
    datos: {
      comunicacionId?: string
      para: DestinatarioEmail[]
      copia?: DestinatarioEmail[]
      copiaOculta?: DestinatarioEmail[]
      asunto: string
      cuerpo: string
      remitente?: string
    },
  ) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t) return { ok: false as const, error: 'La tarea no existe.' }
    if (!puedeRedactarEmail(estado, t))
      return {
        ok: false as const,
        error: 'No tienes permiso para enviar comunicaciones de esta tarea.',
      }

    const base = {
      ...(t.expedienteId ? { expedienteId: t.expedienteId } : {}),
      ...(t.lineaId ? { lineaId: t.lineaId } : {}),
      origen: { tipo: 'Tarea' as const, id: tareaId, label: t.titulo },
      tareaId,
      tipo: 'Comunicación con tercero',
      canal: 'Email',
      emisor: datos.remitente ?? estado.usuario,
      remitente: datos.remitente ?? estado.usuario,
      destinatarios: datos.para.map((d) => `${d.nombre} <${d.email}>`),
      para: datos.para,
      copia: datos.copia ?? [],
      copiaOculta: datos.copiaOculta ?? [],
      participantes: [estado.usuario],
      asunto: datos.asunto,
      contenido: datos.cuerpo,
      resultado: '',
      adjuntos: [],
      proximaAccion: '',
      clienteInformado: false,
      incluibleReporte: true,
      responsable: estado.usuario,
      enviada: false,
      estadoEnvio: 'Borrador' as const,
    }

    if (datos.comunicacionId) {
      const id = datos.comunicacionId
      set((s) => ({
        ...s,
        comunicaciones: s.comunicaciones.map((c) =>
          c.id === id ? { ...c, ...base, id, fecha: c.fecha, hora: c.hora } : c,
        ),
      }))
      ops.registrarHistoricoTarea(tareaId, 'Borrador de email', `${datos.asunto} · ${id}`)
      return { ok: true as const, id }
    }

    const id = ops.crearComunicacion({ ...base, fecha: hoyTexto(), hora: hora() })
    ops.registrarHistoricoTarea(
      tareaId,
      'Borrador de email',
      `${datos.asunto} · ${base.destinatarios.join(', ') || 'sin destinatario'}`,
    )
    return { ok: true as const, id }
  },

  /**
   * Registra el desenlace real del envío. Sólo se marca "Enviado" cuando el
   * proveedor lo confirma: nunca se simula un envío correcto.
   */
  registrarEnvioEmail(
    comunicacionId: string,
    resultado:
      | { ok: true; mensajeId?: string; conversacionId?: string }
      | { ok: false; error: string },
  ) {
    const c = estado.comunicaciones.find((x) => x.id === comunicacionId)
    if (!c) return
    const cambios: Partial<Comunicacion> = resultado.ok
      ? {
          estadoEnvio: 'Enviado',
          enviada: true,
          enviadoEn: ahora(),
          ...(resultado.mensajeId ? { mensajeId: resultado.mensajeId } : {}),
          ...(resultado.conversacionId ? { conversacionId: resultado.conversacionId } : {}),
        }
      : { estadoEnvio: 'Error', enviada: false, errorEnvio: resultado.error }
    set((s) => ({
      ...s,
      comunicaciones: s.comunicaciones.map((x) =>
        x.id === comunicacionId ? { ...x, ...cambios } : x,
      ),
    }))
    if (!c.tareaId) return
    if (resultado.ok) {
      ops.registrarHistoricoTarea(
        c.tareaId,
        'Email enviado',
        `${c.asunto} · ${c.destinatarios.join(', ')} · ${ahora()}`,
      )
      const t = estado.tareas.find((x) => x.id === c.tareaId)
      // Aviso sólo a la otra parte del encargo; nunca al propio remitente.
      if (t)
        ops.notificar(
          t.responsable === estado.usuario ? (t.creador ?? '') : t.responsable,
          `Se ha enviado un email relacionado con «${t.titulo}».`,
          'Mensaje',
          t.id,
        )
    } else {
      ops.registrarHistoricoTarea(c.tareaId, 'Error de envío', `${c.asunto} · ${resultado.error}`)
      ops.notificar(
        estado.tareas.find((x) => x.id === c.tareaId)?.responsable ?? '',
        `Error al enviar un email de la tarea: ${resultado.error}`,
        'Mensaje',
        c.tareaId,
      )
    }
  },

  /** Señal operativa "Esperando respuesta externa". No es un estado ni columna. */
  marcarEsperandoRespuesta(tareaId: string, activo: boolean, comunicacionId?: string) {
    const t = estado.tareas.find((x) => x.id === tareaId)
    if (!t) return
    if (activo) {
      ops.actualizarTarea(tareaId, {
        esperandoRespuesta: { desde: ahora(), ...(comunicacionId ? { comunicacionId } : {}) },
      })
      ops.registrarHistoricoTarea(tareaId, 'Esperando respuesta externa', `Activada el ${ahora()}.`)
    } else {
      ops.actualizarTarea(tareaId, { esperandoRespuesta: undefined })
      ops.registrarHistoricoTarea(tareaId, 'Esperando respuesta externa', 'Señal retirada.')
    }
  },

  crearInterviniente(data: Omit<IntervinienteOp, 'id'>) {
    const id = nuevoId('IN')
    set((s) => ({ ...s, intervinientes: [...s.intervinientes, { ...data, id }] }))
    auditar({
      expedienteId: data.expedienteId,
      entidad: 'Interviniente',
      entidadId: id,
      accion: 'Interviniente vinculado',
      anterior: '—',
      nuevo: `${data.rol}: ${data.nombre}`,
    })
    return id
  },

  /**
   * Desvincula al interviniente del expediente. No borra la persona ni su ficha
   * de contactos: sólo elimina la relación y deja constancia en el histórico.
   */
  desvincularInterviniente(id: string, motivo?: string) {
    const i = estado.intervinientes.find((x) => x.id === id)
    set((s) => ({ ...s, intervinientes: s.intervinientes.filter((x) => x.id !== id) }))
    if (i)
      auditar({
        expedienteId: i.expedienteId,
        entidad: 'Interviniente',
        entidadId: id,
        accion: 'Interviniente desvinculado del expediente',
        anterior: `${i.rol}: ${i.nombre}`,
        nuevo: motivo?.trim() ? `Desvinculado — ${motivo.trim()}` : 'Desvinculado',
      })
  },

  /* ------------------------------ Vistas --------------------------- */

  guardarVista(v: Omit<VistaGuardada, 'id'>) {
    const id = `v-${Date.now()}`
    set((s) => ({ ...s, vistas: [...s.vistas, { ...v, id }] }))
    return id
  },

  eliminarVista(id: string) {
    set((s) => ({ ...s, vistas: s.vistas.filter((v) => v.id !== id) }))
  },

  reiniciar() {
    set(() => semilla())
  },
}

export type { Dependencia }
