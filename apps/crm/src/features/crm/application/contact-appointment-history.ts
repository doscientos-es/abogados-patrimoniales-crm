import type { NotaRemota } from '@/features/notas'
import type { TareaPersistida } from '@/features/tareas'

import { estadoAsistente, isAppointment } from './first-meeting-cycle'

type Origin = { id: string; reference: string }
export type ContactAppointmentOrigins = { leads: Origin[]; cases: Origin[] }

export function groupContactAppointments({
  tasks,
  contactId,
  lead,
  selectedId,
  origins,
  now,
}: {
  tasks: TareaPersistida[]
  contactId: string
  lead: Origin
  selectedId: string | undefined
  origins: ContactAppointmentOrigins | undefined
  now: number
}) {
  const leadReferences = new Map(origins?.leads.map(({ id, reference }) => [id, reference]))
  leadReferences.set(lead.id, lead.reference)
  const caseReferences = new Map(origins?.cases.map(({ id, reference }) => [id, reference]))
  const entries = tasks.flatMap((task) => {
    if (task.id === selectedId || !isAppointment(task)) return []
    const { expedienteId, oportunidadId, reunion } = task
    const reference = expedienteId
      ? caseReferences.get(expedienteId)
      : oportunidadId
        ? leadReferences.get(oportunidadId)
        : undefined
    const attendees = Array.isArray(reunion['attendeeContactIds'])
      ? reunion['attendeeContactIds'].filter((id) => typeof id === 'string' && id.trim())
      : []
    if (attendees.length ? !attendees.includes(contactId) : reference === undefined) return []

    const state = estadoAsistente(reunion)
    const startsAt = reunion['startsAt']
    const start = typeof startsAt === 'string' ? Date.parse(startsAt) : Number.NaN
    const date =
      state === 'pendiente'
        ? null
        : finiteDate(Number.isFinite(start) ? start : Date.parse(task.venceEn ?? ''))
    const origin = expedienteId ? 'Expediente' : oportunidadId ? 'Lead' : 'Cita'
    const closed = state === 'finalizada' || state === 'cancelada' || state === 'no_asistencia'
    const group =
      closed || (date !== null && date < now && state !== 'en_curso')
        ? 'past'
        : date !== null || state === 'en_curso'
          ? 'upcoming'
          : 'unscheduled'
    return [{ task, state, date, origin, reference, group }]
  })

  return {
    upcoming: entries
      .filter((entry) => entry.group === 'upcoming')
      .sort((a, b) => (a.date ?? now) - (b.date ?? now)),
    past: entries
      .filter((entry) => entry.group === 'past')
      .sort((a, b) => (b.date ?? 0) - (a.date ?? 0)),
    unscheduled: entries.filter((entry) => entry.group === 'unscheduled'),
  }
}

function finiteDate(timestamp: number) {
  return Number.isFinite(timestamp) ? timestamp : null
}

export type ContactAppointmentEntry = ReturnType<typeof groupContactAppointments>['past'][number]

type ClosingNote = Pick<NotaRemota, 'status' | 'details' | 'content'>

export function closingNoteTaskId(note: ClosingNote) {
  const details = note.details
  if (
    note.status === 'archived' ||
    !details ||
    typeof details !== 'object' ||
    Array.isArray(details)
  )
    return null
  const taskId = details['taskId']
  return typeof taskId === 'string' &&
    (details['cierreCita'] === 'true' || details['cierrePrimeraCita'] === 'true')
    ? taskId
    : null
}

export function closingNoteItems(note: ClosingNote | undefined) {
  const details = note?.details
  const items =
    details && typeof details === 'object' && !Array.isArray(details)
      ? details['notasFinales']
      : null
  return Array.isArray(items)
    ? items.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : note?.content.trim()
      ? [note.content]
      : []
}
