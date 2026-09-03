export type TipoTarea = 'Tarea' | 'Recordatorio' | 'Evento' | 'Plazo'
export type EstadoTarea = 'Pendiente' | 'En curso' | 'Completada' | 'Cancelada'
export type ValidacionPlazo = 'No aplica' | 'Propuesto' | 'Validado' | 'Rechazado'

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
}

export type ValidarPlazoInput = {
  id: string
  versionEsperada: number
  decision: 'Validado' | 'Rechazado'
  venceEn: string | null
  fuente: string
  nota: string
}
