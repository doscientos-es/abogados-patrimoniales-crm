// Modelo del pipeline comercial de LEX.
// Separa cinco dimensiones: fase comercial, subestado, estado operativo,
// próxima acción y resultado final. Es puro: sin estado ni efectos.
import {
  OPORTUNIDADES,
  type EtapaOportunidadId,
  type Oportunidad,
  type Prioridad,
  type Tono,
} from '@/data/crm'

/* ------------------------------------------------------------------ */
/* Fases y subestados                                                  */
/* ------------------------------------------------------------------ */

export type FaseId =
  | 'entrada'
  | 'cualificacion'
  | 'primera-cita'
  | 'presupuesto'
  | 'validacion'
  | 'contratacion'
  | 'ganada'
  | 'cerrada'

export type Fase = {
  id: FaseId
  nombre: string
  corto: string
  tipo: 'activa' | 'terminal'
  tono: Tono
  finalidad: string
  subestados: string[]
}

/** Motivos únicos de cierre del Lead (fase Cerrado / Perdido). */
export const MOTIVOS_CIERRE_LEAD = [
  'No apto para el despacho',
  'Conflicto de intereses',
  'Materia no atendida',
  'Falta de información',
  'No acude a la primera cita',
  'No desea continuar',
  'No procede presupuesto',
  'Rechaza el presupuesto',
  'Precio',
  'Contrata a otro despacho',
  'No responde',
  'Presupuesto caducado',
  'Duplicado',
  'Cancelado por el despacho',
  'Otro',
]

export const FASES: Fase[] = [
  {
    id: 'entrada',
    nombre: 'Entrada',
    corto: 'Entrada',
    tipo: 'activa',
    tono: 'info',
    finalidad: 'Registrar el nuevo Lead con sus datos mínimos y su contacto principal.',
    subestados: [
      'Sin revisar',
      'Pendiente de datos',
      'Posible duplicado',
      'Datos mínimos completos',
    ],
  },
  {
    id: 'cualificacion',
    nombre: 'Cualificación',
    corto: 'Cualificación',
    tipo: 'activa',
    tono: 'info',
    finalidad: 'Comprobar si el Lead es apto para el despacho.',
    subestados: [
      'Análisis pendiente',
      'Pendiente de datos',
      'Pendiente de conflicto de intereses',
      'Pendiente de revisión interna',
      'Apto para primera cita',
      'No apto',
    ],
  },
  {
    id: 'primera-cita',
    nombre: 'Primera cita',
    corto: 'Primera cita',
    tipo: 'activa',
    tono: 'aviso',
    finalidad: 'Gestionar el ciclo completo de la primera cita y registrar su resultado.',
    subestados: [
      'Pendiente de programar',
      'Programada',
      'Celebrada',
      'Pendiente de registrar resultado',
      'Pendiente de información o decisión',
      'No comparece',
    ],
  },
  {
    id: 'presupuesto',
    nombre: 'Solicitud de presupuesto',
    corto: 'Solicitud',
    tipo: 'activa',
    tono: 'aviso',
    finalidad: 'Petición operativa de elaboración del presupuesto tras la primera cita.',
    subestados: [
      'Solicitado',
      'Sin asignar',
      'Asignado',
      'En preparación',
      'Pendiente de información',
      'Rectificación solicitada',
      'Preparado para validar',
    ],
  },
  {
    id: 'validacion',
    nombre: 'Validación',
    corto: 'Validación',
    tipo: 'activa',
    tono: 'aviso',
    finalidad: 'Revisión y validación del presupuesto por Igor antes de enviarlo al cliente.',
    subestados: [
      'Pendiente de validación',
      'Validado · Pendiente de envío',
      'Rectificación solicitada',
    ],
  },
  {
    id: 'contratacion',
    nombre: 'Enviado al cliente',
    corto: 'Enviado',
    tipo: 'activa',
    tono: 'info',
    finalidad: 'Seguimiento del presupuesto realmente enviado hasta la decisión del cliente.',
    subestados: [
      'Pendiente de respuesta',
      'En seguimiento',
      'En negociación',
      'Solicita modificación',
      'Próximo a caducar',
      'Sin respuesta',
    ],
  },
  {
    id: 'ganada',
    nombre: 'Aceptado',
    corto: 'Aceptado',
    tipo: 'terminal',
    tono: 'exito',
    finalidad: 'El cliente ha aceptado el presupuesto: el Lead queda comercialmente concluido.',
    subestados: ['Presupuesto aceptado', 'Pendiente de iniciar Onboarding'],
  },
  {
    id: 'cerrada',
    nombre: 'Cerrado / Perdido',
    corto: 'Cerrado',
    tipo: 'terminal',
    tono: 'riesgo',
    finalidad: 'Lead terminado sin contratación.',
    subestados: MOTIVOS_CIERRE_LEAD,
  },
]

export const FASES_ACTIVAS = FASES.filter((f) => f.tipo === 'activa')
export const fase = (id: FaseId): Fase => {
  const encontrada = FASES.find((f) => f.id === id) ?? FASES[0]
  if (!encontrada) throw new Error('El catálogo de fases no puede estar vacío.')
  return encontrada
}
export const ORDEN_FASE: FaseId[] = FASES.map((f) => f.id)

/* ------------------------------------------------------------------ */
/* Dimensiones transversales                                           */
/* ------------------------------------------------------------------ */

