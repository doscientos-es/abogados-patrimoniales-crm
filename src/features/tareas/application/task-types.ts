export type TipoTarea = 'Tarea' | 'Recordatorio' | 'Evento' | 'Plazo'
export type EstadoTarea = 'Pendiente' | 'En curso' | 'En espera' | 'Completada' | 'Cancelada'
export type ValidacionPlazo = 'No aplica' | 'Propuesto' | 'Validado' | 'Rechazado'

export type EstadoPrimeraCita =
  | 'Programada'
  | 'Celebrada'
  | 'No comparece'
  | 'Reprogramación pendiente'

export type DetallesPrimeraCita = {
  estado: EstadoPrimeraCita
  duracion: string
  asistentesAdicionales: string
  resumen: string
  documentacionAportada: string
  resultado: string
  observaciones: string
  autorizadaPresupuesto: boolean
  tipoServicioPreliminar: string
}

export type DetallesReunion = {
  startsAt: string
  endsAt: string
  mode: 'office_bilbao' | 'office_recalde' | 'phone' | 'outside_office'
  location: string
  meetingUrl: string
  preparation: string
  attendeeContactIds: string[]
  attendeeUserIds: string[]
  primeraCita?: DetallesPrimeraCita
}

export type EtiquetaTarea = {
  id: string
  nombre: string
  color: string
}

export type TareaPersistida = {
  id: string
  expedienteId: string | null
  oportunidadId: string | null
  lineaId: string | null
  tipo: TipoTarea
  titulo: string
  descripcion: string
  estado: EstadoTarea
  prioridad: 'Baja' | 'Media' | 'Alta'
  venceEn: string | null
  recordarEn: string | null
  clasePlazo: 'Judicial' | 'Extrajudicial' | null
  validacion: ValidacionPlazo
  fuentePlazo: string
  notaValidacion: string
  validadoPor: string | null
  validadoEn: string | null
  critico: boolean
  asignadoId: string | null
  creadaPorId: string | null
  esSiguienteAccion: boolean
  motivoEspera: string | null
  revisarEn: string | null
  detalleEspera: string
  resultadoCierre: string
  motivoCancelacion: string
  abiertaEn: string | null
  abiertaPorId: string | null
  motivoRechazo: string
  rechazadaEn: string | null
  tareaPadreId: string | null
  reunion: Record<string, unknown>
  bloqueada: boolean
  etiquetas: EtiquetaTarea[]
  version: number
}

export type CrearTareaInput = {
  expedienteId: string | null
  oportunidadId: string | null
  tipo: TipoTarea
  titulo: string
  descripcion: string
  prioridad: TareaPersistida['prioridad']
  venceEn: string | null
  recordarEn: string | null
  clasePlazo: TareaPersistida['clasePlazo']
  critico: boolean
  asignadoId: string | null
  mensajeInicial?: string
  etiquetaIds?: string[]
  detallesReunion?: DetallesReunion
}

export type TransicionEsperaInput = {
  task: TareaPersistida
  motivo: string
  revisarEn: string
  detalle?: string
}

export type CompletarTareaInput = {
  task: TareaPersistida
  resultado: string
  continuidad?: 'create_next_task' | 'close_without_continuity'
}

export type ValidarPlazoInput = {
  id: string
  versionEsperada: number
  decision: 'Validado' | 'Rechazado'
  venceEn: string | null
  fuente: string
  nota: string
}
