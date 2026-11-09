import { CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { OportunidadPersistida } from '@/features/crm'
import { isFirstMeeting, pickFirstMeeting } from '@/features/crm/application/first-meeting-cycle'
import { FirstMeetingData } from '@/features/crm/ui/first-meeting-data'
import { FirstMeetingWorkspace } from '@/features/crm/ui/first-meeting-workspace'
import {
  useCrearTarea,
  useTareasPersistentes,
  type DetallesReunion,
  type TareaPersistida,
} from '@/features/tareas'

export function isFirstMeetingTask(task: TareaPersistida) {
  return task.tipo === 'Evento' && isFirstMeeting(task)
}

/** Default draft: tomorrow at 10:00 for one hour; editable from «Datos de la cita». */
function defaultMeetingDetails(opportunity: OportunidadPersistida, contactId: string) {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(10, 0, 0, 0)
  const details: DetallesReunion = {
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 60 * 60_000).toISOString(),
    mode: 'office_bilbao',
    location: '',
    meetingUrl: '',
    preparation: '',
    specialType: 'meeting',
    status: 'scheduled',
    meetingType: 'Primera cita',
    subject: opportunity.titulo,
    durationMinutes: 60,
    attendeeContactIds: contactId ? [contactId] : [],
    attendeeUserIds: [],
    primeraCita: {
      estado: 'Programada',
      duracion: '60 minutos',
      asistentesAdicionales: '',
      resumen: '',
      documentacionAportada: '',
      resultado: '',
      observaciones: '',
      autorizadaPresupuesto: false,
      tipoServicioPreliminar: '',
    },
  }
  return details
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
  const task = pickFirstMeeting((tasks.data ?? []).filter(isFirstMeetingTask), opportunity.id)
  const canManage = Boolean(
    canEdit &&
    (!task ||
      task.creadaPorId === currentUserId ||
      task.asignadoId === currentUserId ||
      ['owner', 'admin', 'lawyer'].includes(memberRole)),
  )

  const schedule = async () => {
    const details = defaultMeetingDetails(opportunity, contactId)
    try {
      await createTask.mutateAsync({
        expedienteId: null,
        oportunidadId: opportunity.id,
        tipo: 'Evento',
        titulo: `Primera cita · ${opportunity.titulo}`,
        descripcion: `Primera cita vinculada a ${opportunity.referencia}.`,
        prioridad: 'Media',
        venceEn: details.startsAt,
        recordarEn: null,
        clasePlazo: null,
        critico: false,
        asignadoId: opportunity.asignadoId ?? null,
        detallesReunion: details,
      })
      toast.success('Primera cita programada. Ajusta fecha y hora en «Datos de la cita».')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo programar la primera cita.')
    }
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
              <Button type="button" disabled={createTask.isPending} onClick={() => void schedule()}>
                <CalendarPlus className="size-4" aria-hidden="true" />
                {createTask.isPending ? 'Programando…' : 'Programar primera cita'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
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
