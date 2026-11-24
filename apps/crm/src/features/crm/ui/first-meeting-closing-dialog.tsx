import { useRef, useState } from 'react'
import { toast } from 'sonner'

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
import {
  closingNoteItems,
  closingNoteTaskId,
} from '@/features/crm/application/contact-appointment-history'
import { meetingHosts, terminar } from '@/features/crm/application/first-meeting-cycle'
import { ShortTextList } from '@/features/crm/ui/short-text-list'
import { useActualizarEstadoNota, useGuardarNota, useNotasRemotas } from '@/features/notas'
import {
  useActualizarReunionEspecial,
  useTareasPersistentes,
  type TareaPersistida,
} from '@/features/tareas'
/** Cierre profesional: notas finales, acciones derivadas y encargo administrativo. */
export function FirstMeetingClosingDialog({
  firmId,
  task,
  reference,
  currentUserId,
  onClose,
}: {
  firmId: string
  task: TareaPersistida
  reference: string
  currentUserId?: string | undefined
  onClose: () => void
}) {
  const caseId = task.expedienteId ?? null
  const opportunityId = caseId ? null : task.oportunidadId
  const tasks = useTareasPersistentes(firmId)
  const notes = useNotasRemotas(firmId)
  const members = useMiembrosDespacho(firmId)
  const updateMeeting = useActualizarReunionEspecial(firmId)
  const saveNote = useGuardarNota(firmId)
  const updateNoteStatus = useActualizarEstadoNota(firmId)
  const [noteItems, setNoteItems] = useState<string[] | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [followUpAssigneeId, setFollowUpAssigneeId] = useState(() => {
    const scheduler = task.asignadoId ?? ''
    return scheduler !== currentUserId && !meetingHosts(task.reunion).includes(scheduler)
      ? scheduler
      : ''
  })
  const finishingRef = useRef(false)
  const [derivedTitles, setDerivedTitles] = useState<string[]>([])
  const [derivedDraft, setDerivedDraft] = useState('')
  const [finishing, setFinishing] = useState(false)
  const closeNote = (notes.data ?? []).find((note) => closingNoteTaskId(note) === task.id)
  const details = closeNote?.details
  const noteDetails =
    details && typeof details === 'object' && !Array.isArray(details) ? details : {}
  const finalItems = noteItems ?? closingNoteItems(closeNote)

  const finish = async () => {
    if (notes.isPending || notes.isError || finishingRef.current || (!caseId && !opportunityId))
      return
    const liveMeeting = (tasks.data ?? []).find((item) => item.id === task.id) ?? task
    const items = noteDraft.trim() ? [...finalItems, noteDraft.trim()] : finalItems
    const derivedTaskTitles = [
      ...derivedTitles,
      ...(derivedDraft.trim() ? [derivedDraft.trim()] : []),
    ]
    if (derivedTaskTitles.length > 25 || derivedTaskTitles.some((title) => title.length > 500)) {
      toast.error('Añade como máximo 25 tareas derivadas de hasta 500 caracteres.')
      return
    }
    finishingRef.current = true
    setFinishing(true)
    try {
      const closedMeeting = terminar(liveMeeting.reunion, new Date().toISOString())
      if (items.length && (!closeNote || noteItems !== null || noteDraft.trim())) {
        await saveNote.mutateAsync({
          ...(closeNote ? { noteId: closeNote.id } : {}),
          ...(closeNote ? { status: closeNote.status } : {}),
          scope: caseId ? 'case' : 'opportunity',
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
          ...closedMeeting,
          ...(followUpAssigneeId ? { followUpAssigneeId } : {}),
          derivedTaskTitles,
        },
      })
      toast.success(
        finished.reunion['followUpTaskId']
          ? 'Cita finalizada. Encargo enviado.'
          : 'Cita finalizada.',
      )
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo finalizar la cita.')
    } finally {
      finishingRef.current = false
      setFinishing(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !finishing && onClose()}>
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
          <ShortTextList
            label="Tareas derivadas"
            items={derivedTitles}
            draft={derivedDraft}
            onDraftChange={setDerivedDraft}
            placeholder="Escribe una acción breve…"
            disabled={finishing}
            onAdd={(value) => {
              setDerivedTitles([...derivedTitles, value])
              return true
            }}
            onRemove={(index) => setDerivedTitles(derivedTitles.filter((_, i) => i !== index))}
          />
          <p className="text-muted-foreground text-xs">
            Se crean al cerrar la cita y quedan vinculadas a ella.
          </p>
        </Step>

        <Step number={3} title="Documentación y transcripción">
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
            disabled={finishing || notes.isPending || notes.isError}
            onClick={() => void finish()}
          >
            {finishing ? 'Finalizando…' : 'Finalizar cita'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
