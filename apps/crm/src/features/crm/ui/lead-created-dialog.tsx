import { CalendarPlus, Clock, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'

import { TaskCreateDialog } from '@/components/tareas/task-create-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMiembrosDespacho } from '@/features/crm'
import type { ViabilidadInicial } from '@/features/crm/application/initial-viability'
import {
  useCrearTarea,
  useMarcarSiguienteAccion,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'

type Step = 'summary' | 'meeting' | 'task'

/** Tras crear un Lead ofrece la siguiente acción que corresponde a su viabilidad. */
export function LeadCreatedDialog({
  firmId,
  opportunityId,
  reference,
  contactId,
  contactName,
  viability,
  closeSucceeded = true,
  closeError,
  onFinish,
}: {
  firmId: string
  opportunityId: string
  reference: string
  contactId: string
  contactName: string
  viability: ViabilidadInicial
  closeSucceeded?: boolean | undefined
  closeError?: string | undefined
  onFinish: () => void
}) {
  const [step, setStep] = useState<Step>(viability === 'pendiente' ? 'task' : 'summary')
  const [markFailed, setMarkFailed] = useState(false)
  const retryStep = useRef<Exclude<Step, 'summary'>>('task')
  const createdTask = useRef<TareaPersistida | null>(null)
  const nextActionMarked = useRef(false)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const markNextAction = useMarcarSiguienteAccion(firmId)
  const pending = createTask.isPending || markNextAction.isPending

  const createAsNextAction = async (input: CrearTareaInput) => {
    retryStep.current = step === 'meeting' ? 'meeting' : 'task'
    let task = createdTask.current
    if (!task) {
      const details = input.detallesReunion
      const isFirstMeeting =
        details?.specialType === 'meeting' && details.meetingType === 'Primera cita'
      const taskInput: CrearTareaInput = {
        ...input,
        expedienteId: null,
        oportunidadId: opportunityId,
        ...(isFirstMeeting && details
          ? {
            tipo: 'Evento',
            venceEn: details.startsAt || input.venceEn,
            detallesReunion: {
              ...details,
              primeraCita: {
                estado: 'Programada',
                duracion: `${details.durationMinutes ?? 60} minutos`,
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
          : {}),
      }
      task = await createTask.mutateAsync(taskInput)
      createdTask.current = task
    }

    try {
      await markNextAction.mutateAsync({ task, enabled: true })
      nextActionMarked.current = true
      setMarkFailed(false)
      return task
    } catch (error) {
      setMarkFailed(true)
      throw error
    }
  }

  const closeChild = (open: boolean) => {
    if (open) return
    if (nextActionMarked.current) onFinish()
    else setStep('summary')
  }

  return (
    <>
      <Dialog open={step === 'summary'} onOpenChange={(open) => !open && onFinish()}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Lead creado correctamente</DialogTitle>
            <DialogDescription>
              <span className="text-foreground font-mono font-semibold">{reference}</span>
              {contactName ? <> · {contactName}</> : null}
            </DialogDescription>
          </DialogHeader>
          {viability === 'pendiente' ? (
            <div className="border-warning/40 bg-warning/10 space-y-1 rounded-md border px-5 py-4">
              <p className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
                <Clock className="size-4" aria-hidden="true" /> Pendiente de revisión
              </p>
              <p className="text-muted-foreground text-sm">
                La viabilidad debe revisarse antes de concertar una Primera Cita.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={() => setStep('task')}
              >
                Crear tarea Revisar viabilidad
              </Button>
            </div>
          ) : viability === 'no_apto' ? (
            <div className="border-destructive/40 bg-destructive/5 space-y-1 rounded-md border px-5 py-4">
              <p className="text-destructive flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
                <XCircle className="size-4" aria-hidden="true" /> No apto / no atendible
              </p>
              <p className="text-muted-foreground text-sm">
                {closeSucceeded
                  ? 'El Lead quedó cerrado con el motivo indicado. No se concertará Primera Cita.'
                  : `El Lead se creó, pero no se pudo cerrar${closeError ? `: ${closeError}` : '.'}`}
              </p>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-14 w-full text-base font-semibold tracking-wide uppercase"
              onClick={() => setStep('meeting')}
            >
              <CalendarPlus className="size-5" aria-hidden="true" /> Concertar primera cita
            </Button>
          )}
          {markFailed ? (
            <div className="border-warning/40 bg-warning/10 rounded-md border px-4 py-3 text-sm">
              La tarea ya está creada, pero no se pudo marcar como siguiente acción. Reintenta para
              vincularla sin duplicarla.
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={() => setStep(retryStep.current)}
              >
                Reintentar vinculación
              </Button>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {viability === 'apto' && !markFailed ? (
              <>
                <Button type="button" variant="ghost" onClick={onFinish}>
                  Hacerlo más tarde
                </Button>
                <Button type="button" variant="outline" onClick={() => setStep('task')}>
                  Definir otra siguiente acción
                </Button>
              </>
            ) : (
              <Button type="button" onClick={onFinish}>
                Ir a la ficha del Lead
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {step === 'meeting' && viability === 'apto' ? (
        <TaskCreateDialog
          firmId={firmId}
          oportunidadId={opportunityId}
          contextLabel={reference}
          members={members.data ?? []}
          open
          onOpenChange={closeChild}
          meetingPreset={{
            meetingType: 'Primera cita',
            subject: 'PRIMERA CITA',
            contactIds: contactId ? [contactId] : [],
            contactLabel: contactName,
          }}
          pending={pending}
          successMessage="Primera cita creada como siguiente acción del Lead."
          onCreate={createAsNextAction}
        />
      ) : null}
      {step === 'task' ? (
        <TaskCreateDialog
          firmId={firmId}
          oportunidadId={opportunityId}
          contextLabel={reference}
          members={members.data ?? []}
          open
          onOpenChange={closeChild}
          {...(viability === 'pendiente' ? { defaultTitle: 'REVISAR VIABILIDAD' } : {})}
          pending={pending}
          successMessage="Siguiente acción definida y vinculada al Lead."
          onCreate={createAsNextAction}
        />
      ) : null}
    </>
  )
}