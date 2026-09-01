// Modelo único del sistema transversal de NOTAS INTERNAS.
// Una nota nace en un ámbito (persona, expediente, oportunidad, ejecución,
// presupuesto…) y se recopila allí donde sea relevante, sin duplicarse.
import { Briefcase, Landmark, Receipt, Target, User, type LucideIcon } from 'lucide-react'

export const AMBITOS = ['persona', 'expediente', 'oportunidad', 'ejecucion', 'presupuesto'] as const
export type AmbitoNota = (typeof AMBITOS)[number]

export type EstadoNota = 'activa' | 'resuelta' | 'archivada'
export type VigenciaNota = 'permanente' | 'temporal'
export type AlVencer = 'archivar' | 'confirmar'
export type VisibilidadNota = 'equipo' | 'restringida'

export const DISPARADORES = [
  { id: 'abrir-contacto', label: 'Al abrir el contacto' },
  { id: 'abrir-expediente', label: 'Al abrir el expediente' },
  { id: 'antes-contactar', label: 'Antes de contactar con la persona' },
  { id: 'llamada', label: 'Al iniciar o registrar una llamada' },
  { id: 'comunicacion', label: 'Al redactar una comunicación' },
  { id: 'proxima-cita', label: 'En la próxima cita' },
  { id: 'siempre', label: 'Siempre mientras esté activa' },
] as const
export type DisparadorNota = (typeof DISPARADORES)[number]['id']

export const TIPOS_CONVERSION = ['tarea', 'actividad', 'actuacion', 'alerta'] as const
export type TipoConversion = (typeof TIPOS_CONVERSION)[number]

export type EventoNota = {
  id: string
  fecha: string
  usuario: string
  accion: string
  detalle?: string
}

export type ConversionNota = {
  tipo: TipoConversion
  referenciaId: string
  etiqueta: string
  fecha: string
  usuario: string
}

export type OrigenNota = {
  tipo: AmbitoNota
  id: string
  etiqueta: string
}

export type NotaInterna = {
  id: string
  ambito: AmbitoNota
  titulo?: string
  contenido: string
  origen: OrigenNota
  /** Contactos relacionados (IDs de contacto). */
  contactos: string[]
  expedienteId?: string
  oportunidadId?: string
  ejecucionId?: string
  presupuestoId?: string
  autor: string
  creada: string
  modificada?: string
  modificadaPor?: string
  estado: EstadoNota
  destacada: boolean
  critica: boolean
  requiereConfirmacion: boolean
  confirmaciones: { usuario: string; fecha: string }[]
  vigencia: VigenciaNota
  desde?: string
  revision?: string
  vencimiento?: string
  alVencer: AlVencer
  pendienteRevision: boolean
  disparadores: DisparadorNota[]
  /** Aviso contextual pospuesto hasta esta fecha. */
  posponerHasta?: string
  visibilidad: VisibilidadNota
  autorizados: string[]
  conversiones: ConversionNota[]
  historial: EventoNota[]
  archivadaPor?: string
  archivadaEl?: string
  resueltaPor?: string
  resueltaEl?: string
}

export type MetaAmbito = {
  label: string
  corto: string
  icon: LucideIcon
  /** Clase CSS con el tono estable del ámbito (definida en styles.css). */
  clase: string
  disponible: boolean
}

export const AMBITO_META: Record<AmbitoNota, MetaAmbito> = {
  persona: {
    label: 'Nota de la persona',
    corto: 'Persona',
    icon: User,
    clase: 'nota-tono-persona',
    disponible: true,
  },
  expediente: {
    label: 'Nota del expediente',
    corto: 'Expediente',
    icon: Briefcase,
    clase: 'nota-tono-expediente',
    disponible: true,
  },
  oportunidad: {
    label: 'Nota de oportunidad',
    corto: 'Oportunidad',
    icon: Target,
    clase: 'nota-tono-oportunidad',
    disponible: true,
  },
  ejecucion: {
    label: 'Nota de ejecución',
    corto: 'Ejecución',
    icon: Landmark,
    clase: 'nota-tono-ejecucion',
    disponible: true,
  },
  presupuesto: {
    label: 'Nota de presupuesto',
    corto: 'Presupuesto',
    icon: Receipt,
    clase: 'nota-tono-presupuesto',
    disponible: true,
  },
}

export const ESTADO_LABEL: Record<EstadoNota, string> = {
  activa: 'Activa',
  resuelta: 'Resuelta',
  archivada: 'Archivada',
}

export const AVISO_INTERNO =
  'Añade información interna de contexto. No forma parte de las comunicaciones con el cliente ni será visible para terceros.'
