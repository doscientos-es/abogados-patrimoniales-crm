export type AmbitoNota = 'persona' | 'expediente' | 'oportunidad' | 'ejecucion' | 'presupuesto'
export type DisparadorNota =
  | 'abrir-contacto'
  | 'abrir-expediente'
  | 'antes-contactar'
  | 'llamada'
  | 'comunicacion'
  | 'proxima-cita'
  | 'siempre'

export type ConversionNota = {
  tipo: 'tarea' | 'actividad' | 'actuacion' | 'alerta'
  referenciaId: string
  etiqueta: string
  fecha: string
  usuario: string
}

export type NotaInterna = {
  id: string
  ambito: AmbitoNota
  titulo?: string
  contenido: string
  origen: { tipo: AmbitoNota; id: string; etiqueta: string }
  contactos: string[]
  expedienteId?: string
  oportunidadId?: string
  ejecucionId?: string
  presupuestoId?: string
  autor: string
  creada: string
  modificada?: string
  modificadaPor?: string
  estado: 'activa' | 'resuelta' | 'archivada'
  destacada: boolean
  critica: boolean
  requiereConfirmacion: boolean
  confirmaciones: { usuario: string; fecha: string }[]
  vigencia: 'permanente' | 'temporal'
  desde?: string
  revision?: string
  vencimiento?: string
  alVencer: 'archivar' | 'confirmar'
  pendienteRevision: boolean
  disparadores: DisparadorNota[]
  posponerHasta?: string
  visibilidad: 'equipo' | 'restringida'
  autorizados: string[]
  conversiones: ConversionNota[]
  historial: { id: string; fecha: string; usuario: string; accion: string; detalle?: string }[]
  archivadaPor?: string
  archivadaEl?: string
  resueltaPor?: string
  resueltaEl?: string
}