export const ESTADOS_OPERATIVOS = [
  'Debemos trabajo',
  'Depende del cliente',
  'Depende de tercero',
  'En revisión interna',
  'En seguimiento',
  'En pausa',
] as const
export type EstadoOperativo = (typeof ESTADOS_OPERATIVOS)[number]

export const TIPOS_ACCION = [
  'Llamada',
  'Correo',
  'WhatsApp',
  'Reunión',
  'Primera cita',
  'Solicitud de documentación',
  'Presupuesto',
  'Seguimiento',
  'Revisión interna',
  'Gestión administrativa',
] as const

export const ESTADOS_TAREA = [
  'Pendiente',
  'En curso',
  'Bloqueada',
  'En espera',
  'Completada',
  'Cancelada',
] as const
export type EstadoTarea = (typeof ESTADOS_TAREA)[number]

export const TIPOS_INTERACCION_CRM = [
  'Llamada',
  'Correo',
  'WhatsApp',
  'Reunión',
  'Primera cita',
  'Nota interna',
  'Solicitud de documentación',
  'Presupuesto',
  'Seguimiento',
  'Cambio de fase',
  'Cambio de responsable',
  'Cierre',
  'Reapertura',
  'Conversión en expediente',
] as const
export type TipoActividadCRM = (typeof TIPOS_INTERACCION_CRM)[number]

export const ROLES_CRM = [
  'Administrador/Igor',
  'Abogado responsable',
  'Personal de administración',
  'Usuario de consulta',
] as const
export type RolCRM = (typeof ROLES_CRM)[number]

export const ACCIONES_RESTRINGIDAS = [
  'Autorizar excepciones de apertura',
  'Reabrir oportunidades cerradas',
  'Modificar subestados automáticos',
  'Validar presupuestos',
  'Corregir una conversión errónea',
]

export const UMBRALES_DEFECTO = {
  primerAviso: 3,
  tareaSeguimiento: 7,
  alertaEstancamiento: 14,
}
export type Umbrales = typeof UMBRALES_DEFECTO

/* ------------------------------------------------------------------ */
/* Cualificación                                                       */
/* ------------------------------------------------------------------ */

export const COMPROBACIONES_CUALIFICACION = [
  { id: 'encaje', label: 'Encaje en las áreas del despacho' },
  { id: 'conflicto', label: 'Conflicto de interés comprobado' },
  { id: 'plazo', label: 'Existencia de plazo o urgencia valorada' },
  { id: 'viabilidad', label: 'Viabilidad mínima aparente' },
  { id: 'capacidad', label: 'Capacidad del despacho' },
  { id: 'interes', label: 'Interés económico aproximado' },
  { id: 'documentacion', label: 'Necesidad de documentación adicional' },
] as const

/** Respuesta admitida en una pregunta de cualificación. */
export type RespuestaCualificacion = 'si' | 'no' | 'pendiente'

/**
 * Pregunta de cualificación propia de CADA Lead. No existe un checklist
 * jurídico rígido universal: la secretaría añade, edita, ordena y elimina.
 */
export type PreguntaCualificacion = {
  id: string
  texto: string
  respuesta: RespuestaCualificacion
  observacion: string
}

/** Ejemplos orientativos ofrecidos al añadir preguntas. NO son obligatorios. */
export const PREGUNTAS_CUALIFICACION_SUGERIDAS = [
  '¿Está suficientemente explicado el asunto?',
  '¿Falta documentación básica?',
  '¿Parece inicialmente un asunto atendible por el despacho?',
  '¿Existe alguna urgencia declarada?',
]

/** Resultado ágil de la cualificación. La secretaría decide sin gate de abogado. */
export const DECISIONES_CUALIFICACION = [
  { id: 'primera-cita', label: 'Pasar a Primera Cita' },
  { id: 'informacion', label: 'Solicitar antes información/documentación' },
  { id: 'no-continuar', label: 'No continuar' },
] as const

export type DecisionCualificacion = (typeof DECISIONES_CUALIFICACION)[number]['id']

export type Cualificacion = {
  comprobaciones: Record<string, boolean>
  apta: boolean | null
  motivo: string
  resultado: string
  conflictoResuelto: boolean
  excepcionConflicto: string
  /** Preguntas flexibles propias de este Lead. */
  preguntas?: PreguntaCualificacion[]
  decision?: DecisionCualificacion | ''
  observaciones?: string
}

/* ------------------------------------------------------------------ */
/* Primera cita                                                        */
/* ------------------------------------------------------------------ */

export const RESULTADOS_CITA = [
  'Solicitar presupuesto',
  'Solicitar documentación',
  'Requiere análisis adicional',
  'Nueva cita',
  'Seguimiento futuro',
  'No interesado',
  'Descartado por el despacho',
] as const

export const ESTADOS_CITA = [
  'Sin programar',
  'Programada',
  'Celebrada',
  'No comparece',
  'Reprogramación pendiente',
] as const

/** Opciones rápidas de lugar. «Otro» habilita un texto libre. */
export const LUGARES_CITA = [
  'Despacho Bilbao',
  'Despacho Rekalde',
  'Videollamada',
  'Telefónica',
  'Otro',
] as const

export type CitaCRM = {
  fecha: string
  hora: string
  duracion: string
  modalidad: 'Presencial' | 'Videollamada' | 'Telefónica'
  lugar: string
  asistentes: string
  responsable: string
  estado: (typeof ESTADOS_CITA)[number]
  notasPrevias: string
  resumen: string
  documentacionAportada: string
  resultado: string
  proximoPaso: string
  fechaProximaAccion: string
  sincronizacionCalendar: 'No sincronizada' | 'Sincronizada (simulada)'
  autorizadaPresupuesto: boolean
  tipoServicioPreliminar: string
  /** Opción rápida elegida para el lugar; «Otro» usa el texto libre `lugar`. */
  lugarOpcion?: string
  /** Observaciones del resultado de la cita. */
  observaciones?: string
}

