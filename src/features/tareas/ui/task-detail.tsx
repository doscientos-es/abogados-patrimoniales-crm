import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes, useParticipantesPersistentes } from '@/features/expedientes'
import {
  useAbrirTarea,
  useActualizarReunionTarea,
  useActualizarReunionEspecial,
  useAnadirEvidenciaTarea,
  useAnadirMensajeTarea,
  useCambiarEstadoTarea,
  useCancelarTarea,
  useCompletarTarea,
  useCrearDependenciaTarea,
  useDependenciasTarea,
  useDesvincularDocumentoTarea,
  useDocumentosExpedienteTarea,
  useDocumentosTarea,
  useEliminarDependenciaTarea,
  useEventosTarea,
  useEvidenciasTarea,
  useMarcarSiguienteAccion,
  useMensajesTarea,
  usePonerTareaEnEspera,
  useRechazarTarea,
  useTareasPersistentes,
  useVincularDocumentoTarea,
  type DetallesReunion,
  type TareaPersistida,
} from '@/features/tareas'

const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    )
    : 'Sin fecha'

const formText = (data: FormData, name: string) => {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

const detailsText = (details: Record<string, unknown>, name: string) =>
  typeof details[name] === 'string' ? details[name] : ''

const detailsIds = (details: Record<string, unknown>, name: string) =>
  Array.isArray(details[name])
    ? details[name].filter((value): value is string => typeof value === 'string')
    : []

const meetingPreparationItems = (details: Record<string, unknown>) =>
  Array.isArray(details['preparationItems'])
    ? details['preparationItems'].filter(
      (
        item,
      ): item is {
        id: string
        text: string
        done: boolean
        category?: string
        createdById?: string
        createdByName?: string
        createdAt?: string
      } => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false
        const value = item as Record<string, unknown>
        return (
          typeof value['id'] === 'string' &&
          typeof value['text'] === 'string' &&
          typeof value['done'] === 'boolean' &&
          ['category', 'createdById', 'createdByName', 'createdAt'].every(
            (key) => value[key] === undefined || typeof value[key] === 'string',
          )
        )
      },
    )
    : []

const meetingRescheduleHistory = (details: Record<string, unknown>) =>
  Array.isArray(details['rescheduleHistory'])
    ? details['rescheduleHistory'].filter(
      (
        item,
      ): item is {
        requestedAt: string
        reason: string
        previousStartsAt: string
        previousEndsAt: string
      } => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false
        const value = item as Record<string, unknown>
        return (
          typeof value['requestedAt'] === 'string' &&
          typeof value['reason'] === 'string' &&
          typeof value['previousStartsAt'] === 'string' &&
          typeof value['previousEndsAt'] === 'string'
        )
      },
    )
    : []

