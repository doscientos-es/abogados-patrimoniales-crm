import { CalendarClock, Mail, Play, Square, UserX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRegistrarComunicacionOportunidad } from '@/features/crm'
import {
  ESTADO_ASISTENTE_LABEL,
  NO_SHOW_EMAIL_TEMPLATE,
  comenzar,
  estadoAsistente,
  marcarNoAsistencia,
  recordatorioNoAsistencia,
  REMINDER_TITLE,
} from '@/features/crm/application/first-meeting-cycle'
import { FirstMeetingClosingDialog } from '@/features/crm/ui/first-meeting-closing-dialog'
import {
  useActualizarReunionTarea,
  useCrearTarea,
  useMarcarSiguienteAccion,
  useTareasPersistentes,
  type TareaPersistida,
} from '@/features/tareas'

const MODE_LABEL: Record<string, string> = {
  office_bilbao: 'Despacho Bilbao',
  office_recalde: 'Despacho Rekalde',
  phone: 'Telefónica',
  outside_office: 'Fuera del despacho',
}

function fmt(iso: unknown, options: Intl.DateTimeFormatOptions) {
  const timestamp = typeof iso === 'string' ? Date.parse(iso) : Number.NaN
  return Number.isNaN(timestamp) ? '—' : new Date(timestamp).toLocaleString('es-ES', options)
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message)
  return 'No se pudo actualizar la Primera cita.'
}

