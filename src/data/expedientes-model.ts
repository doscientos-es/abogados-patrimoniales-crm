// Modelo operativo de expedientes: entidades independientes y relacionadas
// (expediente, línea de trabajo, ejecución, actuación, documento, tarea,
// fecha crítica, comunicación, interviniente, auditoría).
//
// Punto de extensión: este módulo sólo define tipos, catálogos y semilla de
// demostración. La persistencia vive en `src/lib/expedientes-store.ts` y podrá
// sustituirse por Lovable Cloud sin tocar las pantallas.

import { EXPEDIENTES as EXPEDIENTES_CRM, nombreContacto, type Prioridad } from '@/data/crm'
import { hoyTexto, sumarDias } from '@/data/pipeline'

/* ------------------------------------------------------------------ */
/* Catálogos transversales                                             */
/* ------------------------------------------------------------------ */

export type Naturaleza = 'Judicial' | 'Extrajudicial'

export const ESTADOS_GENERALES = [
  'Activo',
  'En espera',
  'Aparcado',
  'Cierre pendiente',
  'Cerrado',
] as const
export type EstadoGeneral = (typeof ESTADOS_GENERALES)[number]

export const DEPENDENCIAS = [
  'Debemos actuar nosotros',
  'Pendiente del cliente',
  'Pendiente del contrario',
  'Pendiente del abogado contrario',
  'Pendiente del procurador',
  'Pendiente del juzgado',
  'Pendiente de notaría',
  'Pendiente de perito',
  'Pendiente del Registro',
  'Pendiente de Administración',
  'Pendiente de otro tercero',
  'Sin dependencia definida',
  'Sin acción inmediata',
] as const

export type Dependencia = (typeof DEPENDENCIAS)[number]

export type Tono = 'neutro' | 'exito' | 'aviso' | 'riesgo' | 'info'

/* --- Megafases: columna vertebral conceptual de toda la Suite ------ */

export type MegafaseId = 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'especial'

export type Megafase = {
  id: MegafaseId
  codigo: string
  nombre: string
  descripcion: string
  /** Clase de color estable definida en src/styles.css */
  clase: string
}

export const MEGAFASES: Megafase[] = [
  {
    id: 'f1',
    codigo: 'F1',
    nombre: 'LEAD',
    descripcion: 'Captación y oportunidad comercial (módulo CRM).',
    clase: 'mf-f1',
  },
  {
    id: 'f2',
    codigo: 'F2',
    nombre: 'ONBOARDING',
    descripcion: 'Aceptación, presupuesto, contratación y apertura.',
    clase: 'mf-f2',
  },
  {
    id: 'f3',
    codigo: 'F3',
    nombre: 'CASEWORK',
    descripcion: 'Trabajo técnico del expediente.',
    clase: 'mf-f3',
  },
  {
    id: 'f4',
    codigo: 'F4',
    nombre: 'DELIVERY',
    descripcion: 'Entrega, propuesta y formalización.',
    clase: 'mf-f4',
  },
  {
    id: 'f5',
    codigo: 'F5',
    nombre: 'OFFBOARDING',
    descripcion: 'Cierre del encargo y traspaso.',
    clase: 'mf-f5',
  },
  {
    id: 'f6',
    codigo: 'F6',
    nombre: 'AFTERCARE',
    descripcion: 'Cumplimiento, seguimiento y archivo.',
    clase: 'mf-f6',
  },
  {
    id: 'especial',
    codigo: '—',
    nombre: 'SITUACIÓN ESPECIAL',
    descripcion: 'Fuera del recorrido ordinario.',
    clase: 'mf-especial',
  },
]

export const megafase = (id: MegafaseId): Megafase => {
  const encontrada = MEGAFASES.find((m) => m.id === id) ?? MEGAFASES.at(-1)
  if (!encontrada) throw new Error('El catálogo de megafases no puede estar vacío.')
  return encontrada
}

/** Megafases aplicables al módulo Control de expedientes. */
export const MEGAFASES_EXPEDIENTE: MegafaseId[] = ['f3', 'f4', 'f5', 'f6']

export type ColumnaKanban = { id: string; nombre: string; tono: Tono; megafase?: MegafaseId }

/**
 * Itinerario judicial definitivo (F3–F6 + situación especial).
 */
export const ITINERARIO_JUDICIAL_PROVISIONAL = false

export const FASES_JUDICIAL: ColumnaKanban[] = [
  {
    id: 'diagnostico',
    nombre: 'Diagnóstico – Objetivos – Estrategia procesal',
    tono: 'info',
    megafase: 'f3',
  },
  { id: 'revision', nombre: 'Revisión y decisión', tono: 'info', megafase: 'f3' },
  {
    id: 'preparacion',
    nombre: 'Preparación y primeras actuaciones procesales',
    tono: 'info',
    megafase: 'f3',
  },
  { id: 'procedimiento', nombre: 'Procedimiento en curso', tono: 'info', megafase: 'f3' },
  { id: 'resolucion', nombre: 'Resolución / Resultado procesal', tono: 'info', megafase: 'f4' },
  {
    id: 'firmeza',
    nombre: 'Firmeza y actuaciones posteriores al resultado',
    tono: 'info',
    megafase: 'f4',
  },
  {
    id: 'cierre-procedimiento',
    nombre: 'Cierre del procedimiento / Traspaso',
    tono: 'aviso',
    megafase: 'f5',
  },
  { id: 'liquidacion', nombre: 'Liquidación económica', tono: 'aviso', megafase: 'f5' },
  { id: 'cumplimiento', nombre: 'Cumplimiento / En ejecución', tono: 'info', megafase: 'f6' },
  { id: 'finalizado', nombre: 'Finalizado / Archivado', tono: 'exito', megafase: 'f6' },
  { id: 'aparcado', nombre: 'Suspendido / Aparcado', tono: 'neutro', megafase: 'especial' },
]

export const FASES_EXTRAJUDICIAL: ColumnaKanban[] = [
  {
    id: 'diagnostico',
    nombre: 'Diagnóstico – Objetivos – Estrategia',
    tono: 'info',
    megafase: 'f3',
  },
  { id: 'revision', nombre: 'Revisión y decisión', tono: 'info', megafase: 'f3' },
  { id: 'preparacion', nombre: 'Preparación y primeras actuaciones', tono: 'info', megafase: 'f3' },
  { id: 'en-curso', nombre: 'En curso', tono: 'info', megafase: 'f3' },
  { id: 'propuesta', nombre: 'Propuesta o borrador', tono: 'info', megafase: 'f4' },
  { id: 'formalizacion', nombre: 'Formalización y firma', tono: 'info', megafase: 'f4' },
  { id: 'cierre-encargo', nombre: 'Cierre del encargo / Traspaso', tono: 'aviso', megafase: 'f5' },
  { id: 'liquidacion', nombre: 'Liquidación económica', tono: 'aviso', megafase: 'f5' },
  { id: 'cumplimiento', nombre: 'Cumplimiento / En ejecución', tono: 'info', megafase: 'f6' },
  { id: 'finalizado', nombre: 'Finalizado / Archivado', tono: 'exito', megafase: 'f6' },
  { id: 'aparcado', nombre: 'Suspendido / Aparcado', tono: 'neutro', megafase: 'especial' },
]

/** Fases cuyo destino es la nueva columna "Liquidación económica". */
export const FASE_LIQUIDACION = 'liquidacion'

/**
 * Equivalencias del itinerario extrajudicial anterior. No se modifica ni se
 * borra ningún dato: la fase histórica se traduce al leerla.
 */
const EQUIVALENCIAS_EXTRAJUDICIAL: Record<string, string> = {
  documentacion: 'preparacion',
  elaboracion: 'revision',
  negociacion: 'en-curso',
  'pendiente-despacho': 'en-curso',
  'espera-tercero': 'en-curso',
  ejecucion: 'cumplimiento',
  cierre: 'cierre-encargo',
  cerrado: 'finalizado',
}

/**
 * Equivalencias del itinerario judicial anterior. Migración segura y
 * reversible: la fase antigua se conserva en auditoría y se traduce al leerla.
 */
const EQUIVALENCIAS_JUDICIAL: Record<string, string> = {
  'analisis-diagnostico': 'diagnostico',
  'diagnostico-judicial': 'diagnostico',
  designa: 'preparacion',
  'designa-traspaso': 'preparacion',
  formalizacion: 'preparacion',
  'cita-formalizacion': 'preparacion',
  documentacion: 'preparacion',
  evolucion: 'procedimiento',
  'en-marcha': 'procedimiento',
  negociacion: 'procedimiento',
  'pendiente-despacho': 'procedimiento',
  'espera-tercero': 'procedimiento',
  'requiere-accion': 'procedimiento',
  'requiere-accion-en-marcha': 'procedimiento',
  entregable: 'resolucion',
  'requiere-accion-ejecucion': 'cumplimiento',
  ejecucion: 'cumplimiento',
  cierre: 'cierre-procedimiento',
  cerrado: 'finalizado',
}

/** Fases antiguas que implicaban el indicador transversal "Requiere acción". */
const FASES_REQUIERE_ACCION = new Set([
  'pendiente-despacho',
  'requiere-accion',
  'requiere-accion-en-marcha',
  'requiere-accion-ejecucion',
])

export const requiereAccionLegado = (fase: string) => FASES_REQUIERE_ACCION.has(fase)

export const columnasDe = (n: Naturaleza) =>
  n === 'Judicial' ? FASES_JUDICIAL : FASES_EXTRAJUDICIAL

/** Traduce una fase histórica a la fase vigente del itinerario. */
export const faseVigente = (n: Naturaleza, id: string) => {
  const cols = columnasDe(n)
  if (cols.some((c) => c.id === id)) return id
  const mapa = n === 'Judicial' ? EQUIVALENCIAS_JUDICIAL : EQUIVALENCIAS_EXTRAJUDICIAL
  const equivalente = mapa[id]
  if (equivalente) return equivalente
  const primeraColumna = cols[0]
  if (!primeraColumna) throw new Error(`No hay fases configuradas para ${n}.`)
  return primeraColumna.id
}

export const columnaDe = (n: Naturaleza, id: string) =>
  columnasDe(n).find((c) => c.id === faseVigente(n, id))

export const nombreFase = (n: Naturaleza, id: string) => columnaDe(n, id)?.nombre ?? id

export const megafaseDe = (n: Naturaleza, id: string): MegafaseId =>
  columnaDe(n, id)?.megafase ?? 'especial'

/** Agrupa columnas consecutivas por megafase para las bandas superiores. */
export const bandasDe = (n: Naturaleza) => {
  const grupos: { megafase: MegafaseId; columnas: ColumnaKanban[] }[] = []
  for (const c of columnasDe(n)) {
    const mf = c.megafase
    if (!mf || mf === 'especial') continue
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.megafase === mf) ultimo.columnas.push(c)
    else grupos.push({ megafase: mf, columnas: [c] })
  }
  return grupos
}

export const columnasEspeciales = (n: Naturaleza) =>
  columnasDe(n).filter((c) => c.megafase === 'especial')

export const ESTADOS_OPERATIVOS_EXP = [
  'En curso',
  'En espera',
  'Bloqueado',
  'Pendiente de revisión',
  'Pendiente de informar al cliente',
  'Sin actividad',
] as const
export type EstadoOperativoExp = (typeof ESTADOS_OPERATIVOS_EXP)[number]

/* ------------------------------------------------------------------ */
/* Entidades                                                           */
/* ------------------------------------------------------------------ */

export type ExpedienteOp = {
  id: string
  codigo: string
  nombre: string
  contactoId: string
  otrosClientes: string[]
  responsable: string
  equipo: string[]
  area: string
  tipoAsunto: string
  naturaleza: Naturaleza
  estadoGeneral: EstadoGeneral
  fase: string
  estadoOperativo: EstadoOperativoExp
  dondeEstamos: string
  proximaAccion: string
  dependencia: Dependencia
  prioridad: Prioridad
  carga: 'Ligera' | 'Media' | 'Alta'
  fechaApertura: string
  fechaCierre?: string
  presupuestoId?: string
  oportunidadId?: string
  procedimiento?: {
    organo: string
    autos: string
    nig: string
    tipo: string
    procurador: string
  }
  ultimoMovimiento: string
  tiempoRegistrado: number // horas
  /** Indicador operativo transversal: no es una fase. */
  requiereAccion?: boolean
  /** Datos de la situación especial "Suspendido / Aparcado". */
  suspension?: {
    faseOrigen: string
    megafaseOrigen: MegafaseId
    fecha: string
    motivo: string
    revisionPrevista?: string
  }
  /** Indicador económico: saldo pendiente del cliente (pendiente de desarrollo). */
  saldoPendiente?: number
  /** La deuda se ha trasladado al futuro módulo de cobros. */
  deudaTraspasada?: boolean
  /** Código profesional anterior conservado como dato histórico interno. */
  codigoAnterior?: string
  /** Número correlativo permanente (AP_N). */
  numeroAp?: number
  /** Autoría y fecha de la última edición manual de "Dónde estamos". */
  dondeEstamosMeta?: { fecha: string; autor: string }
  /** Actuación futura marcada como próxima acción principal (única activa). */
  proximaAccionActuacionId?: string
  /** Resumen IA vigente del expediente. */
  resumenIA?: ResumenIA
}

/** Fuente citada por el resumen IA (trazabilidad). */
export type FuenteIA = {
  tipo:
    | 'Actuación'
    | 'Documento'
    | 'Tarea'
    | 'Plazo'
    | 'Comunicación'
    | 'Nota'
    | 'Línea'
    | 'Expediente'
    | 'Económico'
  id: string
  label: string
  /** Pestaña de la ficha donde se encuentra el elemento. */
  pestana: string
}

export type ResumenIA = {
  version: number
  texto: string
  fecha: string
  usuario: string
  fuentes: FuenteIA[]
  /** Huella del contenido del expediente en el momento de generar. */
  huella: string
  valoracion?: 'util' | 'incorrecto'
}

export const TIPOS_LINEA = [
  'Tramitación principal',
  'Negociación',
  'Procedimiento judicial',
  'Medidas cautelares',
  'Ejecución',
  'Tasación de costas',
  'Incidente procesal',
  'Cumplimiento de acuerdo',
  'Liquidación',
  'Cierre',
] as const

export const ESTADOS_LINEA = [
  'Pendiente',
  'En análisis',
  'En curso',
  'En espera',
  'Resuelta',
  'Cerrada',
  'Descartada',
] as const
export type EstadoLinea = (typeof ESTADOS_LINEA)[number]

/** Traducción de los estados históricos al catálogo vigente. */
export const ESTADO_LINEA_LEGADO: Record<string, EstadoLinea> = {
  Abierta: 'Pendiente',
  Suspendida: 'En espera',
  Activa: 'En curso',
}

/** Tono semántico de cada estado (no se depende sólo del color). */
export const TONO_ESTADO_LINEA: Record<
  EstadoLinea,
  'neutro' | 'info' | 'aviso' | 'exito' | 'riesgo'
> = {
  Pendiente: 'neutro',
  'En análisis': 'info',
  'En curso': 'info',
  'En espera': 'aviso',
  Resuelta: 'exito',
  Cerrada: 'exito',
  Descartada: 'neutro',
}

export const SITUACIONES_LINEA = [
  'Debemos trabajo',
  'Depende de tercero',
  'En seguimiento',
  'Sin acción inmediata',
] as const
export type SituacionLinea = (typeof SITUACIONES_LINEA)[number]

export const PRIORIDADES_LINEA = ['Alta', 'Media', 'Baja'] as const
export type PrioridadLinea = (typeof PRIORIDADES_LINEA)[number]

export type LineaTrabajo = {
  id: string
  expedienteId: string
  /** Jerarquía de dos niveles como máximo. */
  parentId?: string | undefined
  nombre: string
  tipo: string
  descripcion: string
  estado: EstadoLinea
  situacion?: SituacionLinea | undefined
  prioridad?: PrioridadLinea | undefined
  /** Responsable propio. Si `responsableHeredado` es cierto, se ignora y se usa el del expediente. */
  responsable: string
  /** Por defecto la línea hereda el responsable del expediente (referencia, no copia). */
  responsableHeredado?: boolean | undefined
  /** Colaboradores como texto libre (histórico). */
  colaboradores?: string[] | undefined
  /** Colaboradores vinculados al módulo de Contactos (identificadores CT-xxxx). */
  colaboradoresContactos?: string[] | undefined

  fechaInicio: string
  fechaObjetivo?: string | undefined
  fechaResolucion?: string | undefined
  fechaCierre?: string | undefined
  /** Compatibilidad: síntesis breve mostrada en listados históricos. */
  dondeEstamos: string
  proximaAccion: string
  dependencia: Dependencia
  presupuesto: string
  esEjecucion?: boolean | undefined

  /* Objetivo */
  objetivo?: string | undefined
  /** Histórico: antiguo "indicador de consecución". Se conserva por compatibilidad. */
  indicador?: string | undefined
  /** ¿Cuándo consideraremos cumplido el objetivo? (opcional) */
  criterioFinalizacion?: string | undefined

  alcance?: string | undefined
  exclusiones?: string | undefined

  /* Estrategia jurídica (opcional) */
  tesis?: string | undefined
  posicionCliente?: string | undefined
  posicionContraria?: string | undefined
  fortalezas?: string | undefined
  debilidades?: string | undefined
  riesgos?: string | undefined
  alternativas?: string | undefined
  decision?: string | undefined

  /* Seguimiento */
  ultimoAvance?: string | undefined
  fechaUltimoAvance?: string | undefined
  responsableSiguienteAccion?: string | undefined
  fechaSiguienteAccion?: string | undefined
  bloqueo?: string | undefined
  dependeDe?: string | undefined
  fechaSeguimiento?: string | undefined

  /* Resultado y cierre */
  resultadoEsperado?: string | undefined
  resultadoObtenido?: string | undefined
  motivoCierre?: string | undefined
  valoracion?: string | undefined

  /* Metadatos */
  orden?: number | undefined
  archivada?: boolean | undefined
  observaciones?: string | undefined
  color?: string | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
  createdBy?: string | undefined
  updatedBy?: string | undefined
}

/* --------------------------- Recordatorio -------------------------- */

/**
 * Aviso interno para revisar, comprobar o retomar algo. No es un plazo
 * jurídico (FechaCritica) ni un trabajo asignado (TareaOp). La estructura es
 * transversal: hoy se crea desde la línea de trabajo y queda preparada para el
 * futuro módulo general de Recordatorios.
 */
export const ESTADOS_RECORDATORIO = ['Pendiente', 'Atendido', 'Aplazado', 'Cancelado'] as const
export type EstadoRecordatorio = (typeof ESTADOS_RECORDATORIO)[number]

export type Recordatorio = {
  id: string
  expedienteId: string
  lineaId?: string | undefined
  fecha: string
  hora?: string | undefined
  texto: string
  responsable: string
  estado: EstadoRecordatorio
  tareaId?: string | undefined
  creadoPor?: string | undefined
  creadoEl?: string | undefined
}

/* ---------------------------- Ejecución --------------------------- */

export const TIPOS_EJECUCION_EXTRA = [
  'Cumplimiento de acuerdo',
  'Cumplimiento de contrato',
  'Pago aplazado',
  'Entrega de inmueble, llaves o posesión',
  'Firma de escritura',
  'Actuación notarial',
  'Inscripción registral',
  'Entrega de documentación',
  'Obras o reparaciones',
  'Cese de conducta',
  'Liquidación económica',
  'Adjudicación o reparto de bienes',
  'Otro compromiso',
] as const

export const ESTADOS_EJECUCION_EXTRA = [
  'Preparación del cumplimiento',
  'Pendiente del obligado',
  'Cumplimiento parcial',
  'Incidencia o incumplimiento',
  'Requerimiento de cumplimiento',
  'Negociación de incidencia',
  'Cumplido',
  'Derivado a ejecución judicial',
  'Liquidación y cierre',
] as const

export const FASES_EJECUCION_JUDICIAL = [
  'Título ejecutivo y firmeza',
  'Tasación de costas',
  'Preparación de demanda ejecutiva',
  'Demanda presentada',
  'Despacho de ejecución',
  'Notificación al ejecutado',
  'Oposición o incidentes',
  'Averiguación patrimonial',
  'Embargo y traba',
  'Realización de bienes',
  'Cobro parcial o total',
  'Liquidación y cierre',
] as const

export const SITUACIONES_PRESUPUESTARIAS = [
  'Incluida',
  'Parcialmente incluida',
  'No incluida',
  'Pendiente de comprobar',
  'Requiere ampliación',
  'Requiere nuevo presupuesto',
] as const
export type SituacionPresupuestaria = (typeof SITUACIONES_PRESUPUESTARIAS)[number]

export type Ejecucion = {
  id: string
  expedienteId: string
  lineaId: string
  modalidad: 'Ejecución judicial' | 'Ejecución extrajudicial'
  tipo: string // tipo extrajudicial o tipo de título
  estado: string // estado extrajudicial o fase judicial
  titulo: string // título, resolución, acuerdo o causa
  objeto: string
  obligado: string
  beneficiario: string
  prestacion: string
  importeReclamado: number
  importeRecuperado: number
  responsable: string
  fechaInicio: string
  dondeEstamos: string
  proximaAccion: string
  dependencia: Dependencia
  alcance: string
  situacionPresupuestaria: SituacionPresupuestaria
  proximoControl: string
  derivadaDe?: string
  naturalezaOriginal: Naturaleza
}

export const saldoEjecucion = (e: Ejecucion) => e.importeReclamado - e.importeRecuperado

/* ---------------------------- Actuación --------------------------- */

export const ESTADOS_ACTUACION = [
  'Borrador',
  'Pendiente',
  'En curso',
  'Pendiente de completar',
  'Pendiente de revisión',
  'Pendiente de reportar',
  'Completada',
  'Cancelada',
] as const
export type EstadoActuacion = (typeof ESTADOS_ACTUACION)[number]

export const COLUMNAS_ACTUACIONES: ColumnaKanban[] = [
  { id: 'Borrador', nombre: 'Por iniciar', tono: 'neutro' },
  { id: 'Pendiente', nombre: 'Pendientes', tono: 'aviso' },
  { id: 'En curso', nombre: 'En curso', tono: 'info' },
  { id: 'Pendiente de completar', nombre: 'Pendientes de completar', tono: 'aviso' },
  { id: 'Pendiente de revisión', nombre: 'Pendientes de revisión', tono: 'aviso' },
  { id: 'Pendiente de reportar', nombre: 'Pendientes de reportar', tono: 'riesgo' },
  { id: 'Completada', nombre: 'Completadas', tono: 'exito' },
]

/* --------- Actividad: entidad única de registro (una actuación es
   una actividad calificada manualmente; un hito, una actuación esencial) --- */

export const TIPOS_ACTUACION = [
  'Llamada',
  'Reunión',
  'Correo electrónico',
  'Comunicación',
  'Gestión',
  'Revisión o análisis',
  'Documento recibido',
  'Documento enviado',
  'Presentación de documento o escrito',
  'Negociación',
  'Decisión',
  'Pago o cobro',
  'Comparecencia',
  'Actuación automática del sistema',
  'Otra',
] as const
export type TipoActuacion = (typeof TIPOS_ACTUACION)[number]

export const CLASES_ACTUACION = [
  'Judicial',
  'Extrajudicial',
  'Documental',
  'Negociadora',
  'Notarial',
  'Registral',
  'Económica',
  'Decisión del cliente',
  'Cierre o cumplimiento',
  'Otra',
] as const
export type ClaseActuacion = (typeof CLASES_ACTUACION)[number]

export const CATEGORIAS_HITO = [
  'Inicio del asunto',
  'Actuación procesal',
  'Resolución judicial',
  'Acuerdo',
  'Documento esencial',
  'Cumplimiento económico',
  'Cierre',
  'Otra',
] as const
export type CategoriaHito = (typeof CATEGORIAS_HITO)[number]

export const ESTADOS_REGISTRO = ['Borrador', 'Confirmada', 'Rectificada', 'Anulada'] as const
export type EstadoRegistro = (typeof ESTADOS_REGISTRO)[number]

export type Actuacion = {
  id: string
  expedienteId: string
  lineaId?: string
  lineasRelacionadas?: string[]
  tipo: string
  tipoOtro?: string
  titulo: string
  descripcion: string
  observaciones?: string
  /** Día en que ocurrió el hecho. Es la fecha profesional visible. */
  fecha: string
  hora: string
  /** Día y hora en que se introdujo en la Suite (auditoría). */
  fechaRegistro?: string
  autor: string
  responsable: string
  participantes: string[]
  documentos?: string[]
  comunicacionId?: string
  origenRef?: { tipo: 'Tarea' | 'Comunicación' | 'Documento'; id: string; label: string }
  estado: EstadoActuacion
  resultado: string
  proximaAccion: string
  tiempo: number // horas
  facturable: boolean
  visibleCliente: boolean
  clienteInformado: boolean

  /* Calificación manual */
  esActuacion?: boolean
  tipoActuacion?: ClaseActuacion
  distintivos?: ClaseActuacion[]
  esHito?: boolean
  tituloHito?: string
  categoriaHito?: CategoriaHito
  esJudicial?: boolean
  contieneDocumentoJudicial?: boolean
  confidencial?: boolean
  requiereProximaAccion?: boolean

  /* Control y trazabilidad */
  estadoRegistro?: EstadoRegistro
  creadoPor?: string
  modificadoPor?: string
  fechaModificacion?: string
  motivoRectificacion?: string
}

/* ---------------------------- Documento --------------------------- */

export const ORIGENES_DOCUMENTO = [
  'Recibido',
  'Elaborado por el despacho',
  'Elaborado por cliente',
  'Elaborado por colaborador',
  'Firmado o completado por tercero',
  'Generado por el sistema',
] as const
export type OrigenDocumento = (typeof ORIGENES_DOCUMENTO)[number]

export const ESTADOS_DOC_RECIBIDO = [
  'Sin clasificar',
  'Pendiente de revisión',
  'Revisado',
  'Requiere actuación',
  'Tratado',
  'Archivado',
] as const

export const ESTADOS_DOC_ELABORADO = [
  'Por iniciar',
  'Borrador',
  'En elaboración',
  'Pendiente de información',
  'Pendiente de revisión',
  'Revisado',
  'Pendiente de aprobación',
  'Aprobado',
  'Pendiente de firma',
  'Firmado',
  'Pendiente de presentación o entrega',
  'Presentado',
  'Entregado',
  'Definitivo',
] as const

export const COLUMNAS_DOC_RECIBIDOS: ColumnaKanban[] = [
  { id: 'Sin clasificar', nombre: 'Recibidos sin clasificar', tono: 'riesgo' },
  { id: 'Pendiente de revisión', nombre: 'Pendientes de análisis', tono: 'aviso' },
  { id: 'Revisado', nombre: 'Analizados', tono: 'info' },
  { id: 'Requiere actuación', nombre: 'Requieren actuación', tono: 'aviso' },
  { id: 'Tratado', nombre: 'En seguimiento', tono: 'info' },
  { id: 'Archivado', nombre: 'Tratados y archivados', tono: 'exito' },
]

export const COLUMNAS_DOC_ELABORADOS: ColumnaKanban[] = [
  { id: 'Por iniciar', nombre: 'Por iniciar', tono: 'neutro' },
  { id: 'En elaboración', nombre: 'En elaboración', tono: 'info' },
  { id: 'Pendiente de información', nombre: 'Pendientes de información', tono: 'aviso' },
  { id: 'Pendiente de revisión', nombre: 'Pendientes de revisión', tono: 'aviso' },
  { id: 'Pendiente de firma', nombre: 'Pendientes de aprobación o firma', tono: 'aviso' },
  {
    id: 'Pendiente de presentación o entrega',
    nombre: 'Listos para presentar o entregar',
    tono: 'info',
  },
  { id: 'Presentado', nombre: 'Presentados o entregados', tono: 'exito' },
  { id: 'Definitivo', nombre: 'Definitivos', tono: 'exito' },
]

export const TIPOS_DOC_JUDICIAL = [
  'Resolución',
  'Providencia',
  'Auto',
  'Sentencia',
  'Decreto',
  'Diligencia de ordenación',
  'Diligencia de emplazamiento',
  'Citación',
  'Requerimiento',
  'Mandamiento',
  'Oficio',
  'Demanda',
  'Contestación',
  'Recurso',
  'Escrito procesal',
  'Escrito de contrario',
  'Dictamen pericial',
  'Acta de vista',
  'Grabación',
  'Justificante de presentación',
  'Otro documento procesal',
] as const

export const TIPOS_ENTREGABLE = [
  'Demanda',
  'Contestación',
  'Recurso',
  'Escrito procesal',
  'Requerimiento',
  'Contrato',
  'Acuerdo',
  'Informe',
  'Dictamen',
  'Cuaderno particional',
  'Documento para notaría',
  'Documento para firma',
  'Informe de cierre',
  'Reporte al cliente',
] as const

export const CANALES_JUDICIALES = [
  'LexNET',
  'Procurador',
  'Sede judicial',
  'Correo',
  'Entrega física',
  'Otro',
] as const

export const ESTADOS_PLAZO_DOC = [
  'No contiene plazo',
  'Posible plazo pendiente de validar',
  'Plazo validado',
] as const
export type EstadoPlazoDoc = (typeof ESTADOS_PLAZO_DOC)[number]

export type VersionDocumento = {
  numero: number
  tipo:
    | 'Documento de trabajo'
    | 'Versión revisada'
    | 'Versión aprobada'
    | 'Versión firmada'
    | 'Versión presentada o entregada'
    | 'Justificante'
  autor: string
  fecha: string
  comentarios: string
  definitiva: boolean
}

export type DatosJudiciales = {
  organo: string
  autos: string
  nig: string
  tipoProcedimiento: string
  parte: string
  procurador: string
  fechaRecepcion: string
  fechaNotificacion: string
  fechaPresentacion: string
  canal: string
  justificante: string
  puedeContenerPlazo: boolean
  estadoPlazo: EstadoPlazoDoc
  actuacionExigida: string
  responsableControl: string
  criticidad: Prioridad
}

export type DatosEntregable = {
  destinatario: string
  finalidad: string
  requiereRevision: boolean
  requiereAprobacion: boolean
  requiereFirma: boolean
  fechaPrevista: string
  fechaEfectiva: string
  medio: string
  justificante: string
}

/**
 * Flujo documental mínimo: cuatro estados. El documento es origen y
 * evidencia; el trabajo operativo vive en la TAREA y el hecho profesional en
 * la ACTUACIÓN.
 */
export const ESTADOS_DOC_SIMPLE = [
  'Pendiente de tratar',
  'En tratamiento',
  'Tratado',
  'Archivado / solo consulta',
] as const
export type EstadoDocSimple = (typeof ESTADOS_DOC_SIMPLE)[number]

/** Traducción de los estados documentales históricos al flujo mínimo. */
export const ESTADO_DOC_LEGADO: Record<string, EstadoDocSimple> = {
  'Sin clasificar': 'Pendiente de tratar',
  'Pendiente de revisión': 'Pendiente de tratar',
  'Por iniciar': 'Pendiente de tratar',
  Borrador: 'En tratamiento',
  'En elaboración': 'En tratamiento',
  'Pendiente de información': 'En tratamiento',
  'Requiere actuación': 'En tratamiento',
  'Pendiente de aprobación': 'En tratamiento',
  'Pendiente de firma': 'En tratamiento',
  'Pendiente de presentación o entrega': 'En tratamiento',
  Revisado: 'Tratado',
  Tratado: 'Tratado',
  Aprobado: 'Tratado',
  Firmado: 'Tratado',
  Presentado: 'Tratado',
  Entregado: 'Tratado',
  Definitivo: 'Tratado',
  Archivado: 'Archivado / solo consulta',
}

/** Propuesta de la primera capa de IA documental: siempre a validar. */
export type PropuestaIADocumento = {
  fecha: string
  nombreNormalizado: string
  tipoDocumental: string
  fechaDocumento: string
  emisor: string
  expedienteProbable: string
  resumen: string
  posibleRequerimiento: boolean
  advertencia: string
  validada: boolean
}

export type Documento = {
  id: string
  nombre: string
  expedienteId?: string // sin expediente => bandeja "Pendiente de asignación"
  lineaId?: string
  lineasRelacionadas?: string[]
  actuacionOrigenId?: string
  actuacionesRelacionadas: string[]
  archivo: string
  descripcion: string
  tipoDocumental: string
  origen: OrigenDocumento
  autorEmisor: string
  destinatario: string
  fechaDocumento: string
  fechaIncorporacion: string
  responsable: string
  estado: string
  version: number
  versiones: VersionDocumento[]
  documentoPrecedente?: string
  documentoSustituto?: string
  confidencialidad: 'Normal' | 'Restringida' | 'Confidencial'
  etiquetas: string[]
  observaciones: string
  judicial: boolean
  entregable: boolean
  datosJudiciales?: DatosJudiciales
  datosEntregable?: DatosEntregable
  clienteInformado: boolean
  /** Relación bidireccional con las tareas que lo trabajan. */
  tareasVinculadas?: string[]
  /** Fecha o plazo vinculado (extensión del futuro módulo FECHAS Y PLAZOS). */
  fechaVinculadaId?: string
  iaPropuesta?: PropuestaIADocumento
}

export const esRecibido = (d: Documento) =>
  d.origen === 'Recibido' || d.origen === 'Firmado o completado por tercero'

export const tieneDefinitiva = (d: Documento) => d.versiones.some((v) => v.definitiva)

/* ------------------------------ Tarea ----------------------------- */

/**
 * Estados operativos del módulo de tareas. Cinco y sólo cinco: creada,
 * iniciada, detenida con motivo, terminada o descartada. Los estados
 * históricos (Diferida, Bloqueada, Pendiente de tercero…) se traducen en la
 * migración del store: BLOQUEADA nunca es estado, es señal.
 */
export const ESTADOS_TAREA_OP = [
  'Pendiente',
  'En curso',
  'En espera',
  'Completada',
  'Cancelada',
] as const
export type EstadoTareaOp = (typeof ESTADOS_TAREA_OP)[number]

/** Estados vivos: la tarea sigue existiendo como trabajo por hacer. */
export const ESTADOS_TAREA_VIVOS: EstadoTareaOp[] = ['Pendiente', 'En curso', 'En espera']

export const ESTADO_TAREA_LEGADO: Record<string, EstadoTareaOp> = {
  Pendiente: 'Pendiente',
  'En curso': 'En curso',
  Bloqueada: 'Pendiente',
  'Pendiente de tercero': 'En espera',
  'Pendiente de revisión': 'En curso',
  Diferida: 'En espera',
  'En espera': 'En espera',
  Completada: 'Completada',
  Cancelada: 'Cancelada',
}

/**
 * Catálogo editable de títulos frecuentes: alimenta el autocompletado del
 * campo Título. Nunca es un desplegable cerrado; el texto es libre.
 */
export const TITULOS_TAREA_INICIALES = [
  'NOTA SIMPLE - SOLICITUD',
  'NOTA SIMPLE - REVISIÓN',

  'REVISAR DIOR Y DAR CURSO',
  'LLAMAR AL CLIENTE',
  'PREPARAR ESCRITO',
  'PRESENTAR ESCRITO',
  'SOLICITAR DOCUMENTACIÓN AL CLIENTE',
  'REVISAR RESOLUCIÓN JUDICIAL',
  'CONTROL DE PAGO',
] as const

/** Motivos tasados para dejar una tarea EN ESPERA. */
export const MOTIVOS_ESPERA = [
  'Esperando al cliente',
  'Esperando al procurador',
  'Esperando al Juzgado',
  'Esperando a notaría',
  'Esperando documentación',
  'Esperando a tercero',
  'Esperando otra tarea',
  'Esperando una fecha',
  'Decisión interna pendiente',
  'Otro',
] as const
export type MotivoEspera = (typeof MOTIVOS_ESPERA)[number]

/** Subtarea de la checklist: texto libre, con autoría y orden manual. */
export type Subtarea = {
  id: string
  texto: string
  hecho: boolean
  autor: string
  fecha: string
  /** Orden manual (drag & drop). Completar no recoloca. */
  orden: number
  /** Identificador de la tarea creada a partir de esta subtarea. */
  convertidaEn?: string
}

export type ReclamacionTarea = {
  id: string
  fecha: string
  autor: string
  destinatario: string
  mensaje: string
}

export type EvidenciaTarea = {
  id: string
  tipo: 'Documento' | 'Comunicación' | 'Actuación' | 'Nota'
  refId?: string
  descripcion: string
  fecha: string
  autor: string
}

export type HistoricoTarea = {
  id: string
  fecha: string
  autor: string
  accion: string
  detalle: string
  anterior?: string
  nuevo?: string
}

export type RecordatorioTarea = {
  id: string
  fecha: string
  texto: string
  atendido: boolean
}

/** Mensaje de la conversación interna de la tarea. */
export type MensajeTarea = {
  id: string
  fecha: string // dd/mm/aaaa
  hora: string // HH:MM
  autor: string
  texto: string
  clase?: 'mensaje' | 'reclamacion' | 'sistema'
  /** Primer mensaje del encargo: la indicación con la que se creó la tarea. */
  indicacionInicial?: boolean
}

export const MOTIVOS_RECHAZO = [
  'No me corresponde',
  'No tengo disponibilidad',
  'Faltan instrucciones',
  'Falta información',
  'Ya está realizada',
  'Está duplicada',
  'Otro motivo',
] as const
export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number]

export type RechazoTarea = {
  fecha: string
  hora: string
  autor: string
  motivo: MotivoRechazo
  explicacion: string
  /** El creador ya ha actuado sobre el rechazo (reenvío, reasignación, salto…). */
  resuelto: boolean
  resolucion?: string
}

/** Aviso interno del sistema dirigido a una persona concreta. */
export type Notificacion = {
  id: string
  usuario: string
  fecha: string
  hora: string
  texto: string
  tipo:
    | 'Encargo'
    | 'Mensaje'
    | 'Rechazo'
    | 'Reclamación'
    | 'Vencimiento'
    | 'Cambio'
    | 'Cierre'
    | 'Cadena'
    | 'Recordatorio'
  tareaId?: string
  fechaId?: string
  leida: boolean
}

export type OrigenRelacion = {
  tipo:
    | 'Expediente'
    | 'Línea'
    | 'Ejecución'
    | 'Actuación'
    | 'Documento'
    | 'Comunicación'
    | 'Cliente'
    | 'Presupuesto'
    | 'Oportunidad'
    | 'Onboarding'
    | 'Tarea'

  id: string
  label: string
}

export type TareaOp = {
  id: string
  titulo: string
  descripcion: string
  expedienteId?: string
  lineaId?: string
  lineasRelacionadas?: string[]
  origen?: OrigenRelacion
  responsable: string
  colaboradores: string[]
  prioridad: Prioridad
  estado: EstadoTareaOp
  fechaInicio: string
  vencimiento: string
  /** Hora límite del encargo (HH:MM). Relevante: no debe omitirse. */
  horaLimite?: string
  recordatorio: string
  /** Checklist heredada (v1). La migración la traslada a `subtareas`. */
  checklist: { texto: string; hecho: boolean }[]
  /** Subtareas con autoría y orden manual. */
  subtareas?: Subtarea[]
  resultado: string
  tiempo: number
  documentos: string[]

  /* --- Módulo general de tareas --- */
  creador?: string
  supervisor?: string
  etiquetas?: string[]
  /** Orden manual dentro de su columna del tablero. */
  ordenTablero?: number
  /** Capturada en el INBOX personal, todavía sin aclarar ni contextualizar. */
  capturada?: boolean
  /** Actuación profesional generada al completar la tarea, si la hubo. */
  actuacionId?: string
  /** Tarea de la que procede, cuando nació de una subtarea convertida. */
  origenSubtareaDe?: string
  /** Fecha y hora de creación y de envío al responsable. */
  creadoEn?: string
  fechaEnvio?: string
  /** Fecha y autor de la primera apertura por el responsable (control AR). */
  primeraApertura?: { fecha: string; autor: string }
  ultimaApertura?: string
  /** Cadena: esta tarea no puede completarse mientras la anterior siga viva. */
  bloqueadaPor?: string
  /** Tarea que se activa automáticamente al completar ésta. */
  desbloquea?: string
  /** Identificador de la cadena y posición dentro de ella (1..n). */
  cadenaId?: string
  ordenCadena?: number
  /** Cómo se calcula el vencimiento de una fase todavía bloqueada. */
  plazoModo?: 'fija' | 'dias' | 'sin'
  /** Días desde la finalización de la predecesora para calcular el vencimiento. */
  diasTrasPredecesora?: number
  /** Plazo jurídico asociado (fecha crítica). Nunca se recalcula solo. */
  plazoJuridicoId?: string
  /** Evidencia exigida para poder cerrar la tarea (reservado al gestor documental). */
  evidenciaObligatoria?: boolean
  evidencias?: EvidenciaTarea[]
  /** Relación técnica preparada para el futuro gestor de documentos. */
  documentosVinculados?: string[]
  conversacion?: MensajeTarea[]
  /** Control de idempotencia: la indicación inicial ya vive en la conversación. */
  indicacionMigrada?: boolean

  rechazo?: RechazoTarea
  reclamaciones?: ReclamacionTarea[]
  recordatorios?: RecordatorioTarea[]
  historico?: HistoricoTarea[]
  /** EN ESPERA: fecha de revisión obligatoria (antes «diferida hasta»). */
  diferidaHasta?: string
  /** EN ESPERA: motivo tasado. Si es «Otro», exige explicación. */
  motivoDiferimiento?: MotivoEspera
  motivoEsperaDetalle?: string
  motivoCierre?: string
  /**
   * Señal operativa (no es un estado ni una columna): se está a la espera de
   * la respuesta externa a un email relacionado.
   */
  esperandoRespuesta?: { desde: string; comunicacionId?: string }
  /**
   * SIGUIENTE ACCIÓN: señal especial, no un estado ni una columna. Responde a
   * «¿qué hay que hacer ahora para que este asunto avance?». Sólo puede haber
   * una tarea marcada por contexto (Lead, Onboarding, Expediente, Línea…).
   */
  esSiguienteAccion?: boolean
  plantilla?: string

  /**
   * TAREA ESPECIAL «DEVOLVER LLAMADA». Añadido no invasivo: el resto del
   * módulo de tareas se comporta exactamente igual que en cualquier tarea.
   */
  devolverLlamada?: DatosDevolverLlamada

  /**
   * TAREAS ESPECIALES. Una tarea especial es una TAREA normal (mismo modelo,
   * mismos estados, mismo tablero) con un bloque adicional que describe su
   * naturaleza. Hoy sólo está desarrollada la de COMUNICACIÓN; la de REUNIÓN
   * queda anunciada y sin comportamiento propio.
   */
  especial?: DatosTareaEspecial

  /**
   * TAREA ESPECIAL DE REUNIÓN. Misma pieza durante todo el ciclo
   * (preparación → agendada → en reunión → finalizada). No crea una entidad
   * paralela: la reunión es esta tarea con su bloque propio.
   */
  reunion?: DatosReunion

  /* --- INBOX personal (GTD) --- */
  /**
   * Etapa de procesamiento personal del INBOX. NO es un estado de la tarea:
   * los estados siguen siendo Pendiente / En curso / En espera / Completada /
   * Cancelada. Sirve sólo para la vista personal de quien capturó la tarea.
   */
  etapaInbox?: EtapaInbox
  /** Orden manual dentro de su etapa del INBOX. */
  ordenInbox?: number
  /** Persona propietaria de la captura (vista personal). */
  inboxDe?: string
  /** Subtarea de origen, cuando la tarea nació de una conversión. */
  origenSubtareaId?: string
}

/**
 * Datos mínimos de la tarea especial DEVOLVER LLAMADA: quién llamó, cuándo y
 * por qué. Al ejecutarla se abre el registro de llamada ya definido.
 */
export type DatosDevolverLlamada = {
  contacto: string
  contactoId?: string
  telefono?: string
  /** Fecha y hora de la llamada recibida. */
  fecha: string
  hora: string
  motivo?: string
  /** Comunicación de entrada que originó la tarea, si se registró. */
  comunicacionId?: string
}

/* -------------------------- Tareas especiales ---------------------- */

/**
 * Estamento de TAREAS ESPECIALES. La TAREA normal no cambia de nombre ni de
 * comportamiento: una tarea especial es una tarea con un bloque adicional.
 */
export const TIPOS_TAREA_ESPECIAL = ['Comunicación', 'Reunión'] as const
export type TipoTareaEspecial = (typeof TIPOS_TAREA_ESPECIAL)[number]

/**
 * TAREA ESPECIAL DE COMUNICACIÓN: lo que hay que hacer es precisamente
 * comunicar (contestar un email, responder un WhatsApp, devolver una
 * llamada). Si lo que hay que hacer es trabajo jurídico u operativo, se crea
 * una TAREA normal, no una especial.
 *
 * La TAREA ESPECIAL DE REUNIÓN queda anunciada (`tipo: "Reunión"`) pero sin
 * workflow propio: se está cerrando en otro bloque.
 */
export type DatosTareaEspecial = {
  tipo: TipoTareaEspecial
  /** Canal por el que hay que comunicar. */
  canal?: 'Email' | 'WhatsApp' | 'Llamada'
  /** Comunicación original que origina el encargo (consulta a un clic). */
  comunicacionId?: string
  /** Persona con la que hay que comunicar. */
  contactoId?: string
  contacto?: string
  /** Dirección o teléfono utilizado, si consta. */
  destino?: string
  /** Marca de resolución: CONTESTADO. */
  contestadoEn?: string
  contestadoPor?: string
  /** Comunicación de salida registrada al contestar, si la hubo. */
  respuestaComunicacionId?: string
}

/* ------------------- TAREA ESPECIAL DE REUNIÓN --------------------- */

/**
 * REUNIÓN = tarea especial + evento temporal + espacio de trabajo durante su
 * celebración + generador de trabajo posterior. La misma pieza recorre todo
 * el ciclo; no se crean objetos independientes en cada etapa.
 */
export const ESTADOS_REUNION = [
  'Preparación',
  'Agendada',
  'En reunión',
  'Finalizada',
  'Reprogramada',
  'Cancelada',
  'No celebrada',
] as const
export type EstadoReunion = (typeof ESTADOS_REUNION)[number]

/**
 * Catálogo cerrado de tipos de reunión. «Seguimiento» absorbe revisiones,
 * presentación de opciones, reuniones de trabajo y decisiones posteriores;
 * «Firma / formalización» cubre firma, entrega y actos equivalentes.
 */
export const TIPOS_REUNION = [
  'Primera cita',
  'Seguimiento',
  'Firma / formalización',
  'Económica',
  'Interna',
  'Externa',
] as const
export type TipoReunion = (typeof TIPOS_REUNION)[number]

/** Duración estimada: selector rápido con opción personalizada. */
export const DURACIONES_REUNION = ['15 min', '30 min', '45 min', '60 min', '90 min'] as const

/** Preferencia de fecha: instrucción para quien prepara, no fecha definitiva. */
export const PREFERENCIAS_FECHA_REUNION = [
  'Lo antes posible',
  'Esta semana',
  'Próxima semana',
  'Antes de una fecha',
  'Fecha concreta preferente',
  'Sin preferencia',
] as const
export type PreferenciaFechaReunion = (typeof PREFERENCIAS_FECHA_REUNION)[number]

export const FRANJAS_REUNION = ['Indiferente', 'Mañana', 'Tarde'] as const
export type FranjaReunion = (typeof FRANJAS_REUNION)[number]

export const LUGARES_REUNION = [
  'Despacho Bilbao',
  'Despacho Rekalde',
  'Fuera del despacho',
  'Telefónica',
] as const
export type LugarReunion = (typeof LUGARES_REUNION)[number]

export const MODALIDADES_REUNION = ['Presencial', 'Videollamada', 'Telefónica'] as const
export type ModalidadReunion = (typeof MODALIDADES_REUNION)[number]

export const CLASES_ASISTENTE = ['Profesional', 'Interno', 'Externo'] as const
export type ClaseAsistente = (typeof CLASES_ASISTENTE)[number]

export type AsistenteReunion = {
  id: string
  nombre: string
  clase: ClaseAsistente
  rol?: string
  contactoId?: string
  confirmado?: boolean
  /** Invitación reflejada en su calendario al agendar. */
  calendar?: boolean
}

export const CLASES_PREPARACION = [
  'Documentación a solicitar',
  'Documentación a revisar',
  'Confirmar asistencia',
  'Gestión previa',
] as const
export type ClasePreparacion = (typeof CLASES_PREPARACION)[number]

export type PuntoPreparacion = {
  id: string
  clase: ClasePreparacion
  texto: string
  hecho: boolean
  autor: string
  fecha: string
}

/** Notas internas: NUNCA visibles en el portal del cliente. */
export type NotaReunion = {
  id: string
  texto: string
  autor: string
  fecha: string
  hora: string
  etapa: EstadoReunion
}

export type DatosReunion = {
  estado: EstadoReunion
  tipo: string
  conQuien: string
  objeto: string
  duracionEstimada?: string
  preferenciasFecha?: string
  preferenciasLugar?: string
  /** Fecha concreta o límite asociada a la preferencia, cuando procede. */
  preferenciaFechaValor?: string
  /** Franja horaria preferida para organizar la reunión. */
  franja?: FranjaReunion
  /** Dirección concreta cuando el lugar es «Fuera del despacho». */
  direccion?: string
  /** Notas del sistema general de NOTAS vinculadas a esta reunión. */
  notasIds?: string[]
  indicaciones?: string
  asistentes: AsistenteReunion[]
  preparacion: PuntoPreparacion[]
  notas: NotaReunion[]
  /* Concreción */
  fecha?: string
  hora?: string
  duracionPrevista?: string
  lugar?: string
  modalidad?: ModalidadReunion
  enlace?: string
  /* Ciclo */
  agendadaEn?: string
  fechaCriticaId?: string
  inicioReal?: string
  finReal?: string
  duracionRealMin?: number
  /* Cierre profesional */
  conclusiones?: string
  decisiones?: string
  /** Capa complementaria: LEX no depende de PLAUD. */
  plaud?: {
    grabando?: boolean
    transcripcion?: string
    resumen?: string
    archivos?: string[]
  }
  motivo?: string
  /** Comunicaciones preparadas desde la reunión (mismo módulo, sin duplicar). */
  comunicacionesVinculadas?: string[]
}

/**
 * Etapas del INBOX personal (GTD). No son estados de tarea ni columnas del
 * tablero general: describen el procesamiento personal de la captura.
 */
export const ETAPAS_INBOX = [
  'Bandeja de entrada',
  'Aclarar y decidir',
  'Repartir / delegar',
  'Próximas acciones',
  'Ahora',
  'En espera',
  'Revisión semanal',
] as const
export type EtapaInbox = (typeof ETAPAS_INBOX)[number]

/* ----------------------------- Etiquetas -------------------------- */

/**
 * Etiquetas de tareas: catálogo propio (entidad) y relación muchos a muchos
 * con las tareas. La tarea guarda identificadores, nunca textos sueltos, de
 * modo que renombrar o fusionar una etiqueta se propaga sin tocar tareas.
 */
export const COLORES_ETIQUETA = [
  'azul',
  'verde',
  'ambar',
  'rojo',
  'morado',
  'turquesa',
  'rosa',
  'gris',
] as const
export type ColorEtiqueta = (typeof COLORES_ETIQUETA)[number]

export type EtiquetaTarea = {
  id: string
  nombre: string
  color: ColorEtiqueta
  descripcion?: string
  archivada: boolean
  creadaEn: string
  creadaPor: string
  /** Etiqueta absorbida por otra en una fusión (se conserva como histórico). */
  fusionadaEn?: string
}

/** Clave de comparación: sin mayúsculas, acentos ni espacios sobrantes. */
export const claveEtiqueta = (nombre: string) =>
  nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

/**
 * Catálogo inicial pequeño y editable: las etiquetas no duplican estado,
 * prioridad, responsable, vencimiento ni SIGUIENTE ACCIÓN.
 */
export const ETIQUETAS_INICIALES: EtiquetaTarea[] = [
  {
    id: 'ET-COM',
    nombre: 'Interés comercial',
    color: 'turquesa',
    archivada: false,
    creadaEn: '01/01/2026',
    creadaPor: 'Sistema',
  },
  {
    id: 'ET-PER',
    nombre: 'Personal',
    color: 'gris',
    archivada: false,
    creadaEn: '01/01/2026',
    creadaPor: 'Sistema',
  },
  {
    id: 'ET-ADM',
    nombre: 'Administración',
    color: 'azul',
    archivada: false,
    creadaEn: '01/01/2026',
    creadaPor: 'Sistema',
  },
  {
    id: 'ET-GES',
    nombre: 'Gestión del despacho',
    color: 'verde',
    archivada: false,
    creadaEn: '01/01/2026',
    creadaPor: 'Sistema',
  },
  {
    id: 'ET-FAC',
    nombre: 'Facturación / cobros',
    color: 'ambar',
    archivada: false,
    creadaEn: '01/01/2026',
    creadaPor: 'Sistema',
  },
  {
    id: 'ET-INF',
    nombre: 'Informática / sistemas',
    color: 'morado',
    archivada: false,
    creadaEn: '01/01/2026',
    creadaPor: 'Sistema',
  },
  {
    id: 'ET-FOR',
    nombre: 'Formación',
    color: 'rosa',
    archivada: false,
    creadaEn: '01/01/2026',
    creadaPor: 'Sistema',
  },
]

/* -------------------------- Fecha crítica ------------------------- */

export const TIPOS_FECHA = [
  'Fecha informativa',
  'Recordatorio',
  'Vencimiento interno',
  'Fecha crítica',
  'Plazo procesal',
  'Evento o cita',
] as const
export type TipoFecha = (typeof TIPOS_FECHA)[number]

/* ---------------- Registro temporal (Fechas y plazos) -------------- */

/** Los cuatro tipos de registro temporal del módulo FECHAS Y PLAZOS. */
export const REGISTROS_TEMPORALES = ['Recordatorio', 'Fecha', 'Evento', 'Plazo'] as const
export type RegistroTemporal = (typeof REGISTROS_TEMPORALES)[number]

export type EstadoRegistroTemporal = 'Pendiente' | 'Realizado' | 'Pospuesto' | 'Cancelado'

export type FrecuenciaRecurrencia = 'Diaria' | 'Semanal' | 'Mensual' | 'Anual' | 'Personalizada'

export type Recurrencia = {
  activa: boolean
  frecuencia: FrecuenciaRecurrencia
  cada: number
  /** Sin valor: sin fecha de fin. */
  hasta?: string
}

export type Aplazamiento = {
  fecha: string
  hora: string
  anterior: string
  nuevo: string
  usuario: string
  registradoEn: string
}

export type CambioVencimiento = {
  anterior: string
  nueva: string
  momento: string
  usuario: string
}

export type ClasePlazo = 'Judicial' | 'Extrajudicial'

export type FechaCritica = {
  id: string
  expedienteId?: string
  lineaId?: string
  lineasRelacionadas?: string[]
  origen?: OrigenRelacion
  tipo: TipoFecha
  titulo: string
  fecha: string
  hora: string
  responsable: string
  validada: boolean
  validadaPor?: string
  criticidad: Prioridad
  avisos: string
  observaciones: string
  resultado: string
  sincronizadaCalendar: boolean // punto de extensión Google Calendar

  /* --- Módulo FECHAS Y PLAZOS (registro temporal unificado) --- */
  /** Tipo de registro temporal. Si falta, se deduce de `tipo` (legado). */
  registro?: RegistroTemporal
  /** Estado operativo del registro (relevante sobre todo en recordatorios). */
  estadoTemporal?: EstadoRegistroTemporal
  /** Hora de finalización, solo en eventos. */
  horaFin?: string
  /** Recurrencia, solo en recordatorios. */
  recurrencia?: Recurrencia
  /** Historial de aplazamientos del recordatorio. */
  aplazamientos?: Aplazamiento[]
  /** Registro padre cuando este objeto es un recordatorio asociado. */
  padreId?: string
  /* Plazos */
  clasePlazo?: ClasePlazo
  diaNotificacion?: string
  termino?: string
  /** Cálculo propuesto por el sistema, pendiente de confirmación humana. */
  vencimientoPropuesto?: string
  /** El vencimiento ha sido confirmado por un profesional. */
  vencimientoValidado?: boolean
  /** Segunda fecha de control (doble check), secundaria al vencimiento. */
  aTermino?: string
  /** Único marcador de criticidad del módulo. */
  critico?: boolean
  historicoVencimiento?: CambioVencimiento[]
  /** Registro de demostración, borrable en bloque. */
  demo?: boolean
}

/* --------------------------- Comunicación ------------------------- */

export const TIPOS_COMUNICACION = [
  'Llamada',
  'Email',
  'Reunión',
  'Videollamada',
  'Mensaje',
  'Conversación con cliente',
  'Comunicación con procurador',
  'Comunicación con contrario',
  'Comunicación con notaría',
  'Comunicación con organismo',
  'Otra',
] as const

export const TIPOS_ENVIO = [
  'Informativa',
  'Solicitud de instrucciones',
  'Solicitud de documentación',
  'Remisión para firma',
  'Remisión de resolución',
  'Comunicación de plazo',
  'Entrega de documento final',
] as const

export type Comunicacion = {
  id: string
  expedienteId?: string
  lineaId?: string
  lineasRelacionadas?: string[]
  origen?: OrigenRelacion
  tipo: string
  fecha: string
  hora: string
  emisor: string
  destinatarios: string[]
  participantes: string[]
  canal: string
  asunto: string
  contenido: string
  resultado: string
  adjuntos: string[]
  proximaAccion: string
  clienteInformado: boolean
  incluibleReporte: boolean
  responsable: string
  enviada: boolean // en esta fase se registra como borrador/simulación

  /* --- Email redactado desde una tarea (mismo registro, sin duplicar) --- */
  /** Estado real del envío. "Borrador" mientras no haya confirmación del proveedor. */
  estadoEnvio?: EstadoEnvioEmail
  /** Tarea desde la que se redactó (además de `origen`). */
  tareaId?: string
  /** Cuenta remitente utilizada. */
  remitente?: string
  /** Destinatarios resueltos desde CONTACTOS (no se duplica la ficha). */
  para?: DestinatarioEmail[]
  copia?: DestinatarioEmail[]
  copiaOculta?: DestinatarioEmail[]
  /** Identificadores reales del proveedor, cuando exista integración. */
  mensajeId?: string
  conversacionId?: string
  /** Error literal devuelto por el proveedor, si lo hubo. */
  errorEnvio?: string
  /** Fecha y hora del envío confirmado. */
  enviadoEn?: string

  /* --- COMUNICACIONES (fase 1). Todos los campos son opcionales: los
     registros existentes siguen siendo válidos sin migración de datos. --- */
  /** Sentido de la comunicación. */
  direccion?: DireccionComunicacion
  /** Contacto principal al que pertenece la comunicación (nunca se pierde). */
  contactoId?: string
  /** Contexto comercial/operativo vinculado. */
  leadId?: string
  onboardingId?: string
  /** Vinculación excepcional a más de un expediente. */
  expedientesRelacionados?: string[]
  /** Buzón corporativo por el que entra o sale (nunca una persona). */
  cuenta?: string
  /** Triaje operativo: pendiente de tratar o ya tratada. */
  triaje?: EstadoTriaje
  /** Filtro operativo «Pendiente de contestar». No es un estado permanente. */
  pendienteContestar?: boolean
  /** Fecha y hora de la respuesta (alimenta el filtro «Últimos contestados»). */
  contestadaEn?: string
  /** Adjuntos con referencia al documento real; COMUNICACIONES no los aloja. */
  adjuntosRef?: AdjuntoComunicacion[]
  /** Tareas normales creadas a partir de esta comunicación. */
  tareasVinculadas?: string[]
  /** Tarea ESPECIAL DE COMUNICACIÓN abierta para contestarla, si existe. */
  tareaEspecialId?: string

  /** Notas internas del registro de llamada. */
  notasInternas?: string
  /** Comunicación de la que ésta es respuesta o reenvío. */
  respuestaDe?: string
}

/** Sentido de una comunicación. */
export const DIRECCIONES_COMUNICACION = ['Entrada', 'Salida'] as const
export type DireccionComunicacion = (typeof DIRECCIONES_COMUNICACION)[number]

/** Triaje: una comunicación entrante está pendiente hasta que se trata. */
export const ESTADOS_TRIAJE = ['Pendiente', 'Tratada'] as const
export type EstadoTriaje = (typeof ESTADOS_TRIAJE)[number]

/**
 * Adjunto de una comunicación. Sólo referencia: el archivo vive en el bloque
 * documental que corresponda (Lead, Onboarding, Expediente…).
 */
export type AdjuntoComunicacion = {
  nombre: string
  /** Documento del gestor documental donde se ha ubicado el archivo. */
  documentoId?: string
}

export const ESTADOS_ENVIO_EMAIL = ['Borrador', 'Enviado', 'Error'] as const
export type EstadoEnvioEmail = (typeof ESTADOS_ENVIO_EMAIL)[number]

/**
 * Destinatario de un email. Referencia al contacto por id: no se copian sus
 * datos a ninguna tabla paralela, sólo se conserva la dirección utilizada.
 */
export type DestinatarioEmail = {
  contactoId?: string
  nombre: string
  email: string
  entidad?: string
}

/* -------------------------- Intervinientes ------------------------ */

/**
 * Roles del contacto DENTRO de un expediente («Interviene como»).
 * No son datos de la ficha general del contacto. Catálogo preparado para
 * administrarse desde Configuración › Contactos.
 */
export const ROLES_INTERVINIENTE = [
  'Cliente',
  'Contraparte',
  'Abogado de la contraparte',
  'Abogado colaborador',
  'Procurador propio',
  'Procurador de la contraparte',
  'Perito propio',
  'Perito de la contraparte',
  'Notario',
  'Testigo',
  'Representante',
  'Familiar o persona vinculada',
  'Órgano judicial',
  'Administración u organismo público',
  'Otro interviniente',
] as const

export type IntervinienteOp = {
  id: string
  expedienteId: string
  contactoId?: string
  nombre: string
  rol: string
  contacto: string
  observaciones: string
  confidencialidad: 'Normal' | 'Restringida' | 'Confidencial'
}

/* ---------------------------- Auditoría --------------------------- */

export type AuditoriaItem = {
  id: string
  fecha: string
  usuario: string
  accion: string
  entidad: string
  entidadId: string
  expedienteId?: string
  anterior: string
  nuevo: string
}

/* ------------------------------------------------------------------ */
/* Semilla de demostración                                             */
/* ------------------------------------------------------------------ */

const HOY = hoyTexto()
const d = (n: number) => sumarDias(n)

type Semilla = {
  expedientes: ExpedienteOp[]
  lineas: LineaTrabajo[]
  ejecuciones: Ejecucion[]
  actuaciones: Actuacion[]
  documentos: Documento[]
  tareas: TareaOp[]
  fechas: FechaCritica[]
  comunicaciones: Comunicacion[]
  intervinientes: IntervinienteOp[]
  recordatorios: Recordatorio[]
  notificaciones: Notificacion[]

  auditoria: AuditoriaItem[]
}

const versionesTrabajo = (autor: string, fecha: string): VersionDocumento[] => [
  {
    numero: 1,
    tipo: 'Documento de trabajo',
    autor,
    fecha,
    comentarios: 'Primer borrador',
    definitiva: false,
  },
]

/** Convierte los expedientes ya existentes del CRM al nuevo modelo operativo. */
function desdeCrm(): ExpedienteOp[] {
  const naturalezaPorArea: Record<string, Naturaleza> = {
    Ejecución: 'Judicial',
    'Contratación civil': 'Judicial',
    Sucesiones: 'Extrajudicial',
    Inmobiliario: 'Extrajudicial',
    Societario: 'Extrajudicial',
  }
  const faseMap: Record<string, string> = {
    onboarding: 'diagnostico',
    preparacion: 'preparacion',
    casework: 'procedimiento',
    offboarding: 'cierre',
    ejecucion: 'ejecucion',
    aftercare: 'cerrado',
  }
  return EXPEDIENTES_CRM.map((e) => {
    const naturaleza = naturalezaPorArea[e.area] ?? 'Extrajudicial'
    const fase = faseMap[e.fase] ?? 'diagnostico'
    return {
      id: e.id,
      codigo: e.codigo,
      nombre: e.titulo,
      contactoId: e.contactoId,
      otrosClientes: [],
      responsable: e.responsable,
      equipo: e.equipo,
      area: e.area,
      tipoAsunto: e.area,
      naturaleza,
      estadoGeneral: (e.fase === 'aftercare' ? 'Cerrado' : 'Activo') as EstadoGeneral,
      fase: naturaleza === 'Extrajudicial' && fase === 'procedimiento' ? 'negociacion' : fase,
      estadoOperativo: 'En curso' as EstadoOperativoExp,
      dondeEstamos: e.estrategia,
      proximaAccion: e.proximaActuacion,
      dependencia: 'Debemos actuar nosotros' as Dependencia,
      prioridad: e.prioridad,
      carga: 'Media' as const,
      fechaApertura: e.apertura,
      ...(e.presupuestos[0] ? { presupuestoId: e.presupuestos[0] } : {}),
      ultimoMovimiento: e.fechaProxima,
      tiempoRegistrado: 6,
    } satisfies ExpedienteOp
  })
}

const nuevos: ExpedienteOp[] = [
  {
    id: 'EX-0101',
    codigo: 'EX-2026-0101',
    nombre: 'Reclamación de cantidad por obra defectuosa',
    contactoId: 'CT-0011',
    otrosClientes: [],
    responsable: 'Marta Solé',
    equipo: ['Marta Solé', 'Nuria Casals'],
    area: 'Contratación civil',
    tipoAsunto: 'Juicio ordinario',
    naturaleza: 'Judicial',
    estadoGeneral: 'Activo',
    fase: 'procedimiento',
    estadoOperativo: 'Pendiente de informar al cliente',
    dondeEstamos: 'Sentencia estimatoria recibida el 03/08/2026, pendiente de estudio de firmeza.',
    proximaAccion: 'Analizar sentencia y validar plazo de recurso',
    dependencia: 'Debemos actuar nosotros',
    prioridad: 'Alta',
    carga: 'Alta',
    fechaApertura: '14/01/2026',
    procedimiento: {
      organo: 'Juzgado de Primera Instancia nº 4 de Alicante',
      autos: '412/2026',
      nig: '03014-42-1-2026-0004123',
      tipo: 'Juicio ordinario',
      procurador: 'Rosa Ibáñez',
    },
    ultimoMovimiento: d(-2),
    tiempoRegistrado: 38.5,
  },
  {
    id: 'EX-0102',
    codigo: 'EX-2026-0102',
    nombre: 'Acuerdo de disolución de proindiviso familiar',
    contactoId: 'CT-0003',
    otrosClientes: [],
    responsable: 'Ana Torregrosa',
    equipo: ['Ana Torregrosa'],
    area: 'Civil patrimonial',
    tipoAsunto: 'Acuerdo extrajudicial',
    naturaleza: 'Extrajudicial',
    estadoGeneral: 'Activo',
    fase: 'negociacion',
    estadoOperativo: 'En espera',
    dondeEstamos: 'Acuerdo firmado; pendiente del pago aplazado de la segunda parte.',
    proximaAccion: 'Controlar el vencimiento del segundo pago',
    dependencia: 'Pendiente del contrario',
    prioridad: 'Media',
    carga: 'Media',
    fechaApertura: '22/02/2026',
    ultimoMovimiento: d(-9),
    tiempoRegistrado: 21,
  },
  {
    id: 'EX-0103',
    codigo: 'EX-2026-0103',
    nombre: 'Ejecución de sentencia de reclamación de rentas',
    contactoId: 'CT-0007',
    otrosClientes: [],
    responsable: 'Luis Ferrán',
    equipo: ['Luis Ferrán', 'Nuria Casals'],
    area: 'Arrendamientos',
    tipoAsunto: 'Ejecución de título judicial',
    naturaleza: 'Judicial',
    estadoGeneral: 'Activo',
    fase: 'ejecucion',
    estadoOperativo: 'En curso',
    dondeEstamos: 'Despachada la ejecución; en averiguación patrimonial.',
    proximaAccion: 'Solicitar embargo de saldos bancarios',
    dependencia: 'Pendiente del juzgado',
    prioridad: 'Alta',
    carga: 'Media',
    fechaApertura: '03/11/2025',
    procedimiento: {
      organo: 'Juzgado de Primera Instancia nº 2 de Elche',
      autos: '998/2025',
      nig: '03065-42-1-2025-0009981',
      tipo: 'Ejecución de títulos judiciales',
      procurador: 'Rosa Ibáñez',
    },
    ultimoMovimiento: d(-5),
    tiempoRegistrado: 44,
  },
  {
    id: 'EX-0104',
    codigo: 'EX-2026-0104',
    nombre: 'Cumplimiento de acuerdo de compra de participaciones',
    contactoId: 'CT-0002',
    otrosClientes: [],
    responsable: 'Marta Solé',
    equipo: ['Marta Solé'],
    area: 'Societario',
    tipoAsunto: 'Cumplimiento de acuerdo',
    naturaleza: 'Extrajudicial',
    estadoGeneral: 'Activo',
    fase: 'ejecucion',
    estadoOperativo: 'Bloqueado',
    dondeEstamos: 'Incumplimiento del segundo plazo; requerimiento notarial enviado.',
    proximaAccion: 'Valorar derivación a ejecución judicial',
    dependencia: 'Pendiente del obligado' as Dependencia,
    prioridad: 'Alta',
    carga: 'Media',
    fechaApertura: '18/03/2026',
    ultimoMovimiento: d(-16),
    tiempoRegistrado: 17.5,
  },
  {
    id: 'EX-0105',
    codigo: 'EX-2026-0105',
    nombre: 'Impugnación de acuerdos de junta de propietarios',
    contactoId: 'CT-0007',
    otrosClientes: [],
    responsable: 'Luis Ferrán',
    equipo: ['Luis Ferrán'],
    area: 'Propiedad horizontal',
    tipoAsunto: 'Juicio ordinario',
    naturaleza: 'Judicial',
    estadoGeneral: 'En espera',
    fase: 'espera-tercero',
    estadoOperativo: 'En espera',
    dondeEstamos: 'Demanda presentada; pendiente de admisión a trámite.',
    proximaAccion: 'Seguimiento de admisión con el procurador',
    dependencia: 'Pendiente del juzgado',
    prioridad: 'Media',
    carga: 'Ligera',
    fechaApertura: '09/05/2026',
    procedimiento: {
      organo: 'Juzgado de Primera Instancia nº 1 de Alicante',
      autos: '551/2026',
      nig: '03014-42-1-2026-0005512',
      tipo: 'Juicio ordinario',
      procurador: 'Rosa Ibáñez',
    },
    ultimoMovimiento: d(-40),
    tiempoRegistrado: 12,
  },
]

/** Cuatro reuniones de ejemplo para revisar la fase PREPARACIÓN. */
function reunionesEjemplo(): TareaOp[] {
  const base = (
    id: string,
    titulo: string,
    responsable: string,
    expedienteId: string | undefined,
    reunion: DatosReunion,
  ): TareaOp => ({
    id,
    titulo,
    descripcion: reunion.objeto,
    ...(expedienteId ? { expedienteId } : {}),
    responsable,
    colaboradores: [],
    prioridad: 'Media',
    estado: 'Pendiente',
    fechaInicio: d(0),
    vencimiento: d(5),
    recordatorio: '',
    checklist: [],
    resultado: '',
    tiempo: 0,
    documentos: [],
    creador: 'Igor Belmonte',
    especial: { tipo: 'Reunión' },
    reunion,
  })

  const as = (
    nombre: string,
    clase: ClaseAsistente,
    rol?: string,
    contactoId?: string,
  ): AsistenteReunion => ({
    id: `AS-${nombre.replace(/\W/g, '').slice(0, 8)}-${clase}`,
    nombre,
    clase,
    ...(rol ? { rol } : {}),
    ...(contactoId ? { contactoId } : {}),
  })

  return [
    base('TR-EX1', 'Reunión · Primera cita', 'Nuria Casals', 'EX-0101', {
      estado: 'Preparación',
      tipo: 'Primera cita',
      conQuien: nombreContacto('CT-0011'),
      objeto: 'Primera valoración del asunto y explicación del funcionamiento del despacho',
      duracionEstimada: '45 min',
      preferenciasFecha: 'Esta semana',
      franja: 'Mañana',
      preferenciasLugar: 'Despacho Bilbao',
      indicaciones: 'Confirmar asistencia y revisar que los datos de contacto estén completos.',
      asistentes: [
        as(nombreContacto('CT-0011'), 'Externo', 'Cliente', 'CT-0011'),
        as('Nuria Casals', 'Profesional', 'Responsable de preparación'),
      ],
      preparacion: [],
      notas: [],
      notasIds: [],
    }),
    base('TR-EX2', 'Reunión · Seguimiento', 'Nuria Casals', 'EX-0101', {
      estado: 'Preparación',
      tipo: 'Seguimiento',
      conQuien: `${nombreContacto('CT-0011')}, Rosa Ibáñez`,
      objeto: 'Explicar opciones jurídicas y próximos pasos',
      duracionEstimada: '60 min',
      preferenciasFecha: 'Próxima semana',
      franja: 'Tarde',
      preferenciasLugar: 'Despacho Rekalde',
      indicaciones: 'Revisar documentación pendiente antes de confirmar la cita.',
      asistentes: [
        as(nombreContacto('CT-0011'), 'Externo', 'Cliente', 'CT-0011'),
        as('Rosa Ibáñez', 'Externo', 'Procurador'),
        as('Marta Solé', 'Profesional', 'Abogada responsable'),
      ],
      preparacion: [],
      notas: [],
      notasIds: [],
    }),
    base('TR-EX3', 'Reunión · Interna', 'Marta Solé', 'EX-0103', {
      estado: 'Preparación',
      tipo: 'Interna',
      conQuien: 'Marta Solé, Igor Belmonte, Luis Ferrán',
      objeto: 'Revisión interna de la estrategia de ejecución y reparto de trabajo',
      duracionEstimada: '30 min',
      preferenciasFecha: 'Lo antes posible',
      franja: 'Indiferente',
      preferenciasLugar: 'Despacho Bilbao',
      indicaciones: 'Preparar el estado actualizado de la averiguación patrimonial.',
      asistentes: [
        as('Marta Solé', 'Profesional', 'Abogada responsable'),
        as('Igor Belmonte', 'Interno', 'Socio'),
        as('Luis Ferrán', 'Interno', 'Abogado'),
      ],
      preparacion: [],
      notas: [],
      notasIds: [],
    }),
    base('TR-EX4', 'Reunión · Firma / formalización', 'Nuria Casals', 'EX-0104', {
      estado: 'Preparación',
      tipo: 'Firma / formalización',
      conQuien: `${nombreContacto('CT-0002')}, Notaría Ruiz de Alda`,
      objeto: 'Firma de la escritura y entrega de copias al cliente',
      duracionEstimada: '90 min',
      preferenciasFecha: 'Antes de una fecha',
      preferenciaFechaValor: d(12),
      franja: 'Mañana',
      preferenciasLugar: 'Fuera del despacho',
      direccion: 'Notaría Ruiz de Alda · Gran Vía 20, Bilbao',
      indicaciones: 'Confirmar minuta con la notaría y llevar copias de la documentación.',
      asistentes: [
        as(nombreContacto('CT-0002'), 'Externo', 'Cliente', 'CT-0002'),
        as('Notaría Ruiz de Alda', 'Externo', 'Notaría'),
        as('Igor Belmonte', 'Profesional', 'Socio'),
      ],
      preparacion: [],
      notas: [],
      notasIds: [],
    }),
  ]
}

function semilla(): Semilla {
  const expedientes = [...desdeCrm(), ...nuevos]

  const lineas: LineaTrabajo[] = [
    {
      id: 'LT-0001',
      expedienteId: 'EX-0101',
      nombre: 'Procedimiento judicial',
      tipo: 'Procedimiento judicial',
      descripcion: 'Juicio ordinario de reclamación de cantidad.',
      estado: 'En curso',
      responsable: 'Marta Solé',
      fechaInicio: '14/01/2026',
      dondeEstamos: 'Sentencia en primera instancia estimatoria parcial.',
      proximaAccion: 'Estudio de recurso',
      dependencia: 'Debemos actuar nosotros',
      presupuesto: 'Incluida en el presupuesto PR-0003',
    },
    {
      id: 'LT-0002',
      expedienteId: 'EX-0101',
      nombre: 'Tasación de costas',
      tipo: 'Tasación de costas',
      descripcion: 'Preparación de la tasación una vez firme la sentencia.',
      estado: 'En curso',
      responsable: 'Nuria Casals',
      fechaInicio: d(-1),
      dondeEstamos: 'Pendiente de firmeza.',
      proximaAccion: 'Preparar minuta y derechos de procurador',
      dependencia: 'Sin acción inmediata',
      presupuesto: 'Pendiente de comprobar',
    },
    {
      id: 'LT-0011',
      expedienteId: 'EX-0101',
      nombre: 'Recuperación posesoria',
      tipo: 'Procedimiento judicial',
      descripcion: 'Frente dirigido a recuperar la posesión efectiva del inmueble.',
      objetivo: 'Recuperar la posesión efectiva del inmueble.',
      indicador: 'Acta de entrega o lanzamiento practicado.',
      estado: 'En curso',
      situacion: 'Debemos trabajo',
      prioridad: 'Alta',
      responsable: 'Marta Solé',
      colaboradores: ['Nuria Casals'],
      fechaInicio: d(-60),
      fechaObjetivo: d(60),
      dondeEstamos: 'Demanda presentada.',
      ultimoAvance: 'Demanda presentada en el juzgado.',
      fechaUltimoAvance: d(-12),
      proximaAccion: 'Revisar la admisión a trámite',
      responsableSiguienteAccion: 'Marta Solé',
      fechaSiguienteAccion: d(5),
      dependencia: 'Debemos actuar nosotros',
      presupuesto: 'Incluida en el presupuesto PR-0003',
      resultadoEsperado: 'Recuperación de la posesión.',
      orden: 1,
    },
    {
      id: 'LT-0012',
      expedienteId: 'EX-0101',
      nombre: 'Reclamación de rentas',
      tipo: 'Procedimiento judicial',
      descripcion: 'Reclamación de rentas y cantidades asimiladas impagadas.',
      objetivo: 'Obtener el pago de las rentas y cantidades debidas.',
      indicador: 'Cobro íntegro o título ejecutivo por el importe reclamado.',
      estado: 'En análisis',
      situacion: 'Debemos trabajo',
      prioridad: 'Alta',
      responsable: 'Nuria Casals',
      fechaInicio: d(-45),
      dondeEstamos: 'Liquidación de deuda en revisión.',
      proximaAccion: 'Actualizar la liquidación de deuda',
      responsableSiguienteAccion: 'Nuria Casals',
      fechaSiguienteAccion: d(3),
      dependencia: 'Debemos actuar nosotros',
      presupuesto: 'Incluida',
      orden: 2,
    },
    {
      id: 'LT-0013',
      expedienteId: 'EX-0101',
      nombre: 'Negociación de salida voluntaria',
      tipo: 'Negociación',
      descripcion: 'Vía negociada para la entrega pactada de la vivienda.',
      objetivo: 'Alcanzar una entrega pactada de la vivienda.',
      indicador: 'Acuerdo firmado con fecha de entrega.',
      estado: 'En espera',
      situacion: 'Depende de tercero',
      prioridad: 'Media',
      responsable: 'Marta Solé',
      fechaInicio: d(-30),
      dondeEstamos: 'Propuesta remitida a la contraparte.',
      ultimoAvance: 'Propuesta remitida a la contraparte.',
      fechaUltimoAvance: d(-18),
      proximaAccion: 'Realizar seguimiento de la propuesta',
      responsableSiguienteAccion: 'Marta Solé',
      fechaSiguienteAccion: d(2),
      dependencia: 'Pendiente del contrario',
      dependeDe: 'Contraparte y su letrado',
      fechaSeguimiento: d(-2),
      presupuesto: 'Pendiente de comprobar',
      orden: 3,
    },
    {
      id: 'LT-0014',
      expedienteId: 'EX-0101',
      nombre: 'Daños en el inmueble',
      tipo: 'Tramitación principal',
      descripcion: 'Comprobación y reclamación de los daños existentes en la vivienda.',
      objetivo: 'Comprobar, valorar y reclamar los daños existentes.',
      estado: 'En curso',
      situacion: 'Sin acción inmediata',
      prioridad: 'Baja',
      responsable: 'Luis Ferrán',
      fechaInicio: d(-20),
      dondeEstamos: 'A la espera de acceder al inmueble.',
      proximaAccion: '',
      bloqueo: 'Pendiente de recuperar la posesión del inmueble.',
      dependencia: 'Sin acción inmediata',
      presupuesto: 'No incluida',
      parentId: 'LT-0011',
      orden: 4,
    },

    {
      id: 'LT-0003',
      expedienteId: 'EX-0102',
      nombre: 'Negociación y acuerdo',
      tipo: 'Negociación',
      descripcion: 'Negociación del reparto y firma del acuerdo.',
      estado: 'Cerrada',
      responsable: 'Ana Torregrosa',
      fechaInicio: '22/02/2026',
      fechaCierre: '12/06/2026',
      dondeEstamos: 'Acuerdo firmado por todas las partes.',
      proximaAccion: '—',
      dependencia: 'Sin acción inmediata',
      presupuesto: 'Incluida',
    },
    {
      id: 'LT-0004',
      expedienteId: 'EX-0102',
      nombre: 'Ejecución del acuerdo',
      tipo: 'Ejecución',
      descripcion: 'Control del pago aplazado pactado.',
      estado: 'En curso',
      responsable: 'Ana Torregrosa',
      fechaInicio: '12/06/2026',
      dondeEstamos: 'Primer pago recibido; segundo pago pendiente.',
      proximaAccion: 'Control del vencimiento',
      dependencia: 'Pendiente del contrario',
      presupuesto: 'Parcialmente incluida',
      esEjecucion: true,
    },
    {
      id: 'LT-0005',
      expedienteId: 'EX-0103',
      nombre: 'Ejecución judicial de la sentencia',
      tipo: 'Ejecución',
      descripcion: 'Ejecución del título judicial obtenido.',
      estado: 'En curso',
      responsable: 'Luis Ferrán',
      fechaInicio: '03/11/2025',
      dondeEstamos: 'Averiguación patrimonial en curso.',
      proximaAccion: 'Solicitar embargo de saldos',
      dependencia: 'Pendiente del juzgado',
      presupuesto: 'Requiere ampliación',
      esEjecucion: true,
    },
    {
      id: 'LT-0006',
      expedienteId: 'EX-0104',
      nombre: 'Cumplimiento del acuerdo',
      tipo: 'Cumplimiento de acuerdo',
      descripcion: 'Seguimiento del pago aplazado y entrega documental.',
      estado: 'En curso',
      responsable: 'Marta Solé',
      fechaInicio: '18/03/2026',
      dondeEstamos: 'Incumplimiento parcial; requerimiento notarial remitido.',
      proximaAccion: 'Decidir derivación a ejecución judicial',
      dependencia: 'Pendiente de otro tercero',
      presupuesto: 'No incluida',
      esEjecucion: true,
    },
    {
      id: 'LT-0007',
      expedienteId: 'EX-0105',
      nombre: 'Tramitación principal',
      tipo: 'Tramitación principal',
      descripcion: 'Impugnación de los acuerdos adoptados en junta.',
      estado: 'En espera',
      responsable: 'Luis Ferrán',
      fechaInicio: '09/05/2026',
      dondeEstamos: 'Demanda presentada.',
      proximaAccion: 'Seguimiento de admisión',
      dependencia: 'Pendiente del juzgado',
      presupuesto: 'Incluida',
    },
  ]

  const ejecuciones: Ejecucion[] = [
    {
      id: 'EJ-0001',
      expedienteId: 'EX-0103',
      lineaId: 'LT-0005',
      modalidad: 'Ejecución judicial',
      tipo: 'Sentencia firme',
      estado: 'Averiguación patrimonial',
      titulo: 'Sentencia 145/2025 del JPI nº 2 de Elche',
      objeto: 'Cobro de rentas impagadas y costas',
      obligado: 'Comercial Benalúa, S.L.',
      beneficiario: 'Patrimonios Alicante, S.L.',
      prestacion: 'Pago de cantidad',
      importeReclamado: 42500,
      importeRecuperado: 9800,
      responsable: 'Luis Ferrán',
      fechaInicio: '03/11/2025',
      dondeEstamos: 'Despachada la ejecución, en averiguación de bienes.',
      proximaAccion: 'Solicitar embargo de saldos bancarios',
      dependencia: 'Pendiente del juzgado',
      alcance: 'Incluye ejecución hasta realización de bienes.',
      situacionPresupuestaria: 'Requiere ampliación',
      proximoControl: d(6),
      naturalezaOriginal: 'Judicial',
    },
    {
      id: 'EJ-0002',
      expedienteId: 'EX-0102',
      lineaId: 'LT-0004',
      modalidad: 'Ejecución extrajudicial',
      tipo: 'Pago aplazado',
      estado: 'Pendiente del obligado',
      titulo: 'Acuerdo de disolución de proindiviso de 12/06/2026',
      objeto: 'Cobro del segundo plazo pactado',
      obligado: 'Hermanos Sempere, C.B.',
      beneficiario: 'Carmen Sempere Ruiz',
      prestacion: 'Pago de 30.000 € en dos plazos',
      importeReclamado: 30000,
      importeRecuperado: 15000,
      responsable: 'Ana Torregrosa',
      fechaInicio: '12/06/2026',
      dondeEstamos: 'Primer plazo abonado en fecha.',
      proximaAccion: 'Requerir el segundo plazo al vencimiento',
      dependencia: 'Pendiente del contrario',
      alcance: 'Control de cumplimiento y requerimientos.',
      situacionPresupuestaria: 'Parcialmente incluida',
      proximoControl: d(12),
      naturalezaOriginal: 'Extrajudicial',
    },
    {
      id: 'EJ-0003',
      expedienteId: 'EX-0104',
      lineaId: 'LT-0006',
      modalidad: 'Ejecución extrajudicial',
      tipo: 'Cumplimiento de contrato',
      estado: 'Requerimiento de cumplimiento',
      titulo: 'Contrato de compra de participaciones de 18/03/2026',
      objeto: 'Pago del segundo plazo y entrega de títulos',
      obligado: 'Grupo Ribera Patrimonio, S.L.',
      beneficiario: 'Inversiones Torrelodones, S.L.',
      prestacion: 'Pago de 85.000 € y entrega de documentación',
      importeReclamado: 85000,
      importeRecuperado: 25000,
      responsable: 'Marta Solé',
      fechaInicio: '18/03/2026',
      dondeEstamos: 'Requerimiento notarial practicado sin respuesta.',
      proximaAccion: 'Valorar derivación a ejecución judicial',
      dependencia: 'Pendiente de otro tercero',
      alcance: 'Requerimientos y negociación de incidencia.',
      situacionPresupuestaria: 'Requiere nuevo presupuesto',
      proximoControl: '',
      naturalezaOriginal: 'Extrajudicial',
    },
  ]

  const actuaciones: Actuacion[] = [
    {
      id: 'AC-0001',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      tipo: 'Recepción documental',
      titulo: 'Recepción de sentencia por LexNET',
      descripcion: 'Se recibe sentencia estimatoria parcial a través del procurador.',
      fecha: d(-2),
      hora: '09:40',
      autor: 'Nuria Casals',
      responsable: 'Marta Solé',
      participantes: ['Rosa Ibáñez'],
      estado: 'Completada',
      resultado: 'Sentencia incorporada al expediente.',
      proximaAccion: 'Analizar y validar plazo de recurso',
      tiempo: 0.3,
      facturable: false,
      visibleCliente: true,
      clienteInformado: false,
    },
    {
      id: 'AC-0002',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      tipo: 'Estudio o análisis jurídico',
      titulo: 'Análisis de la sentencia y viabilidad de recurso',
      descripcion: 'Estudio de fundamentos y cuantía estimada para valorar apelación.',
      fecha: d(0),
      hora: '11:00',
      autor: 'Marta Solé',
      responsable: 'Marta Solé',
      participantes: [],
      estado: 'En curso',
      resultado: '',
      proximaAccion: 'Informar al cliente del resultado',
      tiempo: 2,
      facturable: true,
      visibleCliente: true,
      clienteInformado: false,
    },
    {
      id: 'AC-0003',
      expedienteId: 'EX-0101',
      tipo: 'Llamada',
      titulo: 'Llamada con el cliente para anticipar el resultado',
      descripcion: 'Se comunica de forma preliminar el sentido de la sentencia.',
      fecha: d(-1),
      hora: '17:20',
      autor: 'Marta Solé',
      responsable: 'Marta Solé',
      participantes: ['Cliente'],
      estado: 'Pendiente de reportar',
      resultado: 'Cliente conforme, solicita informe escrito.',
      proximaAccion: 'Elaborar informe de resultado',
      tiempo: 0.4,
      facturable: false,
      visibleCliente: true,
      clienteInformado: true,
    },
    {
      id: 'AC-0004',
      expedienteId: 'EX-0102',
      lineaId: 'LT-0003',
      tipo: 'Reunión',
      titulo: 'Reunión de firma del acuerdo',
      descripcion: 'Firma del acuerdo de disolución con todas las partes.',
      fecha: '12/06/2026',
      hora: '10:00',
      autor: 'Ana Torregrosa',
      responsable: 'Ana Torregrosa',
      participantes: ['Cliente', 'Contraparte', 'Notaría Ruiz de Alda'],
      estado: 'Completada',
      resultado: 'Acuerdo firmado.',
      proximaAccion: 'Control del pago aplazado',
      tiempo: 1.5,
      facturable: true,
      visibleCliente: true,
      clienteInformado: true,
    },
    {
      id: 'AC-0005',
      expedienteId: 'EX-0103',
      lineaId: 'LT-0005',
      tipo: 'Actuación procesal',
      titulo: 'Escrito de averiguación patrimonial',
      descripcion: 'Presentación de escrito solicitando averiguación de bienes.',
      fecha: d(-5),
      hora: '12:15',
      autor: 'Luis Ferrán',
      responsable: 'Luis Ferrán',
      participantes: ['Rosa Ibáñez'],
      estado: 'Completada',
      resultado: 'Escrito presentado con justificante.',
      proximaAccion: 'Esperar respuesta del juzgado',
      tiempo: 1.2,
      facturable: true,
      visibleCliente: false,
      clienteInformado: false,
    },
    {
      id: 'AC-0006',
      expedienteId: 'EX-0104',
      lineaId: 'LT-0006',
      tipo: 'Comunicación escrita',
      titulo: 'Requerimiento notarial de cumplimiento',
      descripcion: 'Se practica requerimiento notarial al obligado.',
      fecha: d(-16),
      hora: '09:00',
      autor: 'Marta Solé',
      responsable: 'Marta Solé',
      participantes: ['Notaría Ruiz de Alda'],
      estado: 'Pendiente de completar',
      resultado: 'Sin respuesta del obligado.',
      proximaAccion: 'Valorar ejecución judicial',
      tiempo: 1,
      facturable: true,
      visibleCliente: true,
      clienteInformado: false,
    },
    {
      id: 'AC-0007',
      expedienteId: 'EX-0105',
      lineaId: 'LT-0007',
      tipo: 'Presentación',
      titulo: 'Presentación de la demanda de impugnación',
      descripcion: 'Demanda presentada por el procurador vía LexNET.',
      fecha: '09/05/2026',
      hora: '13:45',
      autor: 'Luis Ferrán',
      responsable: 'Luis Ferrán',
      participantes: ['Rosa Ibáñez'],
      estado: 'Completada',
      resultado: 'Presentada con justificante.',
      proximaAccion: 'Seguimiento de admisión',
      tiempo: 3,
      facturable: true,
      visibleCliente: true,
      clienteInformado: true,
    },
    {
      id: 'AC-0008',
      expedienteId: 'EX-0101',
      tipo: 'Llamada',
      titulo: 'Llamada al cliente para confirmar recepción de documentación',
      descripcion: 'Se confirma con el cliente la recepción de la documentación remitida.',
      fecha: '03/07/2026',
      hora: '10:15',
      fechaRegistro: '03/07/2026 10:40',
      autor: 'Marta Solé',
      creadoPor: 'Marta Solé',
      responsable: 'Marta Solé',
      participantes: ['Cliente'],
      estado: 'Completada',
      estadoRegistro: 'Confirmada',
      resultado: '',
      proximaAccion: '',
      tiempo: 0.2,
      facturable: false,
      visibleCliente: false,
      clienteInformado: false,
      esActuacion: false,
      esHito: false,
    },
    {
      id: 'AC-0009',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      tipo: 'Revisión o análisis',
      titulo: 'Revisión y cierre del escrito de demanda',
      descripcion: 'Revisión final del escrito antes de su presentación.',
      fecha: '01/07/2026',
      hora: '18:00',
      fechaRegistro: '01/07/2026 18:30',
      autor: 'Luis Ferrán',
      creadoPor: 'Luis Ferrán',
      responsable: 'Luis Ferrán',
      participantes: [],
      estado: 'Completada',
      estadoRegistro: 'Confirmada',
      resultado: 'Escrito cerrado y listo para presentación.',
      proximaAccion: '',
      tiempo: 2,
      facturable: true,
      visibleCliente: false,
      clienteInformado: false,
      esActuacion: true,
      tipoActuacion: 'Documental',
      esHito: false,
    },
    {
      id: 'AC-0010',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      tipo: 'Presentación de documento o escrito',
      titulo: 'Demanda presentada',
      descripcion: 'Presentación de la demanda por vía telemática.',
      fecha: '28/06/2026',
      hora: '12:00',
      fechaRegistro: '29/06/2026 09:10',
      autor: 'Luis Ferrán',
      creadoPor: 'Luis Ferrán',
      responsable: 'Luis Ferrán',
      participantes: ['Rosa Ibáñez'],
      estado: 'Completada',
      estadoRegistro: 'Confirmada',
      resultado: 'Presentada con justificante telemático.',
      proximaAccion: '',
      tiempo: 1.5,
      facturable: true,
      visibleCliente: true,
      clienteInformado: true,
      esActuacion: true,
      tipoActuacion: 'Judicial',
      esJudicial: true,
      contieneDocumentoJudicial: true,
      esHito: true,
      tituloHito: 'Demanda presentada',
      categoriaHito: 'Actuación procesal',
    },
    {
      id: 'AC-0011',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      tipo: 'Documento recibido',
      titulo: 'Demanda admitida a trámite',
      descripcion: 'El juzgado dicta decreto de admisión a trámite.',
      fecha: '05/07/2026',
      hora: '09:30',
      fechaRegistro: '08/07/2026 08:45',
      autor: 'Nuria Casals',
      creadoPor: 'Nuria Casals',
      responsable: 'Luis Ferrán',
      participantes: ['Rosa Ibáñez'],
      estado: 'Completada',
      estadoRegistro: 'Confirmada',
      resultado: 'Admisión a trámite notificada.',
      proximaAccion: '',
      tiempo: 0.3,
      facturable: false,
      visibleCliente: true,
      clienteInformado: true,
      esActuacion: true,
      tipoActuacion: 'Judicial',
      esJudicial: true,
      esHito: true,
      tituloHito: 'Demanda admitida a trámite',
      categoriaHito: 'Actuación procesal',
    },
  ]

  const documentos: Documento[] = [
    {
      id: 'DOC-0001',
      nombre: 'Sentencia 231/2026 — Juicio ordinario 412/2026',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      actuacionOrigenId: 'AC-0001',
      actuacionesRelacionadas: ['AC-0002'],
      archivo: 'sentencia-231-2026.pdf',
      descripcion: 'Sentencia estimatoria parcial de la reclamación de cantidad.',
      tipoDocumental: 'Sentencia',
      origen: 'Recibido',
      autorEmisor: 'Juzgado de Primera Instancia nº 4 de Alicante',
      destinatario: 'Despacho',
      fechaDocumento: d(-3),
      fechaIncorporacion: d(-2),
      responsable: 'Marta Solé',
      estado: 'En curso',
      version: 1,
      versiones: [],
      confidencialidad: 'Normal',
      etiquetas: ['sentencia', 'plazo'],
      observaciones: 'Puede contener plazo de recurso.',
      judicial: true,
      entregable: false,
      datosJudiciales: {
        organo: 'Juzgado de Primera Instancia nº 4 de Alicante',
        autos: '412/2026',
        nig: '03014-42-1-2026-0004123',
        tipoProcedimiento: 'Juicio ordinario',
        parte: 'Juzgado',
        procurador: 'Rosa Ibáñez',
        fechaRecepcion: d(-2),
        fechaNotificacion: d(-2),
        fechaPresentacion: '',
        canal: 'LexNET',
        justificante: 'Acuse de notificación LexNET',
        puedeContenerPlazo: true,
        estadoPlazo: 'Posible plazo pendiente de validar',
        actuacionExigida: 'Valorar recurso de apelación',
        responsableControl: 'Marta Solé',
        criticidad: 'Alta',
      },
      clienteInformado: false,
    },
    {
      id: 'DOC-0002',
      nombre: 'Providencia de señalamiento',
      expedienteId: 'EX-0105',
      lineaId: 'LT-0007',
      actuacionOrigenId: 'AC-0007',
      actuacionesRelacionadas: [],
      archivo: 'providencia-551-2026.pdf',
      descripcion: 'Providencia acordando el traslado de la demanda.',
      tipoDocumental: 'Providencia',
      origen: 'Recibido',
      autorEmisor: 'Juzgado de Primera Instancia nº 1 de Alicante',
      destinatario: 'Despacho',
      fechaDocumento: '22/05/2026',
      fechaIncorporacion: '23/05/2026',
      responsable: 'Luis Ferrán',
      estado: 'Revisado',
      version: 1,
      versiones: [],
      confidencialidad: 'Normal',
      etiquetas: ['providencia'],
      observaciones: 'Revisada; no requiere actuación derivada.',
      judicial: true,
      entregable: false,
      datosJudiciales: {
        organo: 'Juzgado de Primera Instancia nº 1 de Alicante',
        autos: '551/2026',
        nig: '03014-42-1-2026-0005512',
        tipoProcedimiento: 'Juicio ordinario',
        parte: 'Juzgado',
        procurador: 'Rosa Ibáñez',
        fechaRecepcion: '23/05/2026',
        fechaNotificacion: '23/05/2026',
        fechaPresentacion: '',
        canal: 'Procurador',
        justificante: 'Correo del procurador',
        puedeContenerPlazo: false,
        estadoPlazo: 'No contiene plazo',
        actuacionExigida: '',
        responsableControl: 'Luis Ferrán',
        criticidad: 'Baja',
      },
      clienteInformado: true,
    },
    {
      id: 'DOC-0003',
      nombre: 'Demanda de impugnación de acuerdos',
      expedienteId: 'EX-0105',
      lineaId: 'LT-0007',
      actuacionOrigenId: 'AC-0007',
      actuacionesRelacionadas: [],
      archivo: 'demanda-impugnacion-v3.pdf',
      descripcion: 'Demanda presentada ante el JPI nº 1 de Alicante.',
      tipoDocumental: 'Demanda',
      origen: 'Elaborado por el despacho',
      autorEmisor: 'Luis Ferrán',
      destinatario: 'Juzgado de Primera Instancia nº 1 de Alicante',
      fechaDocumento: '08/05/2026',
      fechaIncorporacion: '08/05/2026',
      responsable: 'Luis Ferrán',
      estado: 'Presentado',
      version: 3,
      versiones: [
        {
          numero: 1,
          tipo: 'Documento de trabajo',
          autor: 'Luis Ferrán',
          fecha: '28/04/2026',
          comentarios: 'Borrador inicial',
          definitiva: false,
        },
        {
          numero: 2,
          tipo: 'Versión revisada',
          autor: 'Igor Belmonte',
          fecha: '05/05/2026',
          comentarios: 'Revisión de fundamentos',
          definitiva: false,
        },
        {
          numero: 3,
          tipo: 'Versión presentada o entregada',
          autor: 'Luis Ferrán',
          fecha: '09/05/2026',
          comentarios: 'Presentada por LexNET',
          definitiva: true,
        },
      ],
      confidencialidad: 'Normal',
      etiquetas: ['demanda', 'judicial', 'entregable'],
      observaciones: 'Documento judicial y entregable al cliente.',
      judicial: true,
      entregable: true,
      datosJudiciales: {
        organo: 'Juzgado de Primera Instancia nº 1 de Alicante',
        autos: '551/2026',
        nig: '03014-42-1-2026-0005512',
        tipoProcedimiento: 'Juicio ordinario',
        parte: 'Despacho',
        procurador: 'Rosa Ibáñez',
        fechaRecepcion: '',
        fechaNotificacion: '',
        fechaPresentacion: '09/05/2026',
        canal: 'LexNET',
        justificante: 'Justificante LexNET 2026/55112',
        puedeContenerPlazo: false,
        estadoPlazo: 'No contiene plazo',
        actuacionExigida: '',
        responsableControl: 'Luis Ferrán',
        criticidad: 'Media',
      },
      datosEntregable: {
        destinatario: 'Juzgado y cliente',
        finalidad: 'Iniciar el procedimiento de impugnación',
        requiereRevision: true,
        requiereAprobacion: true,
        requiereFirma: true,
        fechaPrevista: '08/05/2026',
        fechaEfectiva: '09/05/2026',
        medio: 'LexNET',
        justificante: 'Justificante LexNET 2026/55112',
      },
      clienteInformado: true,
    },
    {
      id: 'DOC-0004',
      nombre: 'Informe jurídico sobre viabilidad de recurso',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      actuacionOrigenId: 'AC-0002',
      actuacionesRelacionadas: [],
      archivo: 'informe-viabilidad-recurso.docx',
      descripcion: 'Informe entregable al cliente con el análisis de la sentencia.',
      tipoDocumental: 'Informe',
      origen: 'Elaborado por el despacho',
      autorEmisor: 'Marta Solé',
      destinatario: 'Cliente',
      fechaDocumento: d(0),
      fechaIncorporacion: d(0),
      responsable: 'Marta Solé',
      estado: 'En curso',
      version: 1,
      versiones: versionesTrabajo('Marta Solé', d(0)),
      confidencialidad: 'Normal',
      etiquetas: ['informe', 'entregable'],
      observaciones: 'No es documento judicial.',
      judicial: false,
      entregable: true,
      datosEntregable: {
        destinatario: 'Cliente',
        finalidad: 'Informar del resultado y opciones de recurso',
        requiereRevision: true,
        requiereAprobacion: false,
        requiereFirma: false,
        fechaPrevista: d(3),
        fechaEfectiva: '',
        medio: 'Email',
        justificante: '',
      },
      clienteInformado: false,
    },
    {
      id: 'DOC-0005',
      nombre: 'Acuerdo de disolución de proindiviso',
      expedienteId: 'EX-0102',
      lineaId: 'LT-0003',
      actuacionOrigenId: 'AC-0004',
      actuacionesRelacionadas: [],
      archivo: 'acuerdo-proindiviso-firmado.pdf',
      descripcion: 'Acuerdo firmado por todas las partes.',
      tipoDocumental: 'Acuerdo',
      origen: 'Elaborado por el despacho',
      autorEmisor: 'Ana Torregrosa',
      destinatario: 'Partes firmantes',
      fechaDocumento: '12/06/2026',
      fechaIncorporacion: '12/06/2026',
      responsable: 'Ana Torregrosa',
      estado: 'Definitivo',
      version: 4,
      versiones: [
        {
          numero: 1,
          tipo: 'Documento de trabajo',
          autor: 'Ana Torregrosa',
          fecha: '20/05/2026',
          comentarios: 'Primer borrador',
          definitiva: false,
        },
        {
          numero: 2,
          tipo: 'Versión revisada',
          autor: 'Igor Belmonte',
          fecha: '28/05/2026',
          comentarios: 'Ajuste de calendario de pagos',
          definitiva: false,
        },
        {
          numero: 3,
          tipo: 'Versión aprobada',
          autor: 'Cliente',
          fecha: '05/06/2026',
          comentarios: 'Conformidad del cliente',
          definitiva: false,
        },
        {
          numero: 4,
          tipo: 'Versión firmada',
          autor: 'Partes',
          fecha: '12/06/2026',
          comentarios: 'Firmado en reunión',
          definitiva: true,
        },
      ],
      confidencialidad: 'Restringida',
      etiquetas: ['acuerdo'],
      observaciones: 'Versión definitiva: no puede sobrescribirse.',
      judicial: false,
      entregable: true,
      datosEntregable: {
        destinatario: 'Cliente y contraparte',
        finalidad: 'Formalizar la disolución',
        requiereRevision: true,
        requiereAprobacion: true,
        requiereFirma: true,
        fechaPrevista: '12/06/2026',
        fechaEfectiva: '12/06/2026',
        medio: 'Entrega física',
        justificante: 'Acta de firma',
      },
      clienteInformado: true,
    },
    {
      id: 'DOC-0006',
      nombre: 'Contrato de compra de participaciones',
      expedienteId: 'EX-0104',
      lineaId: 'LT-0006',
      actuacionesRelacionadas: [],
      archivo: 'contrato-participaciones.pdf',
      descripcion: 'Contrato origen de la obligación en cumplimiento.',
      tipoDocumental: 'Contrato',
      origen: 'Recibido',
      autorEmisor: 'Grupo Ribera Patrimonio, S.L.',
      destinatario: 'Despacho',
      fechaDocumento: '18/03/2026',
      fechaIncorporacion: '19/03/2026',
      responsable: 'Marta Solé',
      estado: 'Tratado',
      version: 1,
      versiones: [],
      confidencialidad: 'Normal',
      etiquetas: ['contrato'],
      observaciones: '',
      judicial: false,
      entregable: false,
      clienteInformado: true,
    },
    {
      id: 'DOC-0007',
      nombre: 'Escrito de solicitud de embargo',
      expedienteId: 'EX-0103',
      lineaId: 'LT-0005',
      actuacionOrigenId: 'AC-0005',
      actuacionesRelacionadas: [],
      archivo: 'escrito-embargo-borrador.docx',
      descripcion: 'Escrito pendiente de firma para solicitar el embargo de saldos.',
      tipoDocumental: 'Escrito procesal',
      origen: 'Elaborado por el despacho',
      autorEmisor: 'Luis Ferrán',
      destinatario: 'Juzgado de Primera Instancia nº 2 de Elche',
      fechaDocumento: d(-1),
      fechaIncorporacion: d(-1),
      responsable: 'Luis Ferrán',
      estado: 'Pendiente de firma',
      version: 2,
      versiones: [
        {
          numero: 1,
          tipo: 'Documento de trabajo',
          autor: 'Nuria Casals',
          fecha: d(-4),
          comentarios: 'Borrador',
          definitiva: false,
        },
        {
          numero: 2,
          tipo: 'Versión revisada',
          autor: 'Luis Ferrán',
          fecha: d(-1),
          comentarios: 'Revisado, pendiente de firma',
          definitiva: false,
        },
      ],
      confidencialidad: 'Normal',
      etiquetas: ['ejecución', 'entregable'],
      observaciones: '',
      judicial: true,
      entregable: true,
      datosJudiciales: {
        organo: 'Juzgado de Primera Instancia nº 2 de Elche',
        autos: '998/2025',
        nig: '03065-42-1-2025-0009981',
        tipoProcedimiento: 'Ejecución de títulos judiciales',
        parte: 'Despacho',
        procurador: 'Rosa Ibáñez',
        fechaRecepcion: '',
        fechaNotificacion: '',
        fechaPresentacion: '',
        canal: 'LexNET',
        justificante: '',
        puedeContenerPlazo: false,
        estadoPlazo: 'No contiene plazo',
        actuacionExigida: '',
        responsableControl: 'Luis Ferrán',
        criticidad: 'Media',
      },
      datosEntregable: {
        destinatario: 'Juzgado',
        finalidad: 'Solicitar embargo de saldos bancarios',
        requiereRevision: true,
        requiereAprobacion: false,
        requiereFirma: true,
        fechaPrevista: d(2),
        fechaEfectiva: '',
        medio: 'LexNET',
        justificante: '',
      },
      clienteInformado: false,
    },
    {
      id: 'DOC-0008',
      nombre: 'Escrito recibido sin identificar',
      actuacionesRelacionadas: [],
      archivo: 'escaneo-20260804.pdf',
      descripcion: 'Documento escaneado pendiente de asignar a un expediente.',
      tipoDocumental: 'Otro documento procesal',
      origen: 'Recibido',
      autorEmisor: 'Desconocido',
      destinatario: 'Despacho',
      fechaDocumento: d(-1),
      fechaIncorporacion: d(-1),
      responsable: 'Nuria Casals',
      estado: 'Sin clasificar',
      version: 1,
      versiones: [],
      confidencialidad: 'Normal',
      etiquetas: [],
      observaciones: 'Bandeja pendiente de asignación.',
      judicial: false,
      entregable: false,
      clienteInformado: false,
    },
  ]

  const tareas: TareaOp[] = [
    {
      id: 'TR-0001',
      titulo: 'Validar el plazo de recurso de la sentencia',
      descripcion: 'Comprobar cómputo y validar expresamente el plazo procesal.',
      expedienteId: 'EX-0101',
      origen: { tipo: 'Documento', id: 'DOC-0001', label: 'Sentencia 231/2026' },
      responsable: 'Marta Solé',
      colaboradores: ['Igor Belmonte'],
      prioridad: 'Alta',
      estado: 'En curso',
      fechaInicio: d(-1),
      vencimiento: d(1),
      recordatorio: d(0),
      checklist: [
        { texto: 'Comprobar fecha de notificación', hecho: true },
        { texto: 'Calcular plazo', hecho: false },
        { texto: 'Validación profesional', hecho: false },
      ],
      resultado: '',
      tiempo: 0,
      documentos: ['DOC-0001'],
    },
    {
      id: 'TR-0002',
      titulo: 'Enviar informe de resultado al cliente',
      descripcion: 'Remitir el informe una vez revisado.',
      expedienteId: 'EX-0101',
      origen: { tipo: 'Documento', id: 'DOC-0004', label: 'Informe de viabilidad' },
      responsable: 'Marta Solé',
      colaboradores: [],
      prioridad: 'Media',
      estado: 'En curso',
      fechaInicio: d(0),
      vencimiento: d(3),
      recordatorio: d(2),
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: ['DOC-0004'],
    },
    {
      id: 'TR-0003',
      titulo: 'Reclamar respuesta del juzgado sobre averiguación patrimonial',
      descripcion: 'Escrito de impulso si no hay respuesta.',
      expedienteId: 'EX-0103',
      origen: { tipo: 'Ejecución', id: 'EJ-0001', label: 'Ejecución judicial' },
      responsable: 'Luis Ferrán',
      colaboradores: [],
      prioridad: 'Alta',
      estado: 'En curso',
      fechaInicio: d(-12),
      vencimiento: d(-3),
      recordatorio: d(-4),
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
    },
    {
      id: 'TR-0004',
      titulo: 'Control del segundo pago del acuerdo',
      descripcion: 'Verificar el ingreso en la fecha pactada.',
      expedienteId: 'EX-0102',
      origen: { tipo: 'Ejecución', id: 'EJ-0002', label: 'Ejecución extrajudicial' },
      responsable: 'Ana Torregrosa',
      colaboradores: [],
      prioridad: 'Media',
      estado: 'En curso',
      fechaInicio: d(0),
      vencimiento: d(12),
      recordatorio: d(10),
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
    },
    {
      id: 'TR-0005',
      titulo: 'Firmar el escrito de embargo',
      descripcion: 'Firma del responsable antes de la presentación.',
      expedienteId: 'EX-0103',
      origen: { tipo: 'Documento', id: 'DOC-0007', label: 'Escrito de embargo' },
      responsable: 'Luis Ferrán',
      colaboradores: [],
      prioridad: 'Alta',
      estado: 'En curso',
      fechaInicio: d(-1),
      vencimiento: d(2),
      recordatorio: d(1),
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: ['DOC-0007'],
    },
    {
      id: 'TR-0006',
      titulo: 'Preparar y remitir burofax de requerimiento',
      descripcion: 'Redacción, revisión y envío del burofax al obligado.',
      expedienteId: 'EX-0102',
      responsable: 'Nuria Casals',
      colaboradores: ['Ana Torregrosa'],
      prioridad: 'Alta',
      estado: 'En curso',
      fechaInicio: d(-2),
      vencimiento: d(-1),
      recordatorio: d(-2),
      checklist: [
        { texto: 'Redactar el texto', hecho: true },
        { texto: 'Revisión del responsable', hecho: false },
        { texto: 'Envío y justificante', hecho: false },
      ],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Ana Torregrosa',
      supervisor: 'Ana Torregrosa',
      plantilla: 'Burofax de requerimiento',
      evidenciaObligatoria: true,
      evidencias: [],
      desbloquea: 'TR-0007',
      etiquetas: ['Burofax', 'Requerimiento'],
      reclamaciones: [
        {
          id: 'RC-0001',
          fecha: d(0),
          autor: 'Ana Torregrosa',
          destinatario: 'Nuria Casals',
          mensaje: 'El envío debía salir ayer. ¿Puedes confirmar hoy?',
        },
      ],
      historico: [
        {
          id: 'HT-0001',
          fecha: d(-2),
          autor: 'Ana Torregrosa',
          accion: 'Creación',
          detalle: 'Cadena de burofax generada desde plantilla.',
        },
      ],
    },
    {
      id: 'TR-0007',
      titulo: 'Control de acuse de recibo del burofax',
      descripcion: 'Verificar entrega y archivar el acuse.',
      expedienteId: 'EX-0102',
      responsable: 'Nuria Casals',
      colaboradores: [],
      prioridad: 'Media',
      estado: 'En espera',
      fechaInicio: '',
      vencimiento: '',
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Ana Torregrosa',
      plantilla: 'Burofax de requerimiento',
      evidenciaObligatoria: true,
      evidencias: [],
      bloqueadaPor: 'TR-0006',
      diasTrasPredecesora: 7,
      motivoDiferimiento: 'Esperando a tercero',
      etiquetas: ['Burofax'],
    },
    {
      id: 'TR-0008',
      titulo: 'Revisar la provisión de fondos del expediente',
      descripcion: 'Comprobar el ingreso y avisar a facturación.',
      responsable: 'Nuria Casals',
      colaboradores: [],
      prioridad: 'Baja',
      estado: 'En curso',
      fechaInicio: d(-3),
      vencimiento: d(4),
      recordatorio: d(3),
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Igor Belmonte',
      etiquetas: ['Interna'],
    },
    {
      id: 'TR-0009',
      titulo: 'Actualizar la ficha del cliente tras la última reunión',
      descripcion: 'Datos de contacto y preferencias de comunicación.',
      responsable: 'Marta Solé',
      colaboradores: [],
      prioridad: 'Baja',
      estado: 'Completada',
      fechaInicio: d(-9),
      vencimiento: d(-5),
      recordatorio: '',
      checklist: [],
      resultado: 'Ficha actualizada.',
      tiempo: 25,
      documentos: [],
      creador: 'Marta Solé',
      primeraApertura: { fecha: d(-9), autor: 'Marta Solé' },
    },
    /* --- SIGUIENTES ACCIONES de demostración (tareas ordinarias marcadas) --- */
    {
      id: 'TR-0010',
      titulo: 'Llamar al contacto para concretar la primera cita',
      descripcion: 'Cerrar día y hora de la primera cita con el contacto del lead.',
      origen: { tipo: 'Oportunidad', id: 'OP-0001', label: 'OP-2026-0001' },
      responsable: 'Marta Solé',
      colaboradores: [],
      prioridad: 'Media',
      estado: 'Pendiente',
      fechaInicio: d(-1),
      vencimiento: '',
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Igor Belmonte',
      esSiguienteAccion: true,
    },
    {
      id: 'TR-0011',
      titulo: 'Solicitar la documentación inicial del asunto',
      descripcion: 'Pedir al contacto la documentación básica para valorar el encargo.',
      origen: { tipo: 'Oportunidad', id: 'OP-0002', label: 'OP-2026-0002' },
      responsable: 'Luis Ferrán',
      colaboradores: [],
      prioridad: 'Media',
      estado: 'En curso',
      fechaInicio: d(-2),
      vencimiento: d(2),
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Igor Belmonte',
      esSiguienteAccion: true,
    },
    {
      id: 'TR-0012',
      titulo: 'Revisar el borrador de demanda antes de su envío',
      descripcion: 'Revisión profesional previa a la presentación.',
      expedienteId: 'EX-0101',
      responsable: 'Marta Solé',
      colaboradores: [],
      prioridad: 'Alta',
      estado: 'En curso',
      fechaInicio: d(-1),
      vencimiento: d(3),
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Igor Belmonte',
      esSiguienteAccion: true,
    },
    {
      id: 'TR-0013',
      titulo: 'Solicitar al cliente la escritura de herencia',
      descripcion: 'Documento imprescindible para continuar con el expediente.',
      expedienteId: 'EX-0102',
      responsable: 'Ana Torregrosa',
      colaboradores: [],
      prioridad: 'Media',
      estado: 'Pendiente',
      fechaInicio: d(-3),
      vencimiento: '',
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Marta Solé',
      esSiguienteAccion: true,
    },
    {
      id: 'TR-0014',
      titulo: 'Reclamar a la Notaría el presupuesto pendiente',
      descripcion: 'A la espera de respuesta externa de la Notaría.',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0001',
      responsable: 'Luis Ferrán',
      colaboradores: [],
      prioridad: 'Media',
      estado: 'En espera',
      fechaInicio: d(-6),
      vencimiento: d(4),
      recordatorio: '',
      motivoDiferimiento: 'Esperando a notaría',
      motivoEsperaDetalle: 'Notaría pendiente de enviar el presupuesto.',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Marta Solé',
      esSiguienteAccion: true,
    },
    {
      id: 'TR-0015',
      titulo: 'Confirmar la recepción de la aceptación del cliente',
      descripcion: 'Verificar la aceptación firmada para cerrar el onboarding.',
      origen: { tipo: 'Onboarding', id: 'ONB-0001', label: 'ONB-2026-0001' },
      responsable: 'Nuria Casals',
      colaboradores: [],
      prioridad: 'Alta',
      estado: 'Pendiente',
      fechaInicio: d(-5),
      vencimiento: d(-1),
      recordatorio: '',
      checklist: [],
      resultado: '',
      tiempo: 0,
      documentos: [],
      creador: 'Igor Belmonte',
      esSiguienteAccion: true,
    },
    ...reunionesEjemplo(),
  ]

  const fechas: FechaCritica[] = [
    {
      id: 'FC-0001',
      expedienteId: 'EX-0101',
      origen: { tipo: 'Documento', id: 'DOC-0001', label: 'Sentencia 231/2026' },
      tipo: 'Plazo procesal',
      titulo: 'Posible plazo de recurso de apelación',
      fecha: d(15),
      hora: '23:59',
      responsable: 'Marta Solé',
      validada: false,
      criticidad: 'Alta',
      avisos: 'Aviso 5 y 2 días antes',
      observaciones: 'Cómputo propuesto por el sistema; requiere validación profesional expresa.',
      resultado: '',
      sincronizadaCalendar: false,
    },
    {
      id: 'FC-0002',
      expedienteId: 'EX-0103',
      origen: { tipo: 'Ejecución', id: 'EJ-0001', label: 'Ejecución judicial' },
      tipo: 'Fecha crítica',
      titulo: 'Control de ejecución: respuesta a averiguación patrimonial',
      fecha: d(6),
      hora: '10:00',
      responsable: 'Luis Ferrán',
      validada: true,
      validadaPor: 'Luis Ferrán',
      criticidad: 'Media',
      avisos: 'Aviso 3 días antes',
      observaciones: '',
      resultado: '',
      sincronizadaCalendar: false,
    },
    {
      id: 'FC-0003',
      expedienteId: 'EX-0102',
      origen: { tipo: 'Ejecución', id: 'EJ-0002', label: 'Ejecución extrajudicial' },
      tipo: 'Vencimiento interno',
      titulo: 'Vencimiento del segundo pago del acuerdo',
      fecha: d(12),
      hora: '12:00',
      responsable: 'Ana Torregrosa',
      validada: true,
      validadaPor: 'Ana Torregrosa',
      criticidad: 'Media',
      avisos: 'Aviso 7 días antes',
      observaciones: '',
      resultado: '',
      sincronizadaCalendar: false,
    },
    {
      id: 'FC-0004',
      expedienteId: 'EX-0105',
      tipo: 'Evento o cita',
      titulo: 'Reunión de seguimiento con el cliente',
      fecha: d(8),
      hora: '17:00',
      responsable: 'Luis Ferrán',
      validada: true,
      validadaPor: 'Luis Ferrán',
      criticidad: 'Baja',
      avisos: 'Aviso 1 día antes',
      observaciones: 'Preparado para sincronizar con Google Calendar.',
      resultado: '',
      sincronizadaCalendar: false,
    },

    /* ----- DEMO · registros temporales de prueba (borrables en bloque) ----- */
    {
      id: 'FC-9001',
      expedienteId: 'EX-0101',
      origen: {
        tipo: 'Tarea',
        id: 'TR-0001',
        label: 'Validar el plazo de recurso de la sentencia',
      },
      tipo: 'Recordatorio',
      registro: 'Recordatorio',
      estadoTemporal: 'Pendiente',
      titulo: 'DEMO · Recordar llamada de confirmación al cliente',
      fecha: d(1),
      hora: '09:30',
      responsable: 'Marta Solé',
      validada: false,
      criticidad: 'Media',
      avisos: 'Aviso emergente a la hora indicada',
      observaciones: 'Registro de prueba del módulo Fechas y plazos.',
      resultado: '',
      sincronizadaCalendar: false,
      recurrencia: { activa: false, frecuencia: 'Semanal', cada: 1 },
      aplazamientos: [],
      demo: true,
    },
    {
      id: 'FC-9002',
      expedienteId: 'EX-0102',
      tipo: 'Fecha informativa',
      registro: 'Fecha',
      estadoTemporal: 'Pendiente',
      titulo: 'DEMO · Fecha de efectos del acuerdo de liquidación',
      fecha: d(4),
      hora: '',
      responsable: 'Ana Torregrosa',
      validada: true,
      validadaPor: 'Ana Torregrosa',
      criticidad: 'Baja',
      avisos: '',
      observaciones: 'Registro de prueba del módulo Fechas y plazos.',
      resultado: '',
      sincronizadaCalendar: false,
      demo: true,
    },
    {
      id: 'FC-9003',
      expedienteId: 'EX-0103',
      tipo: 'Evento o cita',
      registro: 'Evento',
      estadoTemporal: 'Pendiente',
      titulo: 'DEMO · Firma en notaría de la escritura de adjudicación',
      fecha: d(3),
      hora: '11:00',
      horaFin: '12:00',
      responsable: 'Luis Ferrán',
      validada: true,
      validadaPor: 'Luis Ferrán',
      criticidad: 'Media',
      avisos: 'Aviso 1 día antes',
      observaciones: 'Registro de prueba del módulo Fechas y plazos.',
      resultado: '',
      sincronizadaCalendar: true,
      demo: true,
    },
    {
      id: 'FC-9004',
      expedienteId: 'EX-0101',
      origen: {
        tipo: 'Tarea',
        id: 'TR-0001',
        label: 'Validar el plazo de recurso de la sentencia',
      },
      tipo: 'Plazo procesal',
      registro: 'Plazo',
      estadoTemporal: 'Pendiente',
      titulo: 'DEMO · Plazo para interponer recurso de apelación',
      fecha: d(9),
      hora: '23:59',
      responsable: 'Marta Solé',
      validada: true,
      validadaPor: 'Marta Solé',
      criticidad: 'Alta',
      avisos: 'Aviso 5 y 2 días antes',
      observaciones: 'Registro de prueba del módulo Fechas y plazos.',
      resultado: '',
      sincronizadaCalendar: false,
      clasePlazo: 'Judicial',
      diaNotificacion: d(-11),
      termino: '20 días hábiles para recurrir',
      vencimientoPropuesto: d(9),
      vencimientoValidado: true,
      aTermino: d(7),
      critico: true,
      historicoVencimiento: [],
      demo: true,
    },
    {
      id: 'FC-9005',
      expedienteId: 'EX-0102',
      tipo: 'Vencimiento interno',
      registro: 'Plazo',
      estadoTemporal: 'Pendiente',
      titulo: 'DEMO · Plazo de contestación al requerimiento del banco',
      fecha: d(14),
      hora: '23:59',
      responsable: 'Ana Torregrosa',
      validada: false,
      criticidad: 'Media',
      avisos: 'Aviso 3 días antes',
      observaciones: 'Registro de prueba del módulo Fechas y plazos.',
      resultado: '',
      sincronizadaCalendar: false,
      clasePlazo: 'Extrajudicial',
      diaNotificacion: d(-1),
      termino: '15 días naturales para contestar',
      vencimientoPropuesto: d(14),
      vencimientoValidado: false,
      critico: false,
      historicoVencimiento: [],
      demo: true,
    },
  ]

  const comunicaciones: Comunicacion[] = [
    {
      id: 'CM-0001',
      expedienteId: 'EX-0101',
      origen: { tipo: 'Actuación', id: 'AC-0003', label: 'Llamada con el cliente' },
      tipo: 'Llamada',
      fecha: d(-1),
      hora: '17:20',
      emisor: 'Marta Solé',
      destinatarios: [nombreContacto('CT-0011')],
      participantes: ['Marta Solé'],
      canal: 'Teléfono',
      asunto: 'Resultado preliminar de la sentencia',
      contenido: 'Se anticipa el sentido estimatorio parcial y se anuncia informe escrito.',
      resultado: 'Cliente conforme',
      adjuntos: [],
      proximaAccion: 'Enviar informe',
      clienteInformado: true,
      incluibleReporte: true,
      responsable: 'Marta Solé',
      enviada: true,
    },
    {
      id: 'CM-0002',
      expedienteId: 'EX-0103',
      tipo: 'Comunicación con procurador',
      fecha: d(-5),
      hora: '12:30',
      emisor: 'Luis Ferrán',
      destinatarios: ['Rosa Ibáñez (procuradora)'],
      participantes: [],
      canal: 'Email',
      asunto: 'Presentación del escrito de averiguación patrimonial',
      contenido: 'Se remite escrito para su presentación y se solicita justificante.',
      resultado: 'Presentado con justificante',
      adjuntos: ['DOC-0007'],
      proximaAccion: 'Recibir justificante',
      clienteInformado: false,
      incluibleReporte: true,
      responsable: 'Luis Ferrán',
      enviada: true,
    },
    {
      id: 'CM-0003',
      expedienteId: 'EX-0104',
      origen: { tipo: 'Actuación', id: 'AC-0006', label: 'Requerimiento notarial' },
      tipo: 'Comunicación con notaría',
      fecha: d(-16),
      hora: '09:15',
      emisor: 'Marta Solé',
      destinatarios: ['Notaría Ruiz de Alda'],
      participantes: [],
      canal: 'Email',
      asunto: 'Requerimiento de cumplimiento',
      contenido: 'Instrucciones para practicar el requerimiento al obligado.',
      resultado: 'Requerimiento practicado',
      adjuntos: ['DOC-0006'],
      proximaAccion: 'Valorar ejecución judicial',
      clienteInformado: false,
      incluibleReporte: true,
      responsable: 'Marta Solé',
      enviada: true,
    },
  ]

  const intervinientes: IntervinienteOp[] = [
    {
      id: 'IN-0001',
      expedienteId: 'EX-0101',
      contactoId: 'CT-0011',
      nombre: nombreContacto('CT-0011'),
      rol: 'Cliente',
      contacto: 'cliente@correo.es',
      observaciones: '',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0002',
      expedienteId: 'EX-0101',
      nombre: 'Rosa Ibáñez',
      rol: 'Procurador',
      contacto: 'rosa.ibanez@procuradores.es',
      observaciones: 'Procuradora en Alicante',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0003',
      expedienteId: 'EX-0101',
      nombre: 'Construcciones Bahía, S.L.',
      rol: 'Contraparte',
      contacto: '—',
      observaciones: '',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0004',
      expedienteId: 'EX-0101',
      nombre: 'Juzgado de Primera Instancia nº 4 de Alicante',
      rol: 'Juzgado',
      contacto: '—',
      observaciones: 'Autos 412/2026',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0005',
      expedienteId: 'EX-0102',
      contactoId: 'CT-0003',
      nombre: nombreContacto('CT-0003'),
      rol: 'Cliente',
      contacto: '—',
      observaciones: '',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0006',
      expedienteId: 'EX-0102',
      nombre: 'Hermanos Sempere, C.B.',
      rol: 'Contraparte',
      contacto: '—',
      observaciones: '',
      confidencialidad: 'Restringida',
    },
    {
      id: 'IN-0007',
      expedienteId: 'EX-0103',
      contactoId: 'CT-0007',
      nombre: nombreContacto('CT-0007'),
      rol: 'Cliente',
      contacto: '—',
      observaciones: '',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0008',
      expedienteId: 'EX-0103',
      nombre: 'Rosa Ibáñez',
      rol: 'Procurador',
      contacto: 'rosa.ibanez@procuradores.es',
      observaciones: '',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0009',
      expedienteId: 'EX-0104',
      contactoId: 'CT-0002',
      nombre: nombreContacto('CT-0002'),
      rol: 'Cliente',
      contacto: '—',
      observaciones: '',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0010',
      expedienteId: 'EX-0104',
      nombre: 'Notaría Ruiz de Alda',
      rol: 'Notaría',
      contacto: 'notaria@ruizdealda.es',
      observaciones: '',
      confidencialidad: 'Normal',
    },
    {
      id: 'IN-0011',
      expedienteId: 'EX-0105',
      contactoId: 'CT-0007',
      nombre: nombreContacto('CT-0007'),
      rol: 'Cliente',
      contacto: '—',
      observaciones: '',
      confidencialidad: 'Normal',
    },
  ]

  const auditoria: AuditoriaItem[] = [
    {
      id: 'AU-0001',
      fecha: `${d(-2)} 09:40`,
      usuario: 'Nuria Casals',
      accion: 'Alta de documento',
      entidad: 'Documento',
      entidadId: 'DOC-0001',
      expedienteId: 'EX-0101',
      anterior: '—',
      nuevo: 'Sentencia 231/2026',
    },
    {
      id: 'AU-0002',
      fecha: `${d(-2)} 09:45`,
      usuario: 'Sistema',
      accion: 'Propuesta de plazo',
      entidad: 'Fecha crítica',
      entidadId: 'FC-0001',
      expedienteId: 'EX-0101',
      anterior: '—',
      nuevo: 'Posible plazo pendiente de validar',
    },
    {
      id: 'AU-0003',
      fecha: `${HOY} 08:00`,
      usuario: 'Sistema',
      accion: 'Carga de datos de demostración',
      entidad: 'Expediente',
      entidadId: '—',
      anterior: '—',
      nuevo: `${expedientes.length} expedientes`,
    },
  ]

  const recordatorios: Recordatorio[] = [
    {
      id: 'RC-0001',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0011',
      fecha: d(3),
      hora: '09:00',
      texto: 'Comprobar si el juzgado ha señalado fecha de lanzamiento',
      responsable: 'Marta Solé',
      estado: 'Pendiente',
      creadoPor: 'Marta Solé',
      creadoEl: d(-2),
    },
    {
      id: 'RC-0002',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0012',
      fecha: d(-1),
      hora: '12:00',
      texto: 'Llamar al perito para confirmar disponibilidad',
      responsable: 'Nuria Casals',
      estado: 'Pendiente',
      creadoPor: 'Marta Solé',
      creadoEl: d(-6),
    },
    {
      id: 'RC-0003',
      expedienteId: 'EX-0101',
      lineaId: 'LT-0013',
      fecha: d(-5),
      texto: 'Revisar si el contrario ha contestado a la propuesta',
      responsable: 'Marta Solé',
      estado: 'Atendido',
      creadoPor: 'Marta Solé',
      creadoEl: d(-12),
    },
  ]

  return {
    expedientes,
    lineas,
    ejecuciones,
    actuaciones,
    documentos,
    tareas,
    fechas,
    comunicaciones,
    intervinientes,
    recordatorios,
    notificaciones: [],
    auditoria,
  }
}

export const SEMILLA_OPERATIVA = semilla
export type SemillaOperativa = Semilla