const formatElapsedTime = (startedAt: string, now: number) => {
  const startedAtMs = Date.parse(startedAt)
  const elapsedSeconds = Number.isNaN(startedAtMs)
    ? 0
    : Math.max(0, Math.floor((now - startedAtMs) / 1000))
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

const toDateTimeLocal = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function TaskDetail({ taskId }: { taskId: string }) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const messages = useMensajesTarea(firmId, taskId)
  const evidences = useEvidenciasTarea(firmId, taskId)
  const events = useEventosTarea(firmId, taskId)
  const dependencies = useDependenciasTarea(firmId, taskId)
  const documents = useDocumentosTarea(firmId, taskId)
  const open = useAbrirTarea(firmId)
  const change = useCambiarEstadoTarea(firmId)
  const hold = usePonerTareaEnEspera(firmId)
  const complete = useCompletarTarea(firmId)
  const cancel = useCancelarTarea(firmId)
  const reject = useRechazarTarea(firmId)
  const updateMeeting = useActualizarReunionTarea(firmId)
  const updateSpecialMeeting = useActualizarReunionEspecial(firmId)
  const nextAction = useMarcarSiguienteAccion(firmId)
  const addMessage = useAnadirMensajeTarea(firmId, taskId)
  const addEvidence = useAnadirEvidenciaTarea(firmId, taskId)
  const addDependency = useCrearDependenciaTarea(firmId)
  const removeDependency = useEliminarDependenciaTarea(firmId)
  const linkDocument = useVincularDocumentoTarea(firmId, taskId)
  const unlinkDocument = useDesvincularDocumentoTarea(firmId, taskId)
  const [holdOpen, setHoldOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const openedTaskId = useRef<string | null>(null)
  const task = useMemo(
    () => (tasks.data ?? []).find((item) => item.id === taskId) ?? null,
    [taskId, tasks.data],
  )
  const participants = useParticipantesPersistentes(firmId, task?.expedienteId ?? '')
  const caseDocuments = useDocumentosExpedienteTarea(firmId, task?.expedienteId)
  const memberNames = useMemo(
    () => new Map((members.data ?? []).map((member) => [member.id, member.nombre])),
    [members.data],
  )
  const caseNames = useMemo(
    () =>
      new Map((cases.data ?? []).map((item) => [item.id, `${item.referencia} · ${item.titulo}`])),
    [cases.data],
  )
  const taskById = useMemo(
    () => new Map((tasks.data ?? []).map((item) => [item.id, item])),
    [tasks.data],
  )
  const canManage = Boolean(
    task &&
    (task.creadaPorId === session.user?.id ||
      ['owner', 'admin', 'lawyer'].includes(membership.data?.role ?? '')),
  )
  const canWork = Boolean(task && (canManage || task.asignadoId === session.user?.id))
  const predecessors = (dependencies.data ?? []).filter((item) => item.successor_task_id === taskId)
  const successors = (dependencies.data ?? []).filter((item) => item.predecessor_task_id === taskId)
  const linkedDocumentIds = new Set(
    (documents.data ?? []).map((document) => document.logical_document_id),
  )
  const availableDocuments = (caseDocuments.data ?? []).filter(
    (document) => !linkedDocumentIds.has(document.logical_document_id),
  )

  useEffect(() => {
    if (task && canWork && !task.abiertaEn && openedTaskId.current !== task.id) {
      openedTaskId.current = task.id
      void open.mutateAsync(task.id).catch(() => undefined)
    }
  }, [canWork, open, task])

  if (tasks.isPending || members.isPending || cases.isPending || participants.isPending)
    return (
      <PendingPanel title="Cargando tarea" description="Recuperando el encargo y su historial…" />
    )
  if (tasks.isError || members.isError || cases.isError || participants.isError)
    return (
      <PendingPanel title="No se pudo cargar la tarea" description="Reintenta en unos instantes." />
    )
  if (!task)
    return (
      <PendingPanel
        title="Tarea no encontrada"
        description="Puede que ya no tengas acceso a este encargo."
      />
    )

  const isOpen = !['Completada', 'Cancelada'].includes(task.estado)
  const run = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation()
      toast.success(success)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la tarea.')
    }
  }
  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const body = formText(new FormData(form), 'message')
    void run(async () => {
      await addMessage.mutateAsync(body)
      form.reset()
    }, 'Mensaje añadido.')
  }
  const submitEvidence = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    void run(async () => {
      await addEvidence.mutateAsync({
        body: formText(data, 'evidence'),
        documentId: formText(data, 'evidence-document') || null,
      })
      form.reset()
    }, 'Evidencia añadida.')
  }
  const submitDocumentLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const documentId = formText(new FormData(form), 'document')
    if (!documentId) return
    void run(async () => {
      await linkDocument.mutateAsync(documentId)
      form.reset()
    }, 'Documento vinculado.')
  }
  const submitDependency = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const predecessorId = formText(new FormData(form), 'predecessor')
    if (!predecessorId) return
    void run(async () => {
      await addDependency.mutateAsync({ predecessorId, successorId: task.id })
      form.reset()
    }, 'Dependencia añadida.')
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <SectionHeader
        title={task.titulo}
        subtitle={`Tarea ${task.id.slice(0, 8)} · ${task.tipo}`}
        actions={
          <Link
            to="/tareas"
            className="border-input hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium"
          >
            Volver a tareas
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap gap-2">
                <Badge>{task.estado}</Badge>
                {task.esSiguienteAccion ? (
                  <Badge variant="secondary">Siguiente acción</Badge>
                ) : null}
                {task.bloqueada ? (
                  <Badge variant="destructive">Bloqueada por dependencia</Badge>
                ) : null}
              </div>
              <div>
                <h2 className="font-semibold">Encargo</h2>
                <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                  {task.descripcion || 'Sin descripción adicional.'}
                </p>
              </div>
              {task.estado === 'En espera' ? (
                <p className="bg-muted rounded-md p-3 text-sm">
                  <strong>{task.motivoEspera}</strong> · revisión: {date(task.revisarEn)}
                  {task.detalleEspera ? ` · ${task.detalleEspera}` : ''}
                </p>
              ) : null}
              {task.resultadoCierre ? (
                <p className="bg-muted rounded-md p-3 text-sm">
                  <strong>Resultado:</strong> {task.resultadoCierre}
                </p>
              ) : null}
              {isOpen ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {task.estado === 'Pendiente' ? (
                      <Button
                        disabled={!canWork || change.isPending || task.bloqueada}
                        onClick={() =>
                          void run(
                            () => change.mutateAsync({ task, estado: 'En curso' }),
                            'Tarea iniciada.',
                          )
                        }
                      >
                        Empezar
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      disabled={!canManage || nextAction.isPending}
                      onClick={() =>
                        void run(
                          () => nextAction.mutateAsync({ task, enabled: !task.esSiguienteAccion }),
                          task.esSiguienteAccion
                            ? 'Siguiente acción retirada.'
                            : 'Marcada como siguiente acción.',
                        )
                      }
                    >
                      {task.esSiguienteAccion
                        ? 'Quitar siguiente acción'
                        : 'Marcar siguiente acción'}
                    </Button>
                    <Button variant="outline" disabled={!canWork} onClick={() => setHoldOpen(true)}>
                      Poner en espera
                    </Button>
                    <Button
                      disabled={!canWork || task.bloqueada}
                      onClick={() => setCompleteOpen(true)}
                    >
                      Completar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canWork}
                      onClick={() => setRejectOpen(true)}
                    >
                      Rechazar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!canManage}
                      onClick={() => setCancelOpen(true)}
                    >
                      Cancelar
                    </Button>
                  </div>
                  {!canWork ? (
                    <p className="text-muted-foreground text-xs">
                      Solo quien encargó, la persona responsable o un administrador puede operar la
                      tarea.
                    </p>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
          {task.reunion['specialType'] === 'communication' ? (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">Tarea especial · Comunicación</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      El encargo consiste en comunicar. Si surge trabajo jurídico, regístralo como
                      otra tarea.
                    </p>
                  </div>
                  <Badge variant={task.estado === 'Completada' ? 'secondary' : 'outline'}>
                    {task.estado === 'Completada'
                      ? 'Contestado'
                      : detailsText(task.reunion, 'communicationChannel')}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Canal: </span>
                    {detailsText(task.reunion, 'communicationChannel')}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Sentido: </span>
                    {detailsText(task.reunion, 'communicationDirection')}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Contacto: </span>
                    {detailsText(task.reunion, 'communicationContact') || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Teléfono: </span>
                    {detailsText(task.reunion, 'communicationPhone') || '—'}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Asunto original: </span>
                    {detailsText(task.reunion, 'communicationSubject') || '—'}
                  </p>
                </div>
                <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                  {detailsText(task.reunion, 'communicationOriginalContent') ||
                    'Sin resumen de comunicación original.'}
                </div>
                {isOpen ? (
                  <Button
                    type="button"
                    disabled={!canWork || complete.isPending}
                    onClick={() =>
                      void run(
                        () => complete.mutateAsync({ task, resultado: 'Comunicación contestada.' }),
                        'Comunicación marcada como contestada.',
                      )
                    }
                  >
                    Marcar como contestado
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : task.tipo === 'Evento' && task.reunion['specialType'] === 'meeting' ? (
            <SpecialMeetingWorkspace
              task={task}
              members={members.data ?? []}
              participants={participants.data ?? []}
              actorId={session.user?.id ?? ''}
              canManage={canManage}
              canWork={canWork}
              pending={updateSpecialMeeting.isPending}
              onSave={(details) =>
                run(
                  () => updateSpecialMeeting.mutateAsync({ task, details }),
                  'Reunión actualizada.',
                )
              }
            />
          ) : task.tipo === 'Evento' ? (
            <MeetingDetailsCard
              task={task}
              participants={participants.data ?? []}
              members={members.data ?? []}
              canManage={canManage}
              pending={updateMeeting.isPending}
              onSubmit={(details) =>
                run(
                  () => updateMeeting.mutateAsync({ task, details }),
                  'Detalles de reunión actualizados.',
                )
              }
            />
          ) : null}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="font-semibold">Conversación</h2>
              {(messages.data ?? []).map((message) => (
                <article key={message.id} className="border-l-2 pl-3 text-sm">
                  <p>{message.body}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {memberNames.get(message.author_id ?? '') ?? 'Sistema'} ·{' '}
                    {date(message.created_at)}
                  </p>
                </article>
              ))}
              <form className="space-y-2" onSubmit={submitMessage}>
                <Textarea
                  name="message"
                  required
                  disabled={!canWork}
                  placeholder="Escribe una actualización…"
                />
                <Button type="submit" disabled={!canWork || addMessage.isPending}>
                  Enviar mensaje
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h2 className="font-semibold">Documentos vinculados</h2>
              {(documents.data ?? []).map((document) => (
                <div key={document.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link to="/documentos" className="min-w-0 truncate underline underline-offset-4">
                    {document.original_name} · v{document.version}
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!canManage || unlinkDocument.isPending}
                    onClick={() =>
                      void run(
                        () => unlinkDocument.mutateAsync(document.id),
                        'Documento desvinculado.',
                      )
                    }
                  >
                    Desvincular
                  </Button>
                </div>
              ))}
              {!documents.data?.length ? (
                <p className="text-muted-foreground text-sm">No hay documentos vinculados.</p>
              ) : null}
              {task.expedienteId ? (
                <form className="flex gap-2" onSubmit={submitDocumentLink}>
                  <select
                    name="document"
                    aria-label="Documento para vincular"
                    defaultValue=""
                    disabled={!canManage || !availableDocuments.length}
                    className="border-input bg-background min-w-0 flex-1 rounded-md border px-2 text-sm"
                  >
                    <option value="">Vincular documento…</option>
                    {availableDocuments.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.original_name} · v{document.version}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!canManage || linkDocument.isPending}
                  >
                    Vincular
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h2 className="font-semibold">Evidencias e histórico</h2>
              {(evidences.data ?? []).map((evidence) => (
                <p key={evidence.id} className="text-sm">
                  {evidence.body || 'Documento vinculado'} · {date(evidence.created_at)}
                </p>
              ))}
              <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={submitEvidence}>
                <Textarea
                  name="evidence"
                  aria-label="Nueva evidencia"
                  disabled={!canWork}
                  placeholder="Nota de evidencia"
                />
                <select
                  name="evidence-document"
                  aria-label="Documento como evidencia"
                  defaultValue=""
                  disabled={!canWork || !caseDocuments.data?.length}
                  className="border-input bg-background rounded-md border px-2 text-sm"
                >
                  <option value="">Sin documento</option>
                  {(caseDocuments.data ?? []).map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.original_name}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!canWork || addEvidence.isPending}
                >
                  Añadir evidencia
                </Button>
              </form>
              {(events.data ?? []).map((event) => (
                <p key={event.id} className="text-muted-foreground border-l-2 pl-3 text-sm">
                  {event.event_type} · {date(event.created_at)}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-5">
          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <h2 className="font-semibold">Información</h2>
              <p>
                <span className="text-muted-foreground">ID:</span> {task.id}
              </p>
              <p>
                <span className="text-muted-foreground">Estado:</span> {task.estado}
              </p>
              <p>
                <span className="text-muted-foreground">Encargante:</span>{' '}
                {memberNames.get(task.creadaPorId ?? '') ?? 'Sistema'}
              </p>
              <p>
                <span className="text-muted-foreground">Responsable:</span>{' '}
                {memberNames.get(task.asignadoId ?? '') ?? 'Sin asignar'}
              </p>
              <p>
                <span className="text-muted-foreground">Expediente:</span>{' '}
                {caseNames.get(task.expedienteId ?? '') ?? 'Lead vinculado'}
              </p>
              <p>
                <span className="text-muted-foreground">Vencimiento:</span> {date(task.venceEn)}
              </p>
              <p>
                <span className="text-muted-foreground">Recordatorio:</span> {date(task.recordarEn)}
              </p>
              <p>
                <span className="text-muted-foreground">Prioridad:</span> {task.prioridad}
              </p>
              <p>
                <span className="text-muted-foreground">Etiquetas:</span>{' '}
                {task.etiquetas.map((label) => label.nombre).join(', ') || 'Sin etiquetas'}
              </p>
              <p>
                <span className="text-muted-foreground">Siguiente acción:</span>{' '}
                {task.esSiguienteAccion ? 'Sí' : 'No'}
              </p>
              <p>
                <span className="text-muted-foreground">Abierta:</span> {date(task.abiertaEn)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <h2 className="font-semibold">Dependencias</h2>
              {predecessors.map((dependency) => (
                <div key={dependency.id} className="flex items-center justify-between gap-2">
                  <Link to="/tareas/$taskId" params={{ taskId: dependency.predecessor_task_id }}>
                    {taskById.get(dependency.predecessor_task_id)?.titulo ??
                      'Antecedente no disponible'}
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!canManage || removeDependency.isPending}
                    onClick={() =>
                      void run(
                        () => removeDependency.mutateAsync(dependency.id),
                        'Dependencia eliminada.',
                      )
                    }
                  >
                    Quitar
                  </Button>
                </div>
              ))}
              {successors.map((dependency) => (
                <p key={dependency.id}>
                  Desbloquea:{' '}
                  {taskById.get(dependency.successor_task_id)?.titulo ?? 'Tarea no disponible'}
                </p>
              ))}
              {!predecessors.length && !successors.length ? (
                <p className="text-muted-foreground">Sin dependencias.</p>
              ) : null}
              <form className="space-y-2 border-t pt-3" onSubmit={submitDependency}>
                <Label htmlFor="task-predecessor">Añadir antecedente</Label>
                <select
                  id="task-predecessor"
                  name="predecessor"
                  aria-label="Tarea antecedente"
                  defaultValue=""
                  disabled={!canManage}
                  className="border-input bg-background h-9 w-full rounded-md border px-2"
                >
                  <option value="">Selecciona una tarea…</option>
                  {(tasks.data ?? [])
                    .filter(
                      (candidate) =>
                        candidate.id !== task.id &&
                        candidate.estado !== 'Completada' &&
                        candidate.estado !== 'Cancelada' &&
                        (candidate.expedienteId === task.expedienteId ||
                          candidate.oportunidadId === task.oportunidadId),
                    )
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.titulo}
                      </option>
                    ))}
                </select>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={!canManage || addDependency.isPending}
                >
                  Añadir dependencia
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </div>
      <TaskHoldDialog
        open={holdOpen}
        onOpenChange={setHoldOpen}
        pending={hold.isPending}
        onSubmit={(motivo, revisarEn, detalle) => {
          void run(async () => {
            await hold.mutateAsync({ task, motivo, revisarEn, detalle })
            setHoldOpen(false)
          }, 'Tarea puesta en espera.')
        }}
      />
      <TaskCompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        nextAction={task.esSiguienteAccion}
        documents={caseDocuments.data ?? []}
        pending={complete.isPending || addEvidence.isPending}
        onSubmit={(resultado, continuidad, evidencia, documentoId) => {
          void run(async () => {
            if (evidencia.trim() || documentoId)
              await addEvidence.mutateAsync({ body: evidencia, documentId: documentoId || null })
            await complete.mutateAsync(
              continuidad ? { task, resultado, continuidad } : { task, resultado },
            )
            setCompleteOpen(false)
          }, 'Tarea completada.')
        }}
      />
      <TaskReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        pending={reject.isPending}
        title="Rechazar tarea"
        label="Motivo del rechazo"
        onSubmit={(motivo) => {
          void run(async () => {
            await reject.mutateAsync({ task, motivo })
            setRejectOpen(false)
          }, 'Rechazo registrado.')
        }}
      />
      <TaskReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        pending={cancel.isPending}
        title="Cancelar tarea"
        label="Motivo de la cancelación"
        onSubmit={(motivo) => {
          void run(async () => {
            await cancel.mutateAsync({ task, motivo })
            setCancelOpen(false)
          }, 'Tarea cancelada.')
        }}
      />
    </main>
  )
}

function TaskHoldDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onSubmit: (reason: string, reviewAt: string, detail: string) => void
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit(
      formText(data, 'reason'),
      new Date(formText(data, 'reviewAt')).toISOString(),
      formText(data, 'detail'),
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Poner tarea en espera</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Label>
            Motivo
            <Input name="reason" required />
          </Label>
          <Label>
            Revisar el día
            <Input name="reviewAt" type="datetime-local" required />
          </Label>
          <Label>
            Detalle
            <Textarea name="detail" />
          </Label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Confirmar espera
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TaskCompleteDialog({
  open,
  onOpenChange,
  nextAction,
  documents,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nextAction: boolean
  documents: Array<{ id: string; original_name: string }>
  pending: boolean
  onSubmit: (
    result: string,
    continuity: 'create_next_task' | 'close_without_continuity' | undefined,
    evidence: string,
    documentId: string,
  ) => void
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit(
      formText(data, 'result'),
      nextAction
        ? (formText(data, 'continuity') as 'create_next_task' | 'close_without_continuity')
        : undefined,
      formText(data, 'evidence'),
      formText(data, 'document'),
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completar tarea</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Label>
            Resultado
            <Textarea name="result" required />
          </Label>
          <Label>
            Evidencia opcional
            <Textarea name="evidence" />
          </Label>
          <Label>
            Documento opcional
            <select
              name="document"
              className="border-input bg-background h-10 w-full rounded-md border px-3"
            >
              <option value="">Sin documento</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.original_name}
                </option>
              ))}
            </select>
          </Label>
          {nextAction ? (
            <Label>
              Continuidad
              <select
                name="continuity"
                required
                className="border-input bg-background h-10 w-full rounded-md border px-3"
              >
                <option value="create_next_task">Crear siguiente tarea</option>
                <option value="close_without_continuity">Cerrar sin continuidad</option>
              </select>
            </Label>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Completar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TaskReasonDialog({
  open,
  onOpenChange,
  pending,
  title,
  label,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  title: string
  label: string
  onSubmit: (reason: string) => void
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(formText(new FormData(event.currentTarget), 'reason'))
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Label>
            {label}
            <Textarea name="reason" required />
          </Label>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SpecialMeetingWorkspace({
  task,
  members,
  participants,
  actorId,
  canManage,
  canWork,
  pending,
  onSave,
}: {
  task: TareaPersistida
  members: Array<{ id: string; nombre: string }>
  participants: Array<{ id: string; contactoId: string | null; nombre: string }>
  actorId: string
  canManage: boolean
  canWork: boolean
  pending: boolean
  onSave: (details: DetallesReunion) => Promise<unknown>
}) {
  const details = task.reunion
  const status = detailsText(details, 'status') || 'preparation'
  const [newPreparationItem, setNewPreparationItem] = useState('')
  const [preparationCategory, setPreparationCategory] = useState('Gestión previa')
  const [clockNow, setClockNow] = useState(0)
  useEffect(() => {
    if (status !== 'in_progress') return
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [status])
  const statusLabels: Record<string, string> = {
    preparation: 'Preparación',
    scheduled: 'Agendada',
    in_progress: 'En reunión',
    finished: 'Finalizada',
    cancelled: 'Cancelada',
    not_held: 'No celebrada',
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form, (event.nativeEvent as SubmitEvent).submitter)
    const meetingAction = formText(data, 'meetingAction')
    const isRescheduling = meetingAction === 'reschedule'
    const rescheduleReason = formText(data, 'meetingRescheduleReason').trim()
    if (isRescheduling && !rescheduleReason) {
      toast.error('Indica el motivo para reprogramar la reunión.')
      return
    }
    const nextStatus = isRescheduling ? 'preparation' : formText(data, 'meetingStatus') || status
    const statusReason = formText(data, 'meetingStatusReason').trim()
    if (['cancelled', 'not_held'].includes(nextStatus) && nextStatus !== status && !statusReason) {
      toast.error('Indica el motivo para cancelar o marcar la reunión como no celebrada.')
      return
    }
    const startInput = canManage
      ? formText(data, 'specialStartsAt')
      : detailsText(details, 'startsAt')
    const endInput = canManage ? formText(data, 'specialEndsAt') : detailsText(details, 'endsAt')
    const startsAt = isRescheduling ? '' : startInput ? new Date(startInput).toISOString() : ''
    const endsAt = isRescheduling ? '' : endInput ? new Date(endInput).toISOString() : ''
    if (
      ['scheduled', 'in_progress', 'finished'].includes(nextStatus) &&
      (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt))
    ) {
      toast.error('Para agendar indica inicio y fin; el fin debe ser posterior al inicio.')
      return
    }
    const now = new Date().toISOString()
    const oldNotes = Array.isArray(details['internalNotes'])
      ? details['internalNotes'].filter((item): item is string => typeof item === 'string')
      : []
    const newNote = formText(data, 'meetingInternalNote').trim()
    const preparationItems = meetingPreparationItems(details)
    const checkedPreparationIds = new Set(
      data.getAll('preparationDone').filter((value): value is string => typeof value === 'string'),
    )
    const submittedPreparationItems =
      canManage && status === 'preparation'
        ? preparationItems.map((item) => ({ ...item, done: checkedPreparationIds.has(item.id) }))
        : preparationItems
    const newItemText = formText(data, 'preparationNewItem').trim()
    if (meetingAction === 'add_preparation_item' && !newItemText) {
      toast.error('Escribe el punto que quieres añadir a la preparación.')
      return
    }
    const removePreparationItemId = meetingAction.startsWith('remove_preparation_item:')
      ? meetingAction.slice('remove_preparation_item:'.length)
      : ''
    const createdByName = members.find((member) => member.id === actorId)?.nombre ?? ''
    const nextPreparationItems =
      meetingAction === 'add_preparation_item'
        ? [
          ...submittedPreparationItems,
          {
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `preparation-${Date.now()}`,
            text: newItemText,
            done: false,
            category: formText(data, 'preparationCategory'),
            createdById: actorId,
            ...(createdByName ? { createdByName } : {}),
            createdAt: now,
          },
        ]
        : removePreparationItemId
          ? submittedPreparationItems.filter((item) => item.id !== removePreparationItemId)
          : submittedPreparationItems
    const rescheduleHistory = meetingRescheduleHistory(details)
    const actualDurationMinutes =
      nextStatus === 'finished' && detailsText(details, 'startedAt')
        ? Math.max(
          0,
          Math.round((Date.now() - Date.parse(detailsText(details, 'startedAt'))) / 60_000),
        )
        : typeof details['actualDurationMinutes'] === 'number'
          ? details['actualDurationMinutes']
          : undefined
    const result: DetallesReunion = {
      ...(details as unknown as DetallesReunion),
      startsAt,
      endsAt,
      mode: (canManage
        ? formText(data, 'specialMode')
        : detailsText(details, 'mode')) as DetallesReunion['mode'],
      location: canManage
        ? formText(data, 'specialPreferredLocation')
        : detailsText(details, 'location'),
      meetingUrl: canManage ? formText(data, 'specialUrl') : detailsText(details, 'meetingUrl'),
      preparation: canManage
        ? formText(data, 'specialPreparation')
        : detailsText(details, 'preparation'),
      internalInstructions: canManage
        ? formText(data, 'specialInstructions')
        : detailsText(details, 'internalInstructions'),
      meetingType: canManage ? formText(data, 'specialType') : detailsText(details, 'meetingType'),
      subject: canManage ? formText(data, 'specialSubject') : detailsText(details, 'subject'),
      status: nextStatus as NonNullable<DetallesReunion['status']>,
      statusReason: ['cancelled', 'not_held'].includes(nextStatus)
        ? statusReason || detailsText(details, 'statusReason')
        : '',
      attendeeContactIds: canManage
        ? data
          .getAll('specialContacts')
          .filter((value): value is string => typeof value === 'string')
        : detailsIds(details, 'attendeeContactIds'),
      attendeeUserIds: canManage
        ? data.getAll('specialUsers').filter((value): value is string => typeof value === 'string')
        : detailsIds(details, 'attendeeUserIds'),
      attendeeNames: canManage
        ? formText(data, 'specialOtherAttendees')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        : Array.isArray(details['attendeeNames'])
          ? details['attendeeNames'].filter((item): item is string => typeof item === 'string')
          : [],
      durationMinutes: canManage
        ? Number(formText(data, 'specialDuration')) || 60
        : typeof details['durationMinutes'] === 'number'
          ? details['durationMinutes']
          : 60,
      preferredDate: canManage
        ? formText(data, 'specialPreferredDate')
        : detailsText(details, 'preferredDate'),
      preferredTimeSlot: canManage
        ? formText(data, 'specialTimeSlot')
        : detailsText(details, 'preferredTimeSlot'),
      preferredLocation: canManage
        ? formText(data, 'specialPreferredLocation')
        : detailsText(details, 'preferredLocation'),
      preparationItems: nextPreparationItems,
      ...(isRescheduling
        ? {
          rescheduleHistory: [
            ...rescheduleHistory,
            {
              requestedAt: now,
              reason: rescheduleReason,
              previousStartsAt: detailsText(details, 'startsAt'),
              previousEndsAt: detailsText(details, 'endsAt'),
            },
          ],
        }
        : {}),
      ...(nextStatus === 'in_progress' && !details['startedAt'] ? { startedAt: now } : {}),
      ...(nextStatus === 'finished' ? { finishedAt: now } : {}),
      ...(actualDurationMinutes === undefined ? {} : { actualDurationMinutes }),
      internalNotes: [
        ...oldNotes,
        ...(newNote ? [newNote] : []),
        ...(isRescheduling ? [`Reprogramación: ${rescheduleReason}`] : []),
      ],
      outcome:
        canManage && data.has('meetingOutcome')
          ? formText(data, 'meetingOutcome')
          : detailsText(details, 'outcome'),
      decisions:
        canManage && data.has('meetingDecisions')
          ? formText(data, 'meetingDecisions')
          : detailsText(details, 'decisions'),
      transcription:
        canManage && data.has('meetingTranscription')
          ? formText(data, 'meetingTranscription')
          : detailsText(details, 'transcription'),
      summary:
        canManage && data.has('meetingSummary')
          ? formText(data, 'meetingSummary')
          : detailsText(details, 'summary'),
    }
    void onSave(result)
  }
  const contactIds = detailsIds(details, 'attendeeContactIds')
  const userIds = detailsIds(details, 'attendeeUserIds')
  const notes = Array.isArray(details['internalNotes'])
    ? details['internalNotes'].filter((item): item is string => typeof item === 'string')
    : []
  const preparationItems = meetingPreparationItems(details)
  const rescheduleHistory = meetingRescheduleHistory(details)
  const startedAt = detailsText(details, 'startedAt')
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Tarea especial · Reunión</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              La reunión mantiene su preparación, agenda, asistentes y resultado en este expediente.
            </p>
          </div>
          <Badge variant="secondary">{statusLabels[status] ?? statusLabels['preparation']}</Badge>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Fases de la reunión">
          {['Preparación', 'Agendada', 'En reunión', 'Finalizada'].map((phase, index) => {
            const keys = ['preparation', 'scheduled', 'in_progress', 'finished']
            return (
              <Badge key={phase} variant={keys.indexOf(status) >= index ? 'default' : 'outline'}>
                {phase}
              </Badge>
            )
          })}
        </div>
        {status === 'in_progress' ? (
          <section className="border-warning/50 bg-warning/5 space-y-2 rounded-md border p-4 text-center">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Reunión en curso
            </h3>
            <output
              role="timer"
              aria-label="Tiempo transcurrido de la reunión"
              className="font-mono text-3xl tabular-nums"
            >
              {formatElapsedTime(startedAt, clockNow || Date.parse(startedAt))}
            </output>
            <p className="text-muted-foreground text-xs">Inicio real: {date(startedAt || null)}</p>
          </section>
        ) : null}
        {['cancelled', 'not_held'].includes(status) ? (
          <p className="rounded-md border p-3 text-sm">
            <strong>Motivo: </strong>
            {detailsText(details, 'statusReason') || 'Sin motivo registrado.'}
          </p>
        ) : null}
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label>
              Tipo de reunión
              <Input
                name="specialType"
                defaultValue={detailsText(details, 'meetingType')}
                disabled={!canManage}
              />
            </Label>
            <Label>
              Objeto de la reunión
              <Input
                name="specialSubject"
                defaultValue={detailsText(details, 'subject')}
                disabled={!canManage}
              />
            </Label>
            <Label>
              Contactos asistentes
              <select
                name="specialContacts"
                multiple
                size={3}
                disabled={!canManage}
                defaultValue={contactIds}
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              >
                {participants
                  .filter((person) => person.contactoId)
                  .map((person) => (
                    <option key={person.id} value={person.contactoId ?? ''}>
                      {person.nombre}
                    </option>
                  ))}
              </select>
            </Label>
            <Label>
              Equipo asistente
              <select
                name="specialUsers"
                multiple
                size={3}
                disabled={!canManage}
                defaultValue={userIds}
                className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nombre}
                  </option>
                ))}
              </select>
            </Label>
            <Label>
              Otros asistentes
              <Input
                name="specialOtherAttendees"
                defaultValue={
                  Array.isArray(details['attendeeNames']) ? details['attendeeNames'].join(', ') : ''
                }
                disabled={!canManage}
              />
            </Label>
            <Label>
              Duración estimada (minutos)
              <Input
                name="specialDuration"
                type="number"
                min="1"
                defaultValue={
                  typeof details['durationMinutes'] === 'number'
                    ? String(details['durationMinutes'])
                    : '60'
                }
                disabled={!canManage}
              />
            </Label>
            <Label>
              Preferencia de fecha
              <Input
                name="specialPreferredDate"
                type="date"
                defaultValue={detailsText(details, 'preferredDate')}
                disabled={!canManage}
              />
            </Label>
            <Label>
              Franja preferida
              <select
                name="specialTimeSlot"
                defaultValue={detailsText(details, 'preferredTimeSlot') || 'Indiferente'}
                disabled={!canManage}
                className="border-input bg-background h-10 w-full rounded-md border px-3"
              >
                <option>Indiferente</option>
                <option>Mañana</option>
                <option>Tarde</option>
              </select>
            </Label>
            <Label>
              Modalidad
              <select
                name="specialMode"
                defaultValue={detailsText(details, 'mode') || 'office_bilbao'}
                disabled={!canManage}
                className="border-input bg-background h-10 w-full rounded-md border px-3"
              >
                <option value="office_bilbao">Despacho Bilbao</option>
                <option value="office_recalde">Despacho Rekalde</option>
                <option value="phone">Teléfono</option>
                <option value="outside_office">Fuera del despacho / videollamada</option>
              </select>
            </Label>
            <Label>
              Lugar / dirección
              <Input
                name="specialPreferredLocation"
                defaultValue={
                  detailsText(details, 'preferredLocation') || detailsText(details, 'location')
                }
                disabled={!canManage}
              />
            </Label>
            <Label>
              Indicaciones internas
              <Textarea
                name="specialInstructions"
                defaultValue={detailsText(details, 'internalInstructions')}
                disabled={!canManage}
              />
            </Label>
            <Label>
              Preparación previa
              <Textarea
                name="specialPreparation"
                defaultValue={detailsText(details, 'preparation')}
                disabled={!canManage}
              />
            </Label>
          </div>
          {status === 'preparation' ? (
            <section className="space-y-3 border-t pt-4">
              <div>
                <h3 className="font-medium">Preparación · lista de trabajo</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Añade gestiones previas y marca las que ya estén hechas.
                </p>
              </div>
              {preparationItems.length ? (
                <ul className="space-y-2">
                  {preparationItems.map((item) => (
                    <li key={item.id}>
                      <div className="flex items-start gap-2 rounded-md border p-2 text-sm">
                        <label className="flex min-w-0 flex-1 items-start gap-2">
                          <input
                            type="checkbox"
                            name="preparationDone"
                            value={item.id}
                            defaultChecked={item.done}
                            disabled={!canManage || pending}
                            aria-label={`Preparación completada: ${item.text}`}
                            className="mt-1"
                          />
                          <span className={item.done ? 'text-muted-foreground line-through' : ''}>
                            {item.text}
                            <span className="text-muted-foreground block text-xs">
                              {[
                                item.category,
                                item.createdByName,
                                item.createdAt ? date(item.createdAt) : undefined,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </label>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          name="meetingAction"
                          value={`remove_preparation_item:${item.id}`}
                          aria-label={`Quitar punto: ${item.text}`}
                          disabled={!canManage || pending}
                        >
                          Quitar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Sin puntos de preparación.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Label>
                  Clase del punto
                  <select
                    name="preparationCategory"
                    value={preparationCategory}
                    onChange={(event) => setPreparationCategory(event.target.value)}
                    disabled={!canManage || pending}
                    className="border-input bg-background h-10 rounded-md border px-3 text-sm"
                  >
                    <option>Documentación a solicitar</option>
                    <option>Documentación a revisar</option>
                    <option>Confirmar asistencia</option>
                    <option>Gestión previa</option>
                  </select>
                </Label>
                <Input
                  name="preparationNewItem"
                  aria-label="Punto de preparación"
                  value={newPreparationItem}
                  onChange={(event) => setNewPreparationItem(event.target.value)}
                  disabled={!canManage || pending}
                  placeholder="Qué hay que preparar…"
                />
                <Button
                  type="submit"
                  name="meetingAction"
                  value="add_preparation_item"
                  disabled={!canManage || pending}
                >
                  Añadir punto de preparación
                </Button>
              </div>
            </section>
          ) : null}
          <div className="border-t pt-4">
            <h3 className="font-medium">Concretar la reunión</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Label>
                Inicio
                <Input
                  name="specialStartsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(detailsText(details, 'startsAt'))}
                  disabled={!canManage}
                />
              </Label>
              <Label>
                Fin
                <Input
                  name="specialEndsAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocal(detailsText(details, 'endsAt'))}
                  disabled={!canManage}
                />
              </Label>
              <Label>
                Enlace de reunión
                <Input
                  name="specialUrl"
                  type="url"
                  defaultValue={detailsText(details, 'meetingUrl')}
                  disabled={!canManage}
                />
              </Label>
              <Label>
                Registro de nota interna
                <Textarea
                  name="meetingInternalNote"
                  disabled={!canWork}
                  placeholder="Añadir una nota al historial…"
                />
              </Label>
            </div>
          </div>
          {status === 'scheduled' ? (
            <Label>
              Motivo de reprogramación
              <Textarea
                name="meetingRescheduleReason"
                disabled={!canManage}
                placeholder="Indica por qué hay que cambiar la fecha…"
              />
            </Label>
          ) : null}
          {['preparation', 'scheduled'].includes(status) ? (
            <Label>
              Motivo de cancelación o no celebración
              <Textarea
                name="meetingStatusReason"
                disabled={!canManage}
                placeholder="Indica qué ha ocurrido…"
              />
            </Label>
          ) : null}
          {status === 'in_progress' || status === 'finished' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                Resumen
                <Textarea
                  name="meetingSummary"
                  defaultValue={detailsText(details, 'summary')}
                  disabled={!canManage}
                />
              </Label>
              <Label>
                Decisiones
                <Textarea
                  name="meetingDecisions"
                  defaultValue={detailsText(details, 'decisions')}
                  disabled={!canManage}
                />
              </Label>
              <Label>
                Resultado
                <Textarea
                  name="meetingOutcome"
                  defaultValue={detailsText(details, 'outcome')}
                  disabled={!canManage}
                />
              </Label>
              <Label>
                Transcripción
                <Textarea
                  name="meetingTranscription"
                  defaultValue={detailsText(details, 'transcription')}
                  disabled={!canManage}
                />
              </Label>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="meetingStatus"
              value={status}
              disabled={!canManage || pending}
            >
              Guardar cambios
            </Button>
            {status === 'preparation' ? (
              <Button
                type="submit"
                name="meetingStatus"
                value="scheduled"
                disabled={!canManage || pending}
              >
                Agendar reunión
              </Button>
            ) : null}
            {status === 'scheduled' ? (
              <>
                <Button
                  type="submit"
                  name="meetingStatus"
                  value="in_progress"
                  disabled={!canWork || pending}
                >
                  Comenzar reunión
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  name="meetingAction"
                  value="reschedule"
                  disabled={!canManage || pending}
                >
                  Reprogramar reunión
                </Button>
              </>
            ) : null}
            {status === 'in_progress' ? (
              <Button
                type="submit"
                name="meetingStatus"
                value="finished"
                disabled={!canWork || pending}
              >
                Finalizar reunión
              </Button>
            ) : null}
            {['preparation', 'scheduled'].includes(status) ? (
              <Button
                type="submit"
                variant="outline"
                name="meetingStatus"
                value="not_held"
                disabled={!canManage || pending}
              >
                No celebrada
              </Button>
            ) : null}
            {['preparation', 'scheduled'].includes(status) ? (
              <Button
                type="submit"
                variant="outline"
                name="meetingStatus"
                value="cancelled"
                disabled={!canManage || pending}
              >
                Cancelar reunión
              </Button>
            ) : null}
          </div>
        </form>
        {notes.length ? (
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Notas internas</h3>
            {notes.map((note, index) => (
              <p
                key={`${index}-${note}`}
                className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap"
              >
                {note}
              </p>
            ))}
          </div>
        ) : null}
        {rescheduleHistory.length ? (
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Historial de reprogramaciones</h3>
            {rescheduleHistory.map((entry, index) => (
              <p
                key={`${entry.requestedAt}-${index}`}
                className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap"
              >
                {date(entry.previousStartsAt)} → {date(entry.previousEndsAt)} ·{' '}
                {date(entry.requestedAt)} · {entry.reason}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function MeetingDetailsCard({
  task,
  participants,
  members,
  canManage,
  pending,
  onSubmit,
}: {
  task: TareaPersistida
  participants: Array<{ id: string; contactoId: string | null; nombre: string }>
  members: Array<{ id: string; nombre: string }>
  canManage: boolean
  pending: boolean
  onSubmit: (details: DetallesReunion) => Promise<unknown>
}) {
  const details = task.reunion
  const storedContactIds = detailsIds(details, 'attendeeContactIds')
  const contactIds = storedContactIds.length
    ? storedContactIds
    : participants.flatMap((participant) =>
      participant.contactoId ? [participant.contactoId] : [],
    )
  const userIds = detailsIds(details, 'attendeeUserIds')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const startsAt = formText(data, 'startsAt')
    const endsAt = formText(data, 'endsAt')
    if (!startsAt || !endsAt) return
    void onSubmit({
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      mode: formText(data, 'mode') as DetallesReunion['mode'],
      location: formText(data, 'location'),
      meetingUrl: formText(data, 'meetingUrl'),
      preparation: formText(data, 'preparation'),
      attendeeContactIds: data
        .getAll('attendeeContactIds')
        .filter((value): value is string => typeof value === 'string'),
      attendeeUserIds: data
        .getAll('attendeeUserIds')
        .filter((value): value is string => typeof value === 'string'),
    })
  }
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-semibold">Datos de la reunión</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Los contactos del expediente se proponen como asistentes.
          </p>
        </div>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <Label>
            Inicio
            <Input
              name="startsAt"
              type="datetime-local"
              required
              disabled={!canManage}
              defaultValue={toDateTimeLocal(detailsText(details, 'startsAt') || task.venceEn || '')}
            />
          </Label>
          <Label>
            Fin
            <Input
              name="endsAt"
              type="datetime-local"
              required
              disabled={!canManage}
              defaultValue={toDateTimeLocal(detailsText(details, 'endsAt'))}
            />
          </Label>
          <Label>
            Modalidad
            <select
              name="mode"
              disabled={!canManage}
              defaultValue={detailsText(details, 'mode') || 'office_bilbao'}
              className="border-input bg-background h-10 w-full rounded-md border px-3"
            >
              <option value="office_bilbao">Despacho Bilbao</option>
              <option value="office_recalde">Despacho Recalde</option>
              <option value="phone">Teléfono</option>
              <option value="outside_office">Fuera del despacho</option>
            </select>
          </Label>
          <Label>
            Lugar
            <Input
              name="location"
              disabled={!canManage}
              defaultValue={detailsText(details, 'location')}
            />
          </Label>
          <Label>
            Enlace de reunión
            <Input
              name="meetingUrl"
              type="url"
              disabled={!canManage}
              defaultValue={detailsText(details, 'meetingUrl')}
            />
          </Label>
          <Label>
            Preparación
            <Textarea
              name="preparation"
              disabled={!canManage}
              defaultValue={detailsText(details, 'preparation')}
            />
          </Label>
          <Label>
            Contactos asistentes
            <select
              name="attendeeContactIds"
              multiple
              disabled={!canManage}
              defaultValue={contactIds}
              className="border-input bg-background min-h-24 w-full rounded-md border px-3"
            >
              {participants
                .filter((participant) => participant.contactoId)
                .map((participant) => (
                  <option key={participant.id} value={participant.contactoId ?? ''}>
                    {participant.nombre}
                  </option>
                ))}
            </select>
          </Label>
          <Label>
            Equipo asistente
            <select
              name="attendeeUserIds"
              multiple
              disabled={!canManage}
              defaultValue={userIds}
              className="border-input bg-background min-h-24 w-full rounded-md border px-3"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
            </select>
          </Label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={!canManage || pending}>
              Guardar reunión
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
