import type { CrearTareaInput, DetallesReunion, TareaPersistida } from '@/features/tareas'

export type EstadoAsistente = 'programada' | 'en_curso' | 'finalizada' | 'no_asistencia'

export const ESTADO_ASISTENTE_LABEL: Record<EstadoAsistente, string> = {
  programada: 'Agendada',
  en_curso: 'En curso',
  finalizada: 'Finalizada',
  no_asistencia: 'No ha acudido',
}

export const REMINDER_TITLE = 'REVISAR / CERRAR LEAD POR FALTA DE RESPUESTA'
export const REMINDER_DAYS = 15
export const NO_SHOW_REASON = 'No ha acudido a la Primera cita.'

type Reunion = Record<string, unknown>

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalize(value: unknown) {
  return typeof value === 'string'
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
    : ''
}

/** Recognizes the persisted first-meeting shape and special meetings created from Tasks. */
export function isFirstMeeting(task: Pick<TareaPersistida, 'tipo' | 'oportunidadId' | 'reunion'>) {
  if (task.oportunidadId === null) return false
  const reunion = record(task.reunion)
  const hasPrimeraCita = Object.keys(record(reunion['primeraCita'])).length > 0
  const typedFirstMeeting =
    normalize(reunion['meetingType']) === 'primera cita' &&
    (reunion['specialType'] === undefined || reunion['specialType'] === 'meeting')
  return hasPrimeraCita || typedFirstMeeting
}

/** Prefer a live meeting; if all are closed, return the most recently listed one. */
export function pickFirstMeeting<
  T extends Pick<TareaPersistida, 'tipo' | 'oportunidadId' | 'reunion' | 'estado'>,
>(tasks: T[], opportunityId: string): T | undefined {
  const items = tasks.filter((task) => task.oportunidadId === opportunityId && isFirstMeeting(task))
  return items.find((task) => !['Completada', 'Cancelada'].includes(task.estado)) ?? items[0]
}

export function estadoAsistente(reunion: Reunion): EstadoAsistente {
  const status = reunion['status']
  const estado = record(reunion['primeraCita'])['estado']
  if (status === 'not_held' || estado === 'No comparece') return 'no_asistencia'
  if (status === 'finished' || estado === 'Celebrada') return 'finalizada'
  if (status === 'in_progress' || estado === 'En curso') return 'en_curso'
  return 'programada'
}

export const puedeComenzar = (reunion: Reunion) => estadoAsistente(reunion) === 'programada'
export const puedeMarcarNoAsistencia = (reunion: Reunion) =>
  estadoAsistente(reunion) === 'programada'
export const puedeTerminar = (reunion: Reunion) => estadoAsistente(reunion) === 'en_curso'

function withPrimeraCita(
  reunion: Reunion,
  patch: Record<string, unknown>,
  extra: Partial<DetallesReunion>,
) {
  return {
    ...(reunion as unknown as DetallesReunion),
    ...extra,
    primeraCita: { ...record(reunion['primeraCita']), ...patch },
  } as DetallesReunion
}

export function comenzar(reunion: Reunion, now: string): DetallesReunion {
  if (!puedeComenzar(reunion))
    throw new Error('La Primera cita no se puede comenzar en su estado actual.')
  return withPrimeraCita(
    reunion,
    { estado: 'En curso', horaInicioReal: now },
    { status: 'in_progress', startedAt: now },
  )
}

export function terminar(reunion: Reunion, now: string): DetallesReunion {
  if (!puedeTerminar(reunion)) throw new Error('Solo se puede terminar una Primera cita en curso.')
  const startedAt = record(reunion['primeraCita'])['horaInicioReal'] ?? reunion['startedAt']
  const started = typeof startedAt === 'string' ? Date.parse(startedAt) : Number.NaN
  return withPrimeraCita(
    reunion,
    { estado: 'Celebrada', horaFinReal: now },
    {
      status: 'finished',
      finishedAt: now,
      ...(Number.isNaN(started)
        ? {}
        : { actualDurationMinutes: Math.max(0, Math.round((Date.parse(now) - started) / 60_000)) }),
    },
  )
}

export function marcarNoAsistencia(reunion: Reunion, now: string): DetallesReunion {
  if (!puedeMarcarNoAsistencia(reunion))
    throw new Error('Solo se puede marcar la no asistencia antes de comenzar la cita.')
  return withPrimeraCita(
    reunion,
    { estado: 'No comparece', noAsistenciaEn: now },
    { status: 'not_held', statusReason: NO_SHOW_REASON },
  )
}

/** Reminder date is 15 days later at 09:00 in the user's local timezone. */
export function fechaRecordatorio(now: Date): string {
  const due = new Date(now)
  due.setDate(due.getDate() + REMINDER_DAYS)
  due.setHours(9, 0, 0, 0)
  return due.toISOString()
}

export function recordatorioNoAsistencia(
  task: Pick<TareaPersistida, 'oportunidadId' | 'asignadoId'>,
  now: Date,
): CrearTareaInput {
  return {
    expedienteId: null,
    oportunidadId: task.oportunidadId,
    tipo: 'Tarea',
    titulo: REMINDER_TITLE,
    descripcion:
      'El contacto no acudió a la Primera cita. Si no ha respondido, decide si cerrar el Lead o mantenerlo abierto / dar nueva cita.',
    prioridad: 'Media',
    venceEn: fechaRecordatorio(now),
    recordarEn: null,
    clasePlazo: null,
    critico: false,
    asignadoId: task.asignadoId,
  }
}

export const NO_SHOW_EMAIL_TEMPLATE = {
  nombre: 'No asistencia Primera Cita',
  asunto: 'Su Primera Cita con LEX & DOSCIENTOS',
  cuerpo: (nombre: string, fecha: string) =>
    `Estimado/a ${nombre || 'cliente'}:\n\nLe esperábamos el ${fecha} para la Primera Cita y no hemos podido atenderle.\n\nSi sigue interesado/a, responda a este correo o llámenos y le daremos una nueva cita.\n\nUn saludo,\nLEX & DOSCIENTOS`,
}
