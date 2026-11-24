import { CheckCircle2, ListPlus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

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
import { Label } from '@/components/ui/label'
import { useMiembrosDespacho } from '@/features/crm'
import { terminar } from '@/features/crm/application/first-meeting-cycle'
import { nextLeadAction } from '@/features/crm/application/lead-next-action'
import { ShortTextList } from '@/features/crm/ui/short-text-list'
import { useActualizarEstadoNota, useGuardarNota, useNotasRemotas } from '@/features/notas'
import {
  useActualizarReunionEspecial,
  useCompletarTarea,
  useCrearTarea,
  useMarcarSiguienteAccion,
  useTareasPersistentes,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'
/** Cierre profesional: notas finales, acciones derivadas y encargo administrativo. */
export function FirstMeetingClosingDialog({
  firmId,
  task,
  reference,
  onClose,
}: {
  firmId: string
  task: TareaPersistida
  reference: string
  onClose: () => void
}) {
  const caseId = task.expedienteId ?? null
  const opportunityId = caseId ? null : task.oportunidadId
  const tasks = useTareasPersistentes(firmId)
  const notes = useNotasRemotas(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const markNextAction = useMarcarSiguienteAccion(firmId)
  const updateMeeting = useActualizarReunionEspecial(firmId)
  const completeTask = useCompletarTarea(firmId)
  const saveNote = useGuardarNota(firmId)
  const updateNoteStatus = useActualizarEstadoNota(firmId)
  const [noteItems, setNoteItems] = useState<string[] | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [followUpAssigneeId, setFollowUpAssigneeId] = useState('')
  const [finishedAt] = useState(() => new Date().toISOString())
  const finishingRef = useRef(false)
  const [createdTasks, setCreatedTasks] = useState<TareaPersistida[]>([])
  const [taskMode, setTaskMode] = useState<'derived' | 'next' | null>(null)
  const [marked, setMarked] = useState<TareaPersistida | null>(null)
  const [finishing, setFinishing] = useState(false)
  const openTasks = (tasks.data ?? []).filter(
    (item) =>
      (caseId
        ? item.expedienteId === caseId
        : !item.expedienteId && item.oportunidadId === opportunityId) &&
      item.id !== task.id &&
      !['Completada', 'Cancelada'].includes(item.estado),
  )
  const linkedDerived = (tasks.data ?? []).filter((item) => item.tareaPadreId === task.id)
  const createdThisSession = [
    ...linkedDerived,
    ...createdTasks.filter((item) => !linkedDerived.some((linked) => linked.id === item.id)),
  ].map((created) => openTasks.find((item) => item.id === created.id) ?? created)
  const currentNext = marked
    ? (openTasks.find((item) => item.id === marked.id) ?? marked)
    : nextLeadAction(openTasks)
  const closeNote = (notes.data ?? []).find((note) => {
    const details = note.details
    return Boolean(
      details &&
      typeof details === 'object' &&
      !Array.isArray(details) &&
      note.status !== 'archived' &&
      details['taskId'] === task.id &&
      (details['cierreCita'] === 'true' || details['cierrePrimeraCita'] === 'true'),
    )
  })
  const details = closeNote?.details
  const noteDetails =
    details && typeof details === 'object' && !Array.isArray(details) ? details : {}
  const savedItems = noteDetails['notasFinales']
  const initialItems = Array.isArray(savedItems)
    ? savedItems.filter((item): item is string => typeof item === 'string')
    : closeNote?.content
      ? [closeNote.content]
      : []
  const finalItems = noteItems ?? initialItems

  const markAsNext = async (target: TareaPersistida) => {
    try {
      const saved = await markNextAction.mutateAsync({ task: target, enabled: true })
      setMarked(saved)
      toast.success('Siguiente acción actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo marcar la siguiente acción.')
    }
  }

  const finish = async () => {
    if (notes.isPending || notes.isError || finishingRef.current || (!caseId && !opportunityId))
      return
    const liveMeeting = (tasks.data ?? []).find((item) => item.id === task.id) ?? task
    const items = noteDraft.trim() ? [...finalItems, noteDraft.trim()] : finalItems
    finishingRef.current = true
    setFinishing(true)
    try {
      if (items.length && (!closeNote || noteItems !== null || noteDraft.trim())) {
        await saveNote.mutateAsync({
          ...(closeNote ? { noteId: closeNote.id } : {}),
          ...(closeNote ? { status: closeNote.status } : {}),
          scope: closeNote?.scope ?? (caseId ? 'case' : 'opportunity'),
          originId: closeNote?.origin_id ?? caseId ?? opportunityId ?? '',
          originLabel: closeNote?.origin_label ?? reference,
          title: closeNote?.title ?? `Notas finales · ${task.titulo}`,
          content: items.join('\n'),
          contactIds:
            closeNote?.contactIds ?? (getMeetingContactId(task) ? [getMeetingContactId(task)] : []),
          highlighted: closeNote?.highlighted ?? false,
          critical: closeNote?.critical ?? false,
          requiresAcknowledgement: closeNote?.requires_acknowledgement ?? false,
          validity: closeNote?.validity ?? 'permanent',
          startsOn: closeNote?.starts_on ?? null,
          reviewOn: closeNote?.review_on ?? null,
          reviewPending: closeNote?.review_pending ?? false,
          expiresOn: closeNote?.expires_on ?? null,
          snoozedUntil: closeNote?.snoozed_until ?? null,
          expiryAction: closeNote?.expiry_action ?? 'confirm',
          triggers: Array.isArray(noteDetails['triggers'])
            ? noteDetails['triggers'].filter((value): value is string => typeof value === 'string')
            : [],
          visibility: closeNote?.visibility ?? 'team',
          permittedUserIds: closeNote?.permittedUserIds ?? [],
          caseId: closeNote?.case_id ?? caseId,
          opportunityId,
          extraDetails: {
            ...noteDetails,
            taskId: task.id,
            ...(closeNote ? {} : { cierreCita: 'true' }),
            notasFinales: items,
          },
        })
      } else if (!items.length && closeNote && noteItems !== null) {
        await updateNoteStatus.mutateAsync({
          noteId: closeNote.id,
          status: 'archived',
          eventType: 'archived',
          eventDetail: 'Notas finales retiradas al cerrar la cita.',
        })
      }
      const finished = await updateMeeting.mutateAsync({
        task: liveMeeting,
        details: {
          ...terminar(liveMeeting.reunion, finishedAt),
          ...(followUpAssigneeId ? { followUpAssigneeId } : {}),
        },
      })
      try {
        if (finished.estado !== 'Completada')
          await completeTask.mutateAsync({ task: finished, resultado: 'Cita celebrada.' })
      } catch {
        toast.error('La cita quedó finalizada, pero no se pudo marcar el evento como completado.')
      }
      toast.success(followUpAssigneeId ? 'Cita finalizada. Encargo enviado.' : 'Cita finalizada.')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo finalizar la cita.')
    } finally {
      finishingRef.current = false
      setFinishing(false)
    }
  }

  return (
    <>
      <Dialog open={taskMode === null} onOpenChange={(open) => !open && !finishing && onClose()}>
        <DialogContent size="lg" className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cierre de cita</DialogTitle>
            <DialogDescription>{reference}</DialogDescription>
          </DialogHeader>

          <Step number={1} title="Notas finales">
            {notes.isPending ? (
              <p className="text-muted-foreground text-sm">Cargando notas…</p>
            ) : null}
            {notes.isError ? (
              <p role="alert" className="text-destructive text-sm">
                No se pudieron cargar las notas. Cierra el diálogo y vuelve a intentarlo.
              </p>
            ) : null}
            {!notes.isPending && !notes.isError ? (
              <ShortTextList
                label="Notas finales"
                items={finalItems}
                draft={noteDraft}
                onDraftChange={setNoteDraft}
                disabled={finishing}
                onAdd={(value) => {
                  setNoteItems([...finalItems, value])
                  return true
                }}
                onRemove={(index) => setNoteItems(finalItems.filter((_, i) => i !== index))}
              />
            ) : null}
            <p className="text-muted-foreground text-xs">
              Se guardan como nota interna vinculada a la cita.
            </p>
          </Step>

          <Step number={2} title="Tareas derivadas">
            {createdThisSession.length ? (
              <ul className="text-sm">
                {createdThisSession.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-0.5"
                  >
                    <span>✓ {item.titulo}</span>
                    {!opportunityId ? null : currentNext?.id === item.id ? (
                      <span className="text-primary text-xs font-semibold uppercase">
                        Siguiente acción
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={markNextAction.isPending}
                        onClick={() => void markAsNext(item)}
                      >
                        Marcar como siguiente acción
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setTaskMode('derived')}
            >
              <ListPlus className="size-4" aria-hidden="true" /> Crear tarea
            </Button>
          </Step>

          {opportunityId ? (
            <Step number={3} title="Siguiente acción">
              {currentNext ? (
                <div
                  aria-label="Siguiente acción actual"
                  className="border-primary/40 bg-primary/5 flex items-start gap-2 rounded-md border px-4 py-3"
                >
                  <CheckCircle2 className="text-primary mt-0.5 size-4" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-semibold">{currentNext.titulo}</p>
                    <p className="text-muted-foreground text-xs">
                      {currentNext.venceEn
                        ? new Date(currentNext.venceEn).toLocaleDateString('es-ES')
                        : 'Sin fecha de vencimiento'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                    Sin siguiente acción. Este Lead todavía no tiene definida ninguna actuación para
                    avanzar.
                  </p>
                  <Button type="button" size="sm" onClick={() => setTaskMode('next')}>
                    <Plus className="size-4" aria-hidden="true" /> Crear siguiente acción
                  </Button>
                </div>
              )}
            </Step>
          ) : null}

          <Step number={opportunityId ? 4 : 3} title="Documentación y transcripción">
            <Label htmlFor="meeting-follow-up">Responsable administrativo</Label>
            <select
              id="meeting-follow-up"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={followUpAssigneeId}
              disabled={finishing || members.isPending || members.isError}
              onChange={(event) => setFollowUpAssigneeId(event.target.value)}
            >
              <option value="">No asignar ahora</option>
              {(members.data ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Si eliges a alguien, recibirá una tarea para subir el material desde la ficha de esta
              cita.
            </p>
          </Step>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={finishing} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={finishing || markNextAction.isPending || notes.isPending || notes.isError}
              onClick={() => void finish()}
            >
              {finishing ? 'Finalizando…' : 'Finalizar cita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {taskMode ? (
        <TaskCreateDialog
          firmId={firmId}
          expedienteId={caseId ?? undefined}
          oportunidadId={opportunityId ?? undefined}
          contextLabel={reference}
          members={members.data ?? []}
          open
          onOpenChange={(open) => !open && setTaskMode(null)}
          pending={createTask.isPending}
          successMessage={
            taskMode === 'next'
              ? 'Siguiente acción creada y vinculada al Lead.'
              : 'Tarea creada y vinculada a la cita.'
          }
          onCreate={async (input: CrearTareaInput) => {
            const created = await createTask.mutateAsync({
              ...input,
              expedienteId: caseId,
              oportunidadId,
              tareaPadreId: task.id,
            })
            setCreatedTasks((current) => [...current, created])
            if (taskMode === 'next') {
              const markedTask = await markNextAction.mutateAsync({ task: created, enabled: true })
              setMarked(markedTask)
            }
            return created
          }}
        />
      ) : null}
    </>
  )
}

function getMeetingContactId(task: TareaPersistida) {
  const ids = task.reunion['attendeeContactIds']
  return Array.isArray(ids) && typeof ids[0] === 'string' ? ids[0] : ''
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2 border-t pt-3">
      <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
        <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs">
          {number}
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}