/** Ciclo persistente Agendada → En curso → Finalizada / No ha acudido. */
export function FirstMeetingAssistant({
  firmId,
  task,
  reference,
  contactName,
  canEdit,
}: {
  firmId: string
  task: TareaPersistida
  reference: string
  contactName: string
  canEdit: boolean
}) {
  const updateMeeting = useActualizarReunionTarea(firmId)
  const createTask = useCrearTarea(firmId)
  const markNextAction = useMarcarSiguienteAccion(firmId)
  const tasks = useTareasPersistentes(firmId)
  const [emailOpen, setEmailOpen] = useState(false)
  const [closingOpen, setClosingOpen] = useState(false)
  const reunion = task.reunion
  const estado = estadoAsistente(reunion)
  const firstMeeting = asRecord(reunion['primeraCita'])
  const activeReminder = (tasks.data ?? []).find(
    (item) =>
      item.oportunidadId === task.oportunidadId &&
      item.titulo === REMINDER_TITLE &&
      !['Completada', 'Cancelada'].includes(item.estado),
  )
  const busy = updateMeeting.isPending || createTask.isPending || markNextAction.isPending
  const lawyer =
    typeof reunion['abogadoPrimeraCita'] === 'string' ? reunion['abogadoPrimeraCita'] : '—'

  const start = async () => {
    try {
      await updateMeeting.mutateAsync({
        task,
        details: comenzar(reunion, new Date().toISOString()),
      })
      toast.success('Primera cita en curso.')
    } catch (error) {
      toast.error(errorMessage(error), { duration: 10000 })
    }
  }

  const ensureReminder = async () => {
    if (!task.oportunidadId) return false
    try {
      const reminder =
        activeReminder ?? (await createTask.mutateAsync(recordatorioNoAsistencia(task, new Date())))
      if (!reminder.esSiguienteAccion)
        await markNextAction.mutateAsync({ task: reminder, enabled: true })
      return true
    } catch {
      return false
    }
  }

  const noShow = async () => {
    try {
      await updateMeeting.mutateAsync({
        task,
        details: marcarNoAsistencia(reunion, new Date().toISOString()),
      })
      if (!(await ensureReminder())) {
        toast.error('La falta de asistencia quedó guardada; no se pudo preparar el recordatorio.')
        return
      }
      toast.success('No asistencia registrada. Recordatorio creado a 15 días.')
    } catch (error) {
      toast.error(errorMessage(error), { duration: 10000 })
    }
  }

  return (
    <section
      aria-label="Asistente de Primera cita"
      className={`rounded-lg border-2 p-4 ${estado === 'en_curso' ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarClock className="text-primary size-5" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-wide uppercase">Asistente de Primera cita</h2>
            <Badge variant={estado === 'en_curso' ? 'default' : 'secondary'}>
              {ESTADO_ASISTENTE_LABEL[estado]}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {fmt(reunion['startsAt'], { dateStyle: 'full' })} ·{' '}
            {fmt(reunion['startsAt'], { hour: '2-digit', minute: '2-digit' })} · Abogado: {lawyer} ·{' '}
            {MODE_LABEL[String(reunion['mode'])] ?? '—'}
          </p>
          {firstMeeting['horaInicioReal'] ? (
            <p className="text-muted-foreground text-xs">
              Inicio real:{' '}
              {fmt(firstMeeting['horaInicioReal'], { hour: '2-digit', minute: '2-digit' })}
              {firstMeeting['horaFinReal']
                ? ` · Fin real: ${fmt(firstMeeting['horaFinReal'], { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
          ) : null}
          {estado === 'en_curso' ? (
            <p className="text-sm">Recorre las pestañas del Lead durante la cita.</p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {estado === 'programada' ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void noShow()}
                >
                  <UserX className="size-4" aria-hidden="true" /> No ha acudido
                </Button>
                <Button type="button" size="lg" disabled={busy} onClick={() => void start()}>
                  <Play className="size-5" aria-hidden="true" /> Comenzar primera cita
                </Button>
              </>
            ) : null}
            {estado === 'en_curso' ? (
              <Button type="button" size="lg" disabled={busy} onClick={() => setClosingOpen(true)}>
                <Square className="size-5" aria-hidden="true" /> Terminar primera cita
              </Button>
            ) : null}
            {estado === 'no_asistencia' ? (
              <>
                {!activeReminder || !activeReminder.esSiguienteAccion ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void ensureReminder().then((saved) => {
                        if (saved)
                          toast.success('Recordatorio del Lead creado o actualizado a 15 días.')
                        else toast.error('No se pudo crear o actualizar el recordatorio.')
                      })
                    }
                  >
                    Crear recordatorio a 15 días
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setEmailOpen(true)}>
                  <Mail className="size-4" aria-hidden="true" /> Guardar borrador de email
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {closingOpen ? (
        <FirstMeetingClosingDialog
          firmId={firmId}
          task={task}
          reference={reference}
          onClose={() => setClosingOpen(false)}
        />
      ) : null}
      {emailOpen ? (
        <NoShowEmailDialog
          firmId={firmId}
          opportunityId={task.oportunidadId ?? ''}
          reference={reference}
          contactName={contactName}
          date={fmt(reunion['startsAt'], { dateStyle: 'long', timeStyle: 'short' })}
          onClose={() => setEmailOpen(false)}
        />
      ) : null}
    </section>
  )
}

function NoShowEmailDialog({
  firmId,
  opportunityId,
  reference,
  contactName,
  date,
  onClose,
}: {
  firmId: string
  opportunityId: string
  reference: string
  contactName: string
  date: string
  onClose: () => void
}) {
  const logCommunication = useRegistrarComunicacionOportunidad(firmId)
  const [subject, setSubject] = useState(NO_SHOW_EMAIL_TEMPLATE.asunto)
  const [body, setBody] = useState(NO_SHOW_EMAIL_TEMPLATE.cuerpo(contactName, date))

  const saveDraft = async () => {
    try {
      await logCommunication.mutateAsync({
        opportunityId,
        tipo: 'email_draft',
        resumen: `[${NO_SHOW_EMAIL_TEMPLATE.nombre}] ${subject}\n\n${body}`.slice(0, 2000),
      })
      toast.success('Borrador guardado en Comunicaciones del Lead. No se ha enviado.')
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Email de no asistencia</DialogTitle>
          <DialogDescription>
            Plantilla «{NO_SHOW_EMAIL_TEMPLATE.nombre}» · {reference}
          </DialogDescription>
        </DialogHeader>
        <p className="border-warning/40 bg-warning/10 rounded-md border px-3 py-2 text-sm">
          El envío real de emails no está conectado. Se guardará un borrador en Comunicaciones; no
          se enviará.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="noshow-subject">Asunto</Label>
          <Input
            id="noshow-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="noshow-body">Mensaje</Label>
          <Textarea
            id="noshow-body"
            rows={9}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={logCommunication.isPending}
            onClick={() => void saveDraft()}
          >
            Guardar borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