export const citaVacia = (responsable: string): CitaCRM => ({
  fecha: '',
  hora: '',
  duracion: '60 minutos',
  modalidad: 'Presencial',
  lugar: '',
  asistentes: '',
  responsable,
  estado: 'Sin programar',
  notasPrevias: '',
  resumen: '',
  documentacionAportada: '',
  resultado: '',
  proximoPaso: '',
  fechaProximaAccion: '',
  sincronizacionCalendar: 'No sincronizada',
  autorizadaPresupuesto: false,
  tipoServicioPreliminar: '',
})

/* ------------------------------------------------------------------ */
/* Presupuesto (espejo) y contratación                                 */
/* ------------------------------------------------------------------ */

export const ESTADOS_PRESUPUESTO_ESPEJO = [
  'No solicitado',
  'Solicitado',
  'En elaboración',
  'Pendiente de validación',
  'Validado',
  'Enviado',
  'Requiere modificación',
  'Bloqueado',
] as const
export type EstadoPresupuestoEspejo = (typeof ESTADOS_PRESUPUESTO_ESPEJO)[number]

export type PresupuestoEspejo = {
  numero: string
  servicio: string
  importe: string
  estado: EstadoPresupuestoEspejo
  responsable: string
  fechaSolicitud: string
  fechaEnvio: string
  version: number
  presupuestoId?: string
  incidencia: string
  historial: { fecha: string; usuario: string; texto: string }[]
  /** Versión concretamente validada por Igor (0 = ninguna). */
  validadoVersion?: number
  validadoPor?: string
  fechaValidacion?: string
  /** Instrucciones de rectificación al elaborador. */
  rectificacion?: string
  /** Datos de la solicitud operativa de elaboración. */
  instrucciones?: string
  prioridad?: string
  fechaObjetivo?: string
  /** Datos del envío real al cliente. */
  destinatario?: string
  canal?: string
  vigencia?: string
  versionEnviada?: number
}

/** Registro obligatorio de la aceptación del presupuesto por el cliente. */
export type AceptacionLead = {
  fecha: string
  version: number
  importe: string
  forma: string
  usuario: string
  soporte: string
}

export const FORMAS_ACEPTACION = [
  'Correo electrónico',
  'Documento firmado',
  'WhatsApp',
  'Verbal en reunión',
  'Verbal por teléfono',
  'Otra',
]

export const presupuestoVacio = (): PresupuestoEspejo => ({
  numero: '',
  servicio: '',
  importe: '',
  estado: 'No solicitado',
  responsable: '',
  fechaSolicitud: '',
  fechaEnvio: '',
  version: 0,
  incidencia: '',
  historial: [],
})

export type Contratacion = {
  decision: 'Pendiente' | 'Aceptado verbalmente' | 'Rechazado' | 'Aplazado'
  hojaEncargo: 'Pendiente' | 'Enviada' | 'Firmada'
  proforma: 'No generada' | 'Generada'
  pago: 'No aplicable' | 'Pendiente' | 'Recibido'
  negociacion: string
  motivoRechazo: string
  fechaSeguimiento: string
}

export const contratacionVacia = (): Contratacion => ({
  decision: 'Pendiente',
  hojaEncargo: 'Pendiente',
  proforma: 'No generada',
  pago: 'No aplicable',
  negociacion: '',
  motivoRechazo: '',
  fechaSeguimiento: '',
})

/* ------------------------------------------------------------------ */
/* Checklist de apertura y cierre                                      */
/* ------------------------------------------------------------------ */

export const CHECKLIST_APERTURA = [
  { id: 'hoja', label: 'Hoja de encargo aceptada o firmada' },
  { id: 'pago', label: 'Pago inicial recibido' },
  { id: 'datos', label: 'Datos identificativos mínimos completos' },
  { id: 'conflicto', label: 'Conflicto de interés resuelto' },
  { id: 'tipo', label: 'Tipo de expediente seleccionado' },
  { id: 'area', label: 'Área jurídica seleccionada' },
  { id: 'responsable', label: 'Abogado responsable designado' },
  { id: 'documentacion', label: 'Documentación mínima incorporada' },
] as const

export type Excepcion = {
  requisito: string
  motivo: string
  usuario: string
  fecha: string
}

export const TIPOS_CIERRE = [
  {
    id: 'perdida',
    label: 'Perdida por decisión del cliente',
    motivos: [
      'Precio',
      'Contrató a otro despacho',
      'No percibe necesidad',
      'No acepta las condiciones',
      'Falta de confianza',
      'Demora del despacho',
      'Decisión personal',
      'Motivo desconocido',
    ],
  },
  {
    id: 'descartada',
    label: 'Descartada por el despacho',
    motivos: [
      'Conflicto de interés',
      'Fuera de especialidad',
      'Falta de viabilidad',
      'Riesgo reputacional',
      'Falta de capacidad',
      'Perfil de cliente no aceptable',
      'Interés económico insuficiente',
      'Falta de documentación',
      'Derivación a otro profesional',
    ],
  },
  {
    id: 'caducada',
    label: 'Caducada',
    motivos: [
      'Contacto imposible',
      'Silencio prolongado',
      'Asunto ya resuelto',
      'Transcurso del plazo comercial',
      'Oportunidad aplazada sin fecha',
    ],
  },
  {
    id: 'derivada',
    label: 'Derivada',
    motivos: ['Derivación a otro profesional', 'Fuera de especialidad'],
  },
  { id: 'duplicada', label: 'Duplicada', motivos: ['Registro duplicado detectado'] },
] as const

export type Cierre = {
  tipo: string
  motivo: string
  comentario: string
  fecha: string
  usuario: string
}

/* ------------------------------------------------------------------ */
/* Próxima acción                                                      */
/* ------------------------------------------------------------------ */

export type ProximaAccion = {
  descripcion: string
  tipo: string
  responsable: string
  fechaPrevista: string
  fechaLimite: string
  prioridad: Prioridad
  estado: 'Pendiente' | 'En curso' | 'Completada'
  tareaId?: string
}

/* ------------------------------------------------------------------ */
/* Alta de oportunidad: rol, información inicial, documentos y chat     */
/* ------------------------------------------------------------------ */

/**
 * Roles que un contacto puede desempeñar EN UNA OPORTUNIDAD concreta.
 * No son una cualidad permanente del contacto: pertenecen a la relación
 * contacto ↔ oportunidad y pueden ser distintos en cada asunto.
 */
/** Orígenes configurables: cómo ha llegado el contacto al despacho. */
export const ORIGENES_OPORTUNIDAD = [
  'Cliente actual',
  'Antiguo cliente',
  'Recomendación de cliente',
  'Recomendación profesional',
  'Página web',
  'Google',
  'Redes sociales',
  'Colaborador',
  'Notaría',
  'Administrador de fincas',
  'Otro origen',
]

/** Orígenes que admiten indicar quién realizó la recomendación. */
export const ORIGENES_CON_RECOMENDANTE = [
  'Recomendación de cliente',
  'Recomendación profesional',
  'Colaborador',
  'Notaría',
  'Administrador de fincas',
]

export const ROLES_OPORTUNIDAD = [
  'Interesado principal',
  'Representante',
  'Familiar o persona de contacto',
  'Propietario',
  'Arrendador',
  'Arrendatario',
  'Comprador',
  'Vendedor',
  'Heredero',
  'Legatario',
  'Comunero',
  'Administrador',
  'Acreedor',
  'Deudor',
  'Otro rol',
]

export type RolEnOportunidad = {
  rol: string
  aclaracion: string
}

export type IntervinienteOportunidad = {
  id: string
  contactoId?: string
  nombre: string
  rol: string
  aclaracion: string
  /** Identificación básica pendiente de completar (texto libre). */
  identificacion: string
}

/** Cuatro únicas respuestas admitidas sobre urgencia. */
export const OPCIONES_URGENCIA = [
  'No consta ninguna urgencia o fecha.',
  'Sí, existe una fecha o plazo concreto.',
  'El contacto manifiesta urgencia, pero no concreta fecha.',
  'Debe revisarse la documentación para comprobarlo.',
] as const

export type OpcionUrgencia = (typeof OPCIONES_URGENCIA)[number]

export type UrgenciaInicial = {
  opcion: OpcionUrgencia | ''
  /** Solo cuando existe una fecha o plazo concreto: texto libre. */
  detalle: string
}

/** La información preliminar no constituye un plazo jurídico validado. */
export const posibleUrgencia = (u?: UrgenciaInicial | null) => {
  const opcion = u?.opcion
  return Boolean(opcion) && opcion !== OPCIONES_URGENCIA[0]
}

export const AVISO_URGENCIA = 'POSIBLE URGENCIA — PENDIENTE DE REVISIÓN'

export type VersionRelato = { fecha: string; autor: string; texto: string }

export type InformacionInicial = {
  queHaOcurrido: string
  queSolicita: string
  otrasPersonas: string
  procedimientoIniciado: string
  documentacionManifestada: string
  observacionesInternas: string
  /** Histórico del relato cuando sufre modificaciones sustanciales. */
  historicoRelato: VersionRelato[]
}

export const informacionInicialVacia = (): InformacionInicial => ({
  queHaOcurrido: '',
  queSolicita: '',
  otrasPersonas: '',
  procedimientoIniciado: '',
  documentacionManifestada: '',
  observacionesInternas: '',
  historicoRelato: [],
})

export type DocumentoInicial = {
  id: string
  nombre: string
  descripcion: string
  tamano: number
  tipo: string
  fecha: string
  autor: string
  /** URL de objeto local (maqueta sin backend). */
  url?: string
}

export type CanalMensaje = 'Llamada' | 'Email' | 'WhatsApp' | 'Presencial' | 'Nota'

export const CANALES_MENSAJE: CanalMensaje[] = [
  'Llamada',
  'Email',
  'WhatsApp',
  'Presencial',
  'Nota',
]

export type MensajeOportunidad = {
  id: string
  /** contacto = izquierda · despacho = derecha · interna / sistema = diferenciadas. */
  direccion: 'contacto' | 'despacho' | 'interna' | 'sistema'
  canal: CanalMensaje
  autor: string
  fecha: string
  hora: string
  contenido: string
  adjuntos: string[]
}

/* ------------------------------------------------------------------ */
/* Oportunidad ampliada                                                */
/* ------------------------------------------------------------------ */

export type OportunidadCRM = Oportunidad & {
  fase: FaseId
  subestado: string
  estadoOperativo: EstadoOperativo
  proximaAccion: ProximaAccion | null
  cualificacion: Cualificacion
  citaCRM: CitaCRM
  presupuestoEspejo: PresupuestoEspejo
  contratacion: Contratacion
  checklistApertura: Record<string, boolean>
  excepciones: Excepcion[]
  tipoExpediente: string
  cierre: Cierre | null
  fechaEntrada: string
  fechaCambioFase: string
  fechaConversion?: string
  etapaOriginal: string
  requiereRevisionIgor: boolean
  documentacionPendiente: string
  medioContacto: string

  /* --- Alta de oportunidad (todos opcionales: nada es obligatorio) --- */
  rolContacto?: RolEnOportunidad
  otrosIntervinientes?: IntervinienteOportunidad[]
  informacionInicial?: InformacionInicial
  urgencia?: UrgenciaInicial
  documentosIniciales?: DocumentoInicial[]
  mensajes?: MensajeOportunidad[]
  /** Contacto o colaborador que realizó la recomendación, cuando proceda. */
  recomendadoPor?: string
  /** Aceptación del presupuesto por el cliente (cierre positivo del Lead). */
  aceptacion?: AceptacionLead | null
  /** Marca de revisión tras una migración dudosa de estados. */
  revisionMigracion?: string
}

/* ------------------------------------------------------------------ */
/* Migración desde las 16 etapas anteriores                            */
/* ------------------------------------------------------------------ */

export const MIGRACION: Record<EtapaOportunidadId, { fase: FaseId; subestado: string }> = {
  nuevo: { fase: 'entrada', subestado: 'Sin revisar' },
  analisis: { fase: 'cualificacion', subestado: 'Análisis pendiente' },
  aceptable: { fase: 'cualificacion', subestado: 'Apto para primera cita' },
  'cita-pendiente': { fase: 'primera-cita', subestado: 'Pendiente de programar' },
  'cita-programada': { fase: 'primera-cita', subestado: 'Programada' },
  'cita-celebrada': { fase: 'primera-cita', subestado: 'Celebrada' },
  'decision-interna': { fase: 'primera-cita', subestado: 'Pendiente de información o decisión' },
  'presupuesto-solicitado': { fase: 'presupuesto', subestado: 'Solicitado' },
  'presupuesto-tramitacion': { fase: 'presupuesto', subestado: 'En preparación' },
  'presupuesto-enviado': { fase: 'contratacion', subestado: 'Pendiente de respuesta' },
  'pendiente-aceptacion': { fase: 'contratacion', subestado: 'Pendiente de respuesta' },
  'pendiente-proforma': { fase: 'ganada', subestado: 'Presupuesto aceptado' },
  'proforma-enviada': { fase: 'ganada', subestado: 'Presupuesto aceptado' },
  'preparada-convertir': { fase: 'ganada', subestado: 'Presupuesto aceptado' },
  convertida: { fase: 'ganada', subestado: 'Presupuesto aceptado' },
  cerrada: { fase: 'cerrada', subestado: 'Otro' },
}

/**
 * Migración de las fases anteriores del Lead (incluida la desaparecida
 * «Lista para apertura») a las ocho fases vigentes. No elimina información:
 * conserva indicadores económicos, relaciones e historial.
 */
export function migrarFaseLegacy(
  faseAntigua: string,
  subestado: string,
): { fase: FaseId; subestado: string; revision?: string } {
  switch (faseAntigua) {
    case 'apertura':
      return {
        fase: 'ganada',
        subestado: 'Presupuesto aceptado',
        ...(subestado === 'Lista para convertir' || subestado === 'Comprobación final'
          ? {}
          : {
              revision: `Migrado desde «Lista para apertura · ${subestado}». Revisar antes de iniciar Onboarding.`,
            }),
      }
    case 'presupuesto':
      if (subestado === 'Pendiente de validación' || subestado === 'Validado')
        return {
          fase: 'validacion',
          subestado:
            subestado === 'Validado' ? 'Validado · Pendiente de envío' : 'Pendiente de validación',
        }
      if (subestado === 'En elaboración')
        return { fase: 'presupuesto', subestado: 'En preparación' }
      if (subestado === 'Bloqueado' || subestado === 'No solicitado')
        return { fase: 'presupuesto', subestado: 'Pendiente de información' }
      if (subestado === 'Requiere modificación')
        return { fase: 'presupuesto', subestado: 'Rectificación solicitada' }
      if (subestado === 'Enviado')
        return { fase: 'contratacion', subestado: 'Pendiente de respuesta' }
      return { fase: 'presupuesto', subestado: 'Solicitado' }
    case 'contratacion':
      if (subestado === 'Presupuesto a modificar' || subestado === 'Solicita modificación')
        return { fase: 'presupuesto', subestado: 'Rectificación solicitada' }
      if (subestado === 'En negociación')
        return { fase: 'contratacion', subestado: 'En negociación' }
      if (subestado === 'Seguimiento programado')
        return { fase: 'contratacion', subestado: 'En seguimiento' }
      if (subestado === 'Sin respuesta') return { fase: 'contratacion', subestado: 'Sin respuesta' }
      if (
        [
          'Aceptado verbalmente',
          'Hoja de encargo pendiente',
          'Hoja de encargo enviada',
          'Hoja de encargo firmada',
          'Proforma generada',
          'Pendiente de pago',
        ].includes(subestado)
      )
        return { fase: 'ganada', subestado: 'Presupuesto aceptado' }
      if (subestado === 'Rechazado') return { fase: 'cerrada', subestado: 'Rechaza el presupuesto' }
      return { fase: 'contratacion', subestado: 'Pendiente de respuesta' }
    case 'cualificacion':
      if (subestado === 'Apta para primera cita')
        return { fase: 'cualificacion', subestado: 'Apto para primera cita' }
      if (subestado === 'Pendiente de información')
        return { fase: 'cualificacion', subestado: 'Pendiente de datos' }
      if (subestado === 'Conflicto pendiente')
        return { fase: 'cualificacion', subestado: 'Pendiente de conflicto de intereses' }
      if (subestado === 'No apta') return { fase: 'cualificacion', subestado: 'No apto' }
      if (subestado === 'Derivada' || subestado === 'Duplicada')
        return { fase: 'cualificacion', subestado: 'Pendiente de revisión interna' }
      return { fase: 'cualificacion', subestado: 'Análisis pendiente' }
    case 'primera-cita':
      if (subestado === 'Sin programar')
        return { fase: 'primera-cita', subestado: 'Pendiente de programar' }
      if (subestado === 'Pendiente de resultado')
        return { fase: 'primera-cita', subestado: 'Pendiente de registrar resultado' }
      if (subestado === 'Pendiente de decisión interna' || subestado === 'Reprogramación pendiente')
        return { fase: 'primera-cita', subestado: 'Pendiente de información o decisión' }
      if (subestado === 'Autorizada para presupuesto')
        return { fase: 'primera-cita', subestado: 'Celebrada' }
      return {
        fase: 'primera-cita',
        subestado: fase('primera-cita').subestados.includes(subestado) ? subestado : 'Programada',
      }
    case 'entrada':
      if (subestado === 'Duplicado detectado')
        return { fase: 'entrada', subestado: 'Posible duplicado' }
      if (subestado === 'Asignado para cualificación')
        return { fase: 'entrada', subestado: 'Datos mínimos completos' }
      return {
        fase: 'entrada',
        subestado: fase('entrada').subestados.includes(subestado) ? subestado : 'Sin revisar',
      }
    case 'ganada':
      return { fase: 'ganada', subestado: 'Presupuesto aceptado' }
    case 'cerrada':
      return {
        fase: 'cerrada',
        subestado: MOTIVOS_CIERRE_LEAD.includes(subestado) ? subestado : 'Otro',
      }
    default:
      return {
        fase: 'entrada',
        subestado: 'Sin revisar',
        revision: 'Estado anterior no reconocido.',
      }
  }
}

const hoy = '05/08/2026'

const estadoOperativoPorFase: Record<FaseId, EstadoOperativo> = {
  entrada: 'Debemos trabajo',
  cualificacion: 'Debemos trabajo',
  'primera-cita': 'En seguimiento',
  presupuesto: 'Debemos trabajo',
  validacion: 'En revisión interna',
  contratacion: 'Depende del cliente',
  ganada: 'En seguimiento',
  cerrada: 'En pausa',
}

export function migrarOportunidad(o: Oportunidad): OportunidadCRM {
  const destino = MIGRACION[o.etapa] ?? { fase: 'entrada', subestado: 'Sin revisar' }
  const f = destino.fase
  const avanzado = ORDEN_FASE.indexOf(f)

  const cita: CitaCRM = o.cita
    ? {
        ...citaVacia(o.cita.responsable),
        fecha: o.cita.fecha,
        hora: o.cita.hora,
        duracion: o.cita.duracion,
        modalidad: o.cita.modalidad,
        lugar: o.cita.lugar,
        asistentes: o.cita.asistentes.join(', '),
        responsable: o.cita.responsable,
        estado: o.cita.celebrada ? 'Celebrada' : 'Programada',
        notasPrevias: o.cita.notas,
        resumen: o.cita.resultado?.resumen ?? '',
        documentacionAportada: (o.cita.resultado?.documentacionRevisada ?? []).join(', '),
        resultado: o.cita.resultado ? 'Solicitar presupuesto' : '',
        proximoPaso: o.cita.resultado?.proximaActuacion ?? '',
        sincronizacionCalendar: 'No sincronizada',
        autorizadaPresupuesto: Boolean(o.cita.resultado) || avanzado >= 3,
        tipoServicioPreliminar: o.area,
      }
    : {
        ...citaVacia(o.responsable),
        estado: avanzado >= 3 ? 'Celebrada' : 'Sin programar',
        resultado: avanzado >= 3 ? 'Solicitar presupuesto' : '',
        resumen: avanzado >= 3 ? 'Cita celebrada antes de la migración del CRM.' : '',
        autorizadaPresupuesto: avanzado >= 3,
        tipoServicioPreliminar: avanzado >= 3 ? o.area : '',
      }

  const presu: PresupuestoEspejo = {
    ...presupuestoVacio(),
    numero: o.presupuestoId ? o.presupuestoId.replace('PR-', 'PR-2026-') : '',
    servicio: o.area,
    importe: o.importeEstimado,
    responsable: o.responsable,
    version: o.presupuestoId ? 1 : 0,
    ...(o.presupuestoId ? { presupuestoId: o.presupuestoId } : {}),
    estado:
      f === 'presupuesto'
        ? (destino.subestado as EstadoPresupuestoEspejo)
        : avanzado >= 4 && (o.presupuestoId || avanzado >= 4)
          ? 'Enviado'
          : 'No solicitado',
    fechaSolicitud: avanzado >= 3 ? o.fechaSeguimiento : '',
    fechaEnvio: avanzado >= 4 ? o.fechaSeguimiento : '',
  }

  const contrat: Contratacion = {
    ...contratacionVacia(),
    decision:
      avanzado >= 5 || o.etapa === 'pendiente-proforma' ? 'Aceptado verbalmente' : 'Pendiente',
    hojaEncargo: avanzado >= 5 ? 'Firmada' : avanzado === 4 ? 'Pendiente' : 'Pendiente',
    proforma: avanzado >= 5 ? 'Generada' : 'No generada',
    pago:
      avanzado >= 5
        ? destino.subestado === 'Lista para convertir' || f === 'ganada'
          ? 'Recibido'
          : 'Pendiente'
        : 'No aplicable',
  }
  if (avanzado >= 5) contrat.decision = 'Aceptado verbalmente'

  const checklist: Record<string, boolean> = {
    hoja: contrat.hojaEncargo === 'Firmada',
    pago: contrat.pago === 'Recibido',
    datos: avanzado >= 2,
    conflicto: o.conflicto === 'Sin conflicto',
    tipo: avanzado >= 4,
    area: Boolean(o.area),
    responsable: Boolean(o.responsable),
    documentacion: o.situacionDocumental === 'Completa',
  }
  if (f === 'ganada') Object.keys(checklist).forEach((k) => (checklist[k] = true))

  return {
    ...o,
    fase: f,
    subestado: destino.subestado,
    estadoOperativo: estadoOperativoPorFase[f],
    proximaAccion: o.proximaActuacion
      ? {
          descripcion: o.proximaActuacion,
          tipo: 'Seguimiento',
          responsable: o.responsable,
          fechaPrevista: o.fechaSeguimiento,
          fechaLimite: '',
          prioridad: o.prioridad,
          estado: 'Pendiente',
        }
      : null,
    cualificacion: {
      comprobaciones: Object.fromEntries(
        COMPROBACIONES_CUALIFICACION.map((c) => [c.id, avanzado >= 2]),
      ),
      apta: avanzado >= 2 ? true : null,
      motivo: avanzado >= 2 ? 'Asunto dentro de las áreas del despacho.' : '',
      resultado: avanzado >= 2 ? 'Apta para primera cita' : '',
      conflictoResuelto: o.conflicto === 'Sin conflicto',
      excepcionConflicto: '',
    },
    citaCRM: cita,
    presupuestoEspejo: presu,
    contratacion: contrat,
    checklistApertura: checklist,
    excepciones: [],
    tipoExpediente: avanzado >= 4 ? o.area : '',
    cierre:
      f === 'cerrada'
        ? {
            tipo: 'Motivo pendiente de clasificación',
            motivo: o.motivoCierre ?? 'Motivo pendiente de clasificación',
            comentario: 'Migrada desde el estado «Cerrada» del kanban anterior.',
            fecha: hoy,
            usuario: 'Sistema',
          }
        : null,
    fechaEntrada: o.fechaSeguimiento,
    fechaCambioFase: hoy,
    ...(f === 'ganada' ? { fechaConversion: hoy } : {}),
    etapaOriginal: o.etapa,
    requiereRevisionIgor: o.alertas.some((a) => a.toLowerCase().includes('igor')),
    documentacionPendiente:
      o.situacionDocumental === 'Completa' ? '' : 'Pendiente de completar la documentación mínima.',
    medioContacto: 'Teléfono y correo registrados en la ficha de contacto',
    historial: [
      ...o.historial,
      {
        fecha: `${hoy} 09:00`,
        usuario: 'Sistema',
        tipo: 'Migración',
        descripcion: `Estado anterior «${o.etapa}» migrado a ${fase(f).nombre} · ${destino.subestado}`,
      },
    ],
  }
}

export const OPORTUNIDADES_MIGRADAS = OPORTUNIDADES.map(migrarOportunidad)

/* ------------------------------------------------------------------ */
/* Gates                                                               */
/* ------------------------------------------------------------------ */

export type Requisito = { label: string; ok: boolean }

