import { useId, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useContactAppointmentOrigins } from '@/features/crm'
import {
  closingNoteItems,
  closingNoteTaskId,
  groupContactAppointments,
  type ContactAppointmentEntry,
} from '@/features/crm/application/contact-appointment-history'
import { ESTADO_ASISTENTE_LABEL } from '@/features/crm/application/first-meeting-cycle'
import { useNotasRemotas } from '@/features/notas'
import type { TareaPersistida } from '@/features/tareas'

import { AppointmentLink } from './appointment-link'

const appointmentDateFormat = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function ContactAppointmentHistory({
  firmId,
  contactId,
  contactName,
  lead,
  tasks,
  selectedId,
}: {
  firmId: string
  contactId: string
  contactName: string
  lead: { id: string; reference: string }
  tasks: TareaPersistida[]
  selectedId: string | undefined
}) {
  const titleId = useId()
  const [now] = useState(Date.now)
  const origins = useContactAppointmentOrigins(firmId, contactId)
  const history = groupContactAppointments({
    tasks,
    contactId,
    lead,
    selectedId,
    origins: origins.data,
    now,
  })
  const hasPastAppointments = history.past.some(({ state }) => state === 'finalizada')
  const notes = useNotasRemotas(hasPastAppointments ? firmId : undefined)
  const summaries = new Map<string, string[]>()
  for (const note of notes.data ?? []) {
    const taskId = closingNoteTaskId(note)
    if (taskId && !summaries.has(taskId)) summaries.set(taskId, closingNoteItems(note))
  }

  return (
    <aside aria-labelledby={titleId} className="min-w-0">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <header>
            <h2 id={titleId} className="text-sm font-semibold">
              Historial de citas
            </h2>
            <p className="text-muted-foreground text-xs">
              Citas de {contactName} en leads y expedientes.
            </p>
          </header>
          {origins.isPending ? (
            <p className="text-muted-foreground text-xs">Buscando citas relacionadas…</p>
          ) : null}
          {origins.isError ? (
            <p className="text-destructive text-xs">
              No se han podido cargar todas las citas relacionadas.
            </p>
          ) : null}
          <AppointmentGroup title="Próximas y en curso" entries={history.upcoming} />
          <AppointmentGroup title="Anteriores" entries={history.past} summaries={summaries} />
          <AppointmentGroup title="Sin fecha confirmada" entries={history.unscheduled} />
          {hasPastAppointments && notes.isError ? (
            <p className="text-destructive text-xs">No se han podido cargar las notas finales.</p>
          ) : null}
          {!origins.isPending &&
          !origins.isError &&
          !history.upcoming.length &&
          !history.past.length &&
          !history.unscheduled.length ? (
            <p className="text-muted-foreground text-sm">No hay otras citas para este contacto.</p>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  )
}

function AppointmentGroup({
  title,
  entries,
  summaries,
}: {
  title: string
  entries: ContactAppointmentEntry[]
  summaries?: Map<string, string[]>
}) {
  const headingId = useId()
  if (!entries.length) return null
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="text-muted-foreground text-xs font-medium">
        {title}
      </h3>
      <ul className="space-y-2">
        {entries.map(({ task, state, date, origin, reference }) => {
          const notes = state === 'finalizada' ? summaries?.get(task.id) : undefined
          return (
            <li key={task.id} className="rounded-md border">
              <details className="p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  <span className="wrap-break-word">{task.titulo}</span>
                  <span className="text-muted-foreground mt-1 block text-xs font-normal">
                    {origin}
                    {reference ? ` · ${reference}` : ''}
                    {date === null ? '' : ' · '}
                    {date === null ? null : (
                      <time dateTime={new Date(date).toISOString()}>
                        {appointmentDateFormat.format(date)}
                      </time>
                    )}
                  </span>
                </summary>
                <div className="mt-2 space-y-2">
                  <Badge variant="secondary">{ESTADO_ASISTENTE_LABEL[state]}</Badge>
                  {notes?.length ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Notas finales</p>
                      <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm wrap-break-word whitespace-pre-line">
                        {notes.map((text, index) => (
                          <li key={`${index}-${text}`}>{text}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <AppointmentLink task={task} newTab />
                  </div>
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
