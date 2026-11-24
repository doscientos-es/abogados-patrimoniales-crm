import { CalendarPlus } from 'lucide-react'
import { useState } from 'react'

import { TaskCreateDialog } from '@/components/tareas/task-create-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { OportunidadPersistida } from '@/features/crm'
import { isFirstMeeting, pickFirstMeeting } from '@/features/crm/application/first-meeting-cycle'
import { FirstMeetingData } from '@/features/crm/ui/first-meeting-data'
import { FirstMeetingWorkspace } from '@/features/crm/ui/first-meeting-workspace'
import {
  useCrearTarea,
  useTareasPersistentes,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'

export function isFirstMeetingTask(task: TareaPersistida) {
  return task.tipo === 'Evento' && isFirstMeeting(task)
}

/**
 * Minimal tab used during and after the first meeting: appointment summary plus the workspace for
 * the transcript, LEXIA proposal and internal notes. The assistant (start / finish) lives above
 * the tabs on the Lead page.
 */
export function LeadFirstMeetingTab({
  opportunity,
  firmId,
  members,
  contactId,
  currentUserId,
  memberRole,
  canEdit,
}: {
  opportunity: OportunidadPersistida
  firmId: string
  members: Array<{ id: string; nombre: string }>
  contactId: string
  contactName?: string
  currentUserId: string
  memberRole: string
  canEdit: boolean
}) {
  const tasks = useTareasPersistentes(firmId)
  const createTask = useCrearTarea(firmId)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const task = pickFirstMeeting((tasks.data ?? []).filter(isFirstMeetingTask), opportunity.id)
  const canManage = Boolean(
    canEdit &&
    (!task ||
      task.creadaPorId === currentUserId ||
      task.asignadoId === currentUserId ||
      ['owner', 'admin', 'lawyer'].includes(memberRole)),
  )

  const schedule = async (input: CrearTareaInput) => {
    const details = input.detallesReunion
    if (!details) throw new Error('Faltan los datos de la primera cita.')
    await createTask.mutateAsync({
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
    })
  }

  if (tasks.isPending) {
    return <p className="text-muted-foreground py-8 text-sm">Cargando la primera cita…</p>
  }
  if (tasks.isError) {
    return <p className="text-destructive py-8 text-sm">No se pudieron cargar las citas.</p>
  }
  if (!task) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <p className="text-muted-foreground text-sm">
              Este Lead todavía no tiene una Primera cita vinculada.
            </p>
            {canEdit ? (
              <Button
                type="button"
                disabled={createTask.isPending}
                onClick={() => setScheduleOpen(true)}
              >
                <CalendarPlus className="size-4" aria-hidden="true" />
                {createTask.isPending ? 'Programando…' : 'Programar primera cita'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
        {scheduleOpen ? (
          <TaskCreateDialog
            firmId={firmId}
            oportunidadId={opportunity.id}
            members={members}
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            pending={createTask.isPending}
            onCreate={schedule}
            meetingPreset={{
              meetingType: 'Primera cita',
              subject: opportunity.titulo,
              contactIds: contactId ? [contactId] : [],
            }}
            successMessage="Primera cita programada."
          />
        ) : null}
        <FirstMeetingWorkspace firmId={firmId} task={null} canEdit={false} />
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <FirstMeetingData firmId={firmId} task={task} members={members} canEdit={canManage} />
      <FirstMeetingWorkspace firmId={firmId} task={task} canEdit={canManage} />
    </div>
  )
}