export function requisitosGate(o: OportunidadCRM, destino: FaseId): Requisito[] {
  const exc = (id: string) => o.excepciones.some((e) => e.requisito === id)
  switch (destino) {
    case 'cualificacion':
      return [
        { label: 'Nombre o denominación del posible cliente', ok: Boolean(o.contactoId) },
        { label: 'Al menos un medio de contacto', ok: Boolean(o.medioContacto.trim()) },
        { label: 'Descripción inicial del asunto', ok: Boolean(o.descripcion.trim()) },
        { label: 'Responsable asignado', ok: Boolean(o.responsable) },
        { label: 'Origen del Lead', ok: Boolean(o.origen) },
        { label: 'Área jurídica preliminar', ok: Boolean(o.area) },
      ]
    case 'primera-cita':
      return [
        { label: 'Lead marcado como apto en la cualificación', ok: o.cualificacion.apta === true },
        {
          label: 'Conflicto comprobado o excepción autorizada',
          ok: o.cualificacion.conflictoResuelto || Boolean(o.cualificacion.excepcionConflicto),
        },
        { label: 'Responsable asignado', ok: Boolean(o.responsable) },
        {
          label: 'Motivo y resultado de cualificación registrados',
          ok: Boolean(o.cualificacion.motivo.trim()) && Boolean(o.cualificacion.resultado.trim()),
        },
      ]
    case 'presupuesto':
      return [
        {
          label: 'Cita celebrada (salvo excepción justificada)',
          ok: o.citaCRM.estado === 'Celebrada' || exc('cita'),
        },
        { label: 'Resultado de la primera cita registrado', ok: Boolean(o.citaCRM.resultado) },
        { label: 'Responsable del posible encargo', ok: Boolean(o.responsable) },
      ]
    case 'validacion':
      return [
        {
          label: 'Presupuesto vinculado y preparado',
          ok: o.presupuestoEspejo.estado !== 'No solicitado',
        },
        {
          label: 'Elaborador del presupuesto asignado',
          ok: Boolean(o.presupuestoEspejo.responsable),
        },
      ]
    case 'contratacion':
      return [
        {
          label: 'Versión vigente del presupuesto validada por Igor',
          ok:
            o.presupuestoEspejo.validadoVersion === o.presupuestoEspejo.version ||
            exc('presupuesto'),
        },
        {
          label: 'Envío al cliente registrado',
          ok: Boolean(o.presupuestoEspejo.fechaEnvio) || exc('presupuesto'),
        },
      ]
    case 'ganada':
      return [
        {
          label: 'Presupuesto enviado al cliente',
          ok: Boolean(o.presupuestoEspejo.fechaEnvio) || exc('presupuesto'),
        },
        { label: 'Versión aceptada identificada', ok: Boolean(o.aceptacion?.version) },
        { label: 'Fecha de aceptación registrada', ok: Boolean(o.aceptacion?.fecha) },
      ]
    case 'cerrada':
      return [{ label: 'Motivo de cierre registrado', ok: Boolean(o.cierre) }]
    default:
      return []
  }
}

/** Requisitos de apertura de expediente. Ya no pertenecen al Lead: se
 *  comprobarán en el futuro módulo Onboarding, pero se conservan. */
export function requisitosApertura(o: OportunidadCRM): Requisito[] {
  const exc = (id: string) => o.excepciones.some((e) => e.requisito === id)
  return [
    ...CHECKLIST_APERTURA.map<Requisito>((c) => ({
      label: c.label,
      ok: Boolean(o.checklistApertura[c.id]) || exc(c.id),
    })),
    { label: 'El Lead no se ha convertido antes', ok: !o.expedienteId },
  ]
}

export function gateOk(o: OportunidadCRM, destino: FaseId) {
  return requisitosGate(o, destino).every((r) => r.ok)
}

export const esRetroceso = (origen: FaseId, destino: FaseId) =>
  ORDEN_FASE.indexOf(destino) < ORDEN_FASE.indexOf(origen)

export const exigeMotivoRetroceso = (origen: FaseId) =>
  ['presupuesto', 'validacion', 'contratacion'].includes(origen)

/* ------------------------------------------------------------------ */
/* Fechas y alertas                                                    */
/* ------------------------------------------------------------------ */

export const HOY = new Date(2026, 7, 5)

export function parseFecha(v: string | undefined): Date | null {
  if (!v) return null
  const m = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
}

export const formatoFecha = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

export const hoyTexto = () => formatoFecha(HOY)

export const sumarDias = (dias: number, desde: Date = HOY) => {
  const d = new Date(desde)
  d.setDate(d.getDate() + dias)
  return formatoFecha(d)
}

export const diasDesde = (v: string | undefined) => {
  const d = parseFecha(v)
  if (!d) return 0
  return Math.round((HOY.getTime() - d.getTime()) / 86400000)
}

export function diasEnFase(o: OportunidadCRM) {
  const d = parseFecha(o.fechaCambioFase)
  if (!d) return o.diasEnFase
  return Math.max(diasDesde(o.fechaCambioFase), 0)
}

export function alertasDe(o: OportunidadCRM, umbrales: Umbrales = UMBRALES_DEFECTO): string[] {
  if (o.fase === 'ganada') return []
  const out: string[] = []
  if (o.fase !== 'cerrada') {
    if (!o.proximaAccion) out.push('SIN SIGUIENTE ACCIÓN')
    if (!o.responsable) out.push('Sin responsable')
    if (diasEnFase(o) >= umbrales.alertaEstancamiento) out.push(`Estancada ${diasEnFase(o)} días`)
    const prev = parseFecha(o.proximaAccion?.fechaPrevista)
    if (prev && prev < HOY) out.push('Próxima acción vencida')
    if (o.requiereRevisionIgor) out.push('Pendiente de revisión de Igor')
    if (o.conflicto === 'Conflicto detectado') out.push('Conflicto de interés')
    if (o.presupuestoEspejo.estado === 'Bloqueado') out.push('Presupuesto bloqueado')
    if (o.presupuestoEspejo.estado === 'Requiere modificación') out.push('Rectificación solicitada')
    if (o.documentacionPendiente) out.push('Documentación pendiente')
    if (o.subestado === 'Posible duplicado') out.push('Posible duplicado')
    if (
      o.fase === 'contratacion' &&
      o.presupuestoEspejo.vigencia &&
      diasDesde(o.presupuestoEspejo.vigencia) >= -3
    )
      out.push('Próximo a caducar')
    if (
      o.fase === 'contratacion' &&
      diasDesde(o.presupuestoEspejo.fechaEnvio) >= umbrales.tareaSeguimiento
    )
      out.push('Seguimiento vencido')
  }
  if (o.fase === 'cerrada' && o.cierre?.motivo === 'Motivo pendiente de clasificación')
    out.push('Motivo de cierre por revisar')
  return out
}

export const tono = (f: FaseId): Tono => fase(f).tono
