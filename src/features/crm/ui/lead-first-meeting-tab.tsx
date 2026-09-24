import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { OportunidadPersistida } from '@/features/crm'
import {
  useActualizarReunionTarea,
  useCompletarTarea,
  useCrearTarea,
  useEditarTarea,
  useTareasPersistentes,
  type DetallesPrimeraCita,
  type DetallesReunion,
  type EstadoPrimeraCita,
  type TareaPersistida,
} from '@/features/tareas'

const FIRST_MEETING_RESULTS = [
  'Solicitar presupuesto',
  'Solicitar documentación',
  'Requiere análisis adicional',
  'Nueva cita',
  'Seguimiento futuro',
  'No interesado',
  'Descartado por el despacho',
] as const

const appointmentStatus = (task: TareaPersistida): EstadoPrimeraCita => {
  const details = asRecord(task.reunion['primeraCita'])
  const status = details['estado']
  return isAppointmentStatus(status) ? status : 'Programada'
}

export function isFirstMeetingTask(task: TareaPersistida) {
  return (
    task.tipo === 'Evento' &&
    task.oportunidadId !== null &&
    asRecord(task.reunion['primeraCita'])['estado'] !== undefined
  )
}

export function LeadFirstMeetingTab({
  opportunity,
  firmId,
  members,
  contactId,
  contactName,
  currentUserId,
  memberRole,
  canEdit,
}: {
  opportunity: OportunidadPersistida
  firmId: string
  members: Array<{ id: string; nombre: string }>
  contactId: string
  contactName: string
  currentUserId: string
  memberRole: string
  canEdit: boolean
}) {
  const tasks = useTareasPersistentes(firmId)
  const createTask = useCrearTarea(firmId)
  const editTask = useEditarTarea(firmId)
  const updateMeeting = useActualizarReunionTarea(firmId)
  const completeTask = useCompletarTarea(firmId)
  const appointments = (tasks.data ?? [])
    .filter((task) => task.oportunidadId === opportunity.id && isFirstMeetingTask(task))
    .sort((first, second) => taskDateValue(first.venceEn) - taskDateValue(second.venceEn))
  const activeAppointment = appointments.find(
    (task) => !['Completada', 'Cancelada'].includes(task.estado),
  )
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const selectedTask =
    appointments.find((task) => task.id === selectedTaskId) ??
    activeAppointment ??
    appointments[0] ??
    null
  const canManage = Boolean(
    canEdit &&
      (!selectedTask ||
        selectedTask.creadaPorId === currentUserId ||
        ['owner', 'admin', 'lawyer'].includes(memberRole)),
  )
  const pending =
    createTask.isPending || editTask.isPending || updateMeeting.isPending || completeTask.isPending

  const saveAppointment = async (values: AppointmentFormValues, status: EstadoPrimeraCita) => {
    const meetingDetails: DetallesReunion = {
      ...(selectedTask?.reunion as Partial<DetallesReunion> | undefined),
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      mode: values.mode,
      location: values.location,
      meetingUrl: values.meetingUrl,
      preparation: values.preparation,
      attendeeContactIds: values.attendeeContactIds,
      attendeeUserIds: values.attendeeUserIds,
      primeraCita: {
        estado: status,
        duracion: values.duration,
        asistentesAdicionales: values.additionalAttendees,
        resumen: values.summary,
        documentacionAportada: values.documents,
        resultado: values.result,
        observaciones: values.observations,
        autorizadaPresupuesto: values.budgetAuthorized,
        tipoServicioPreliminar: values.preliminaryService,
      },
    }

    try {
      if (!selectedTask) {
        const created = await createTask.mutateAsync({
          expedienteId: null,
          oportunidadId: opportunity.id,
          tipo: 'Evento',
          titulo: `Primera cita · ${opportunity.titulo}`,
          descripcion: `Primera cita vinculada a ${opportunity.referencia}.`,
          prioridad: 'Media',
          venceEn: meetingDetails.startsAt,
          recordarEn: null,
          clasePlazo: null,
          critico: false,
          asignadoId: values.assigneeId || null,
          detallesReunion: meetingDetails,
        })
        setSelectedTaskId(created.id)
        toast.success('Primera cita programada y añadida al Calendario de Nuestro.')
        return
      }

      let taskForMeetingUpdate = selectedTask
      const startChanged =
        !selectedTask.venceEn ||
        Date.parse(selectedTask.venceEn) !== Date.parse(meetingDetails.startsAt)
      const assigneeId = values.assigneeId || null
      if (startChanged || selectedTask.asignadoId !== assigneeId) {
        taskForMeetingUpdate = await editTask.mutateAsync({
          task: selectedTask,
          titulo: selectedTask.titulo,
          descripcion: selectedTask.descripcion,
          estado: selectedTask.estado,
          prioridad: selectedTask.prioridad,
          venceEn: meetingDetails.startsAt,
          recordarEn: selectedTask.recordarEn,
          asignadoId: assigneeId,
        })
      }

      const saved = await updateMeeting.mutateAsync({
        task: taskForMeetingUpdate,
        details: meetingDetails,
      })
      if (status === 'Celebrada' && saved.estado !== 'Completada') {
        const completionResult =
          [values.result, values.summary, values.observations].filter(Boolean).join(' · ') ||
          'Primera cita celebrada.'
        try {
          await completeTask.mutateAsync({ task: saved, resultado: completionResult })
        } catch (error) {
          toast.error(
            `El resultado quedó guardado, pero el evento no se pudo cerrar: ${errorMessage(error)}`,
          )
          return
        }
      }
      setSelectedTaskId(saved.id)
      toast.success(status === 'Celebrada' ? 'Resultado de la primera cita registrado.' : 'Primera cita actualizada.')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  if (tasks.isPending) {
    return <p className="text-muted-foreground py-8 text-sm">Cargando citas vinculadas…</p>
  }
  if (tasks.isError) {
    return <p className="text-destructive py-8 text-sm">No se pudieron cargar las citas.</p>
  }

  return (
    <div className="space-y-4">
      {appointments.length > 1 ? (
        <nav aria-label="Citas del Lead" className="flex flex-wrap gap-2">
          {appointments.map((appointment, index) => (
            <Button
              key={appointment.id}
              type="button"
              size="sm"
              variant={selectedTask?.id === appointment.id ? 'secondary' : 'outline'}
              onClick={() => setSelectedTaskId(appointment.id)}
            >
              Cita {index + 1} · {appointmentStatus(appointment)}
            </Button>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Primera cita</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Programa la reunión y conserva su preparación y resultado en el historial del Lead.
            </p>
          </div>
          <Badge variant={selectedTask ? 'secondary' : 'outline'}>
            {selectedTask ? appointmentStatus(selectedTask) : 'Sin programar'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          {!canManage ? (
            <p className="text-muted-foreground text-sm">
              Solo quien creó el evento o un abogado/administrador puede editar sus datos.
            </p>
          ) : null}
          <AppointmentForm
            key={`${selectedTask?.id ?? 'new'}-${selectedTask?.version ?? 0}`}
            task={selectedTask}
            defaultAssigneeId={opportunity.asignadoId}
            members={members}
            contactId={contactId}
            contactName={contactName}
            canManage={canManage}
            pending={pending}
            onSave={saveAppointment}
          />
          <p className="text-muted-foreground border-t pt-4 text-xs">
            Las tareas posteriores se gestionan en la pestaña Tareas. La descripción de documentos
            no sustituye su carga en Archivos personales y no se sincroniza con Google Calendar.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

type AppointmentFormValues = {
  startsAt: string
  endsAt: string
  mode: DetallesReunion['mode']
  location: string
  meetingUrl: string
  preparation: string
  attendeeContactIds: string[]
  attendeeUserIds: string[]
  assigneeId: string
  duration: string
  additionalAttendees: string
  summary: string
  documents: string
  result: string
  observations: string
  budgetAuthorized: boolean
  preliminaryService: string
}

function AppointmentForm({
  task,
  defaultAssigneeId,
  members,
  contactId,
  contactName,
  canManage,
  pending,
  onSave,
}: {
  task: TareaPersistida | null
  defaultAssigneeId: string | null
  members: Array<{ id: string; nombre: string }>
  contactId: string
  contactName: string
  canManage: boolean
  pending: boolean
  onSave: (values: AppointmentFormValues, status: EstadoPrimeraCita) => Promise<void>
}) {
  const details = task?.reunion ?? {}
  const appointment = task ? appointmentData(task) : emptyAppointment()
  const savedContacts = stringArray(details['attendeeContactIds'])
  const savedMembers = stringArray(details['attendeeUserIds'])
  const startsAt = stringValue(details['startsAt']) || task?.venceEn || ''
  const endsAt = stringValue(details['endsAt'])
  const mode = meetingMode(details['mode'])
  const isClosed = task?.estado === 'Cancelada'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const startLocal = field(data, 'startsAt')
    const endLocal = field(data, 'endsAt')
    const start = new Date(startLocal)
    const end = new Date(endLocal)
    if (!startLocal || !endLocal || !Number.isFinite(start.getTime()) || end <= start) {
      toast.error('Indica una hora de fin posterior al inicio.')
      return
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const requestedStatus = submitter?.value
    const status = requestedStatus && isAppointmentStatus(requestedStatus)
      ? requestedStatus
      : task
        ? appointment.estado
        : 'Programada'
    void onSave(
      {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        mode: field(data, 'mode') as DetallesReunion['mode'],
        location: field(data, 'location'),
        meetingUrl: field(data, 'meetingUrl'),
        preparation: field(data, 'preparation'),
        attendeeContactIds: selectedValues(data, 'attendeeContactIds'),
        attendeeUserIds: selectedValues(data, 'attendeeUserIds'),
        assigneeId: field(data, 'assignee'),
        duration: field(data, 'duration'),
        additionalAttendees: field(data, 'additionalAttendees'),
        summary: field(data, 'summary'),
        documents: field(data, 'documents'),
        result: field(data, 'result'),
        observations: field(data, 'observations'),
        budgetAuthorized: data.get('budgetAuthorized') === 'on',
        preliminaryService: field(data, 'preliminaryService'),
      },
      status,
    )
  }

  const disabled = !canManage || pending || isClosed
  const fieldPrefix = task?.id ?? 'new'
  return (
    <form className="space-y-5" onSubmit={(event) => submit(event)}>
      <fieldset disabled={disabled} className="space-y-4">
        <legend className="sr-only">Programación de la primera cita</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id={`${fieldPrefix}-startsAt`} label="Inicio">
            <Input
              id={`${fieldPrefix}-startsAt`}
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={toLocalInput(startsAt)}
            />
          </FormField>
          <FormField id={`${fieldPrefix}-endsAt`} label="Fin">
            <Input
              id={`${fieldPrefix}-endsAt`}
              name="endsAt"
              type="datetime-local"
              required
              defaultValue={toLocalInput(endsAt)}
            />
          </FormField>
          <FormField id={`${fieldPrefix}-duration`} label="Duración prevista">
            <Input
              id={`${fieldPrefix}-duration`}
              name="duration"
              defaultValue={appointment.duracion || '60 minutos'}
              maxLength={80}
            />
          </FormField>
          <FormField id={`${fieldPrefix}-mode`} label="Modalidad">
            <select
              id={`${fieldPrefix}-mode`}
              name="mode"
              defaultValue={mode}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="office_bilbao">Presencial · Bilbao</option>
              <option value="office_recalde">Presencial · Rekalde</option>
              <option value="phone">Telefónica</option>
              <option value="outside_office">Videollamada / otro lugar</option>
            </select>
          </FormField>
          <FormField id={`${fieldPrefix}-location`} label="Lugar o detalle de modalidad">
            <Input
              id={`${fieldPrefix}-location`}
              name="location"
              defaultValue={stringValue(details['location'])}
              maxLength={500}
            />
          </FormField>
          <FormField id={`${fieldPrefix}-meetingUrl`} label="Enlace de reunión">
            <Input
              id={`${fieldPrefix}-meetingUrl`}
              name="meetingUrl"
              type="url"
              defaultValue={stringValue(details['meetingUrl'])}
              placeholder="https://…"
            />
          </FormField>
          <FormField id={`${fieldPrefix}-assignee`} label="Responsable">
            <select
              id={`${fieldPrefix}-assignee`}
              name="assignee"
              defaultValue={task?.asignadoId ?? defaultAssigneeId ?? ''}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Sin asignar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id={`${fieldPrefix}-attendeeContacts`} label="Contacto asistente">
            <select
              id={`${fieldPrefix}-attendeeContacts`}
              name="attendeeContactIds"
              multiple
              size={Math.min(3, Math.max(1, Number(Boolean(contactId))))}
              defaultValue={savedContacts.length ? savedContacts : contactId ? [contactId] : []}
              className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
            >
              {contactId ? <option value={contactId}>{contactName}</option> : null}
            </select>
          </FormField>
          <FormField id={`${fieldPrefix}-attendeeUsers`} label="Equipo asistente">
            <select
              id={`${fieldPrefix}-attendeeUsers`}
              name="attendeeUserIds"
              multiple
              size={Math.min(4, Math.max(2, members.length))}
              defaultValue={savedMembers}
              className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id={`${fieldPrefix}-additionalAttendees`} label="Otros asistentes">
          <Input
            id={`${fieldPrefix}-additionalAttendees`}
            name="additionalAttendees"
            defaultValue={appointment.asistentesAdicionales}
            placeholder="Nombres de otras personas asistentes"
            maxLength={1000}
          />
        </FormField>
        <FormField id={`${fieldPrefix}-preparation`} label="Notas previas y preparación">
          <Textarea
            id={`${fieldPrefix}-preparation`}
            name="preparation"
            rows={3}
            defaultValue={stringValue(details['preparation'])}
            maxLength={5000}
          />
        </FormField>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium">Resultado y siguientes pasos</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Registrar el resultado como celebrada completa el evento. Los pasos posteriores se
            crean como tareas ordinarias.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={`${fieldPrefix}-summary`} label="Resumen de la cita">
            <Textarea
              id={`${fieldPrefix}-summary`}
              name="summary"
              rows={3}
              defaultValue={appointment.resumen}
              maxLength={10000}
            />
          </FormField>
          <FormField id={`${fieldPrefix}-documents`} label="Documentación aportada (descripción)">
            <Textarea
              id={`${fieldPrefix}-documents`}
              name="documents"
              rows={3}
              defaultValue={appointment.documentacionAportada}
              maxLength={5000}
            />
          </FormField>
          <FormField id={`${fieldPrefix}-result`} label="Resultado">
            <select
              id={`${fieldPrefix}-result`}
              name="result"
              defaultValue={appointment.resultado}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Selecciona un resultado</option>
              {FIRST_MEETING_RESULTS.map((result) => (
                <option key={result} value={result}>
                  {result}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id={`${fieldPrefix}-preliminaryService`} label="Servicio preliminar">
            <Input
              id={`${fieldPrefix}-preliminaryService`}
              name="preliminaryService"
              defaultValue={appointment.tipoServicioPreliminar}
              maxLength={500}
            />
          </FormField>
        </div>
        <FormField id={`${fieldPrefix}-observations`} label="Observaciones">
          <Textarea
            id={`${fieldPrefix}-observations`}
            name="observations"
            rows={3}
            defaultValue={appointment.observaciones}
            maxLength={5000}
          />
        </FormField>
        <label className="flex items-start gap-2 text-sm">
          <input
            name="budgetAuthorized"
            type="checkbox"
            defaultChecked={appointment.autorizadaPresupuesto}
            className="mt-1"
          />
          <span>
            Existe autorización para solicitar presupuesto
            <span className="text-muted-foreground mt-0.5 block text-xs">
              Registro informativo; no crea un presupuesto ni autoriza su emisión.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="appointmentStatus" value={task ? appointment.estado : 'Programada'} disabled={disabled}>
          {pending ? 'Guardando…' : task ? 'Guardar cambios' : 'Guardar programación'}
        </Button>
        {task && task.estado !== 'Completada' ? (
          <>
            <Button type="submit" name="appointmentStatus" value="Celebrada" disabled={disabled}>
              Registrar resultado
            </Button>
            <Button type="submit" name="appointmentStatus" value="No comparece" variant="outline" disabled={disabled}>
              No comparece
            </Button>
            <Button
              type="submit"
              name="appointmentStatus"
              value="Reprogramación pendiente"
              variant="outline"
              disabled={disabled}
            >
              Reprogramar
            </Button>
          </>
        ) : null}
      </div>
      {task?.estado === 'Cancelada' ? (
        <p className="text-muted-foreground text-xs">Este evento fue cancelado y ya no se puede editar.</p>
      ) : null}
    </form>
  )
}

function FormField({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function appointmentData(task: TareaPersistida): DetallesPrimeraCita {
  const details = asRecord(task.reunion['primeraCita'])
  const status = details['estado']
  return {
    estado: isAppointmentStatus(status) ? status : 'Programada',
    duracion: stringValue(details['duracion']) || '60 minutos',
    asistentesAdicionales: stringValue(details['asistentesAdicionales']),
    resumen: stringValue(details['resumen']),
    documentacionAportada: stringValue(details['documentacionAportada']),
    resultado: stringValue(details['resultado']),
    observaciones: stringValue(details['observaciones']),
    autorizadaPresupuesto: details['autorizadaPresupuesto'] === true,
    tipoServicioPreliminar: stringValue(details['tipoServicioPreliminar']),
  }
}

function emptyAppointment(): DetallesPrimeraCita {
  return {
    estado: 'Programada',
    duracion: '60 minutos',
    asistentesAdicionales: '',
    resumen: '',
    documentacionAportada: '',
    resultado: '',
    observaciones: '',
    autorizadaPresupuesto: false,
    tipoServicioPreliminar: '',
  }
}

function isAppointmentStatus(value: unknown): value is EstadoPrimeraCita {
  return (
    value === 'Programada' ||
    value === 'Celebrada' ||
    value === 'No comparece' ||
    value === 'Reprogramación pendiente'
  )
}

function meetingMode(value: unknown): DetallesReunion['mode'] {
  return value === 'office_recalde' || value === 'phone' || value === 'outside_office'
    ? value
    : 'office_bilbao'
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function field(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function selectedValues(data: FormData, name: string) {
  return data.getAll(name).filter((value): value is string => typeof value === 'string')
}

function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function taskDateValue(value: string | null) {
  const timestamp = value ? Date.parse(value) : Number.POSITIVE_INFINITY
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo guardar la primera cita.'
}