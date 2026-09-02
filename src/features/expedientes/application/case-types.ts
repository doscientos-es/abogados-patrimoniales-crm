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
