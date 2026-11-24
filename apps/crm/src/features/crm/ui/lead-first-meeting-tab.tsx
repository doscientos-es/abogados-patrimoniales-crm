import { Link } from '@tanstack/react-router'
import { CalendarPlus } from 'lucide-react'
import { useState } from 'react'

import { TaskCreateDialog } from '@/components/tareas/task-create-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { OportunidadPersistida } from '@/features/crm'
import {
  ESTADO_ASISTENTE_LABEL,
  canHoldAppointment,
  estadoAsistente,
  isAppointment,
} from '@/features/crm/application/first-meeting-cycle'
import { ContactAppointmentHistory } from '@/features/crm/ui/contact-appointment-history'
import { FirstMeetingAssistant } from '@/features/crm/ui/first-meeting-assistant'
import { FirstMeetingData } from '@/features/crm/ui/first-meeting-data'
import { FirstMeetingWorkspace } from '@/features/crm/ui/first-meeting-workspace'
import { useCrearTarea, useTareasPersistentes, type CrearTareaInput } from '@/features/tareas'

export function LeadFirstMeetingTab({
  opportunity,
  ...props
}: AppointmentTabProps & { opportunity: OportunidadPersistida }) {
  return <AppointmentsTab {...props} scope="lead" parent={opportunity} />
}

type AppointmentTabProps = {
  firmId: string
  members: Array<{ id: string; nombre: string }>
  contactId: string
  contactName?: string | undefined
  currentUserId: string
  memberRole: string
  canEdit: boolean
  appointmentId?: string | undefined
}

/** Lead and case appointments share the workspace, but never inherit each other's meetings. */
export function AppointmentsTab({
  scope,
  parent,
  firmId,
  members,
  contactId,
  contactName = 'Cliente',
  currentUserId,
  memberRole,
  canEdit,
  appointmentId,
}: AppointmentTabProps & {
  scope: 'lead' | 'case'
  parent: { id: string; titulo: string; referencia: string }
}) {
  const tasks = useTareasPersistentes(firmId)
  const createTask = useCrearTarea(firmId)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [selected, setSelected] = useState<string>()
  const meetings = (tasks.data ?? []).filter(
    (task) =>
      isAppointment(task) &&
      (scope === 'case'
        ? task.expedienteId === parent.id
        : !task.expedienteId && task.oportunidadId === parent.id),
  )
  const task =
    meetings.find((item) => item.id === (selected ?? appointmentId)) ??
    meetings.find((item) => estadoAsistente(item.reunion) === 'en_curso') ??
    meetings.find((item) => estadoAsistente(item.reunion) === 'programada') ??
    meetings[0]
  const state = task ? estadoAsistente(task.reunion) : undefined
  const canManage =
    canEdit &&
    (task?.creadaPorId === currentUserId || ['owner', 'admin', 'lawyer'].includes(memberRole))
  const canHold = Boolean(task && canEdit && canHoldAppointment(task, currentUserId, memberRole))
  const first = scope === 'lead' && meetings.length === 0
  const showContactHistory = scope === 'lead' && Boolean(contactId)

  const schedule = async (input: CrearTareaInput) => {
    const details = input.detallesReunion
    if (!details) throw new Error('Faltan los datos de la cita.')
    const created = await createTask.mutateAsync(
      first
        ? {
            ...input,
            tipo: 'Evento',
            venceEn: details.startsAt,
            detallesReunion: {
              ...details,
              status: 'scheduled',
              primeraCita: {
                estado: 'Programada',
                duracion: `${details.durationMinutes ?? 30} minutos`,
                asistentesAdicionales: '',
                resumen: '',
                documentacionAportada: '',
                resultado: '',
                observaciones: '',
                autorizadaPresupuesto: false,
                tipoServicioPreliminar: '',
              },
            },
          }
        : input,
    )
    if (created?.id) setSelected(created.id)
  }

  if (tasks.isPending) {
    return <p className="text-muted-foreground py-8 text-sm">Cargando citas…</p>
  }
  if (tasks.isError) {
    return <p className="text-destructive py-8 text-sm">No se pudieron cargar las citas.</p>
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          {task ? (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Cita</span>
              <select
                className="border-input bg-background h-9 rounded-md border px-2"
                value={task.id}
                onChange={(event) => setSelected(event.target.value)}
              >
                {meetings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.titulo} ·{' '}
                    {item.venceEn ? `${new Date(item.venceEn).toLocaleString('es-ES')} · ` : ''}
                    {ESTADO_ASISTENTE_LABEL[estadoAsistente(item.reunion)]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-muted-foreground text-sm">Todavía no hay citas vinculadas.</p>
          )}
          {canEdit ? (
            <Button
              type="button"
              disabled={createTask.isPending}
              onClick={() => setScheduleOpen(true)}
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              {first ? 'Programar primera cita' : 'Solicitar cita'}
            </Button>
          ) : null}
        </CardContent>
      </Card>
      {scheduleOpen ? (
        <TaskCreateDialog
          firmId={firmId}
          oportunidadId={scope === 'lead' ? parent.id : null}
          expedienteId={scope === 'case' ? parent.id : null}
          members={members}
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          pending={createTask.isPending}
          onCreate={schedule}
          meetingPreset={{
            meetingType: first ? 'Primera cita' : 'Seguimiento',
            subject: parent.titulo,
            contactIds: contactId ? [contactId] : [],
          }}
          successMessage={first ? 'Solicitud de primera cita creada.' : 'Solicitud de cita creada.'}
        />
      ) : null}
      <div
        className={
          showContactHistory && task
            ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'
            : undefined
        }
      >
        {task ? (
          <div key={task.id} className="min-w-0 space-y-4">
            {state !== 'en_curso' ? (
              <FirstMeetingData firmId={firmId} task={task} members={members} canEdit={canManage} />
            ) : null}
            {state === 'pendiente' ? (
              <Link
                className={buttonVariants({ variant: 'outline' })}
                to="/tareas/$taskId"
                params={{ taskId: task.id }}
              >
                Abrir encargo de agenda
              </Link>
            ) : null}
            {canHold &&
            (state === 'en_curso' || state === 'programada' || state === 'no_asistencia') &&
            !['Completada', 'Cancelada'].includes(task.estado) ? (
              <FirstMeetingAssistant
                firmId={firmId}
                task={task}
                reference={parent.referencia}
                contactName={contactName}
                currentUserId={currentUserId}
                canEdit
                compact
                onStarted={() => setSelected(task.id)}
              />
            ) : null}
            <FirstMeetingWorkspace
              firmId={firmId}
              task={task}
              contactId={contactId}
              canEdit={canManage}
              canTakeNotes={canHold}
              canFollowUp={canEdit && task.reunion['followUpAssigneeId'] === currentUserId}
            />
          </div>
        ) : null}
        {showContactHistory ? (
          <ContactAppointmentHistory
            firmId={firmId}
            contactId={contactId}
            contactName={contactName}
            lead={{ id: parent.id, reference: parent.referencia }}
            tasks={tasks.data ?? []}
            selectedId={task?.id}
          />
        ) : null}
      </div>
    </div>
  )
}
