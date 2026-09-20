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
          {task.tipo === 'Evento' ? (
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
