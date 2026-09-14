import type { Json } from '@/shared/infrastructure/supabase'

export type PrioridadExpediente = 'Alta' | 'Media' | 'Baja'

export type ExpedientePersistido = {
  id: string
  referencia: string
  contactoPrincipalId: string
  oportunidadId: string | null
  titulo: string
  area: string
  tipoAsunto: string
  naturaleza: 'Judicial' | 'Extrajudicial'
  estadoGeneral: string
  fase: string
  estadoOperativo: string
  prioridad: PrioridadExpediente
  asignadoId: string | null
  fechaApertura: string
  fechaCierre: string | null
  proximaAccion: string
  dondeEstamos: string
  detalles: Json
  version: number
  actualizadoEn: string
}

export type LineaPersistida = {
  id: string
  expedienteId: string
  parentId: string | null
  titulo: string
  tipo: string
  descripcion: string
  estado: string
  prioridad: PrioridadExpediente
  asignadoId: string | null
  fechaInicio: string | null
  fechaObjetivo: string | null
  fechaResolucion: string | null
  fechaCierre: string | null
  orden: number
  version: number
}

export type ActuacionPersistida = {
  id: string
  expedienteId: string
  lineaId: string | null
  tipo: string
  titulo: string
  descripcion: string
  ocurridaEn: string
  asignadoId: string | null
  estado: string
  resultado: string
  proximaAccion: string
  horas: number
  facturable: boolean
  visibleCliente: boolean
  clienteInformado: boolean
  version: number
}

export type ParticipantePersistido = {
  id: string
  expedienteId: string
  contactoId: string | null
  nombre: string
  rol: string
  confidencialidad: 'Normal' | 'Restringida' | 'Confidencial'
}

export type EventoExpediente = {
  id: string
  entidad: 'case' | 'workstream' | 'activity' | 'participant'
  accion: 'created' | 'updated' | 'deleted'
  campos: string[]
  actorId: string | null
  creadoEn: string
}

export type CrearExpedienteInput = {
  contactoPrincipalId: string
  oportunidadId?: string | null
  titulo: string
  area: string
  tipoAsunto: string
  naturaleza: ExpedientePersistido['naturaleza']
  prioridad: PrioridadExpediente
  asignadoId: string | null
  fechaApertura: string
  proximaAccion: string
  dondeEstamos: string
}

export type ActualizarExpedienteInput = Omit<
  CrearExpedienteInput,
  'contactoPrincipalId' | 'oportunidadId'
> & {
  id: string
  versionEsperada: number
  estadoGeneral: string
  fase: string
  estadoOperativo: string
  fechaCierre: string | null
}

export type CrearLineaInput = {
  expedienteId: string
  titulo: string
  tipo: string
  descripcion: string
  prioridad: PrioridadExpediente
  asignadoId: string | null
  fechaObjetivo: string | null
}

export type CrearActuacionInput = {
  expedienteId: string
  lineaId: string | null
  tipo: string
  titulo: string
  descripcion: string
  asignadoId: string | null
  resultado: string
  proximaAccion: string
  horas: number
  facturable: boolean
}

export type CrearParticipanteInput = {
  expedienteId: string
  contactoId: string | null
  nombre: string
  rol: string
  confidencialidad: ParticipantePersistido['confidencialidad']
}
