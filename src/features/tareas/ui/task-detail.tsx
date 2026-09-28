import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Ban,
  BellPlus,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CircleCheck,
  CircleDot,
  CirclePause,
  Copy,
  Eye,
  FileText,
  Flag,
  GitBranch,
  Hash,
  Hourglass,
  Link2,
  ListChecks,
  ListOrdered,
  Lock,
  Maximize2,
  Megaphone,
  MessageSquare,
  Milestone,
  MoreHorizontal,
  Paperclip,
  Play,
  Plus,
  Send,
  Star,
  StarOff,
  Tag,
  Undo2,
  Unlink,
  UserPen,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { PendingPanel } from '@/components/common'
import { MeetingAttendeesPicker } from '@/components/tareas/meeting-attendees-picker'
import { TaskCreateDialog } from '@/components/tareas/task-create-dialog'
import { TaskHoldDialog } from '@/components/tareas/task-hold-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { TaskCommunications } from '@/features/tareas/ui/task-communications'
import { MeetingCalendarPanel } from '@/features/tareas/ui/task-meeting-calendar'
import { MeetingInternalNotes } from '@/features/tareas/ui/task-meeting-notes'
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes, useParticipantesPersistentes } from '@/features/expedientes'
import {
  useAbrirTarea,
  useActualizarReunionTarea,
  useActualizarReunionEspecial,
  useAnadirMensajeTarea,
  useAnadirSiguienteTarea,
  useAnadirSubtareaTarea,
  useCambiarEstadoTarea,
  useCancelarTarea,
  useCompletarTarea,
  useConvertirSubtareaTarea,
  useCrearDependenciaTarea,
  useCrearTarea,
  useDependenciasDespacho,
  useDependenciasTarea,
  useDesvincularDocumentoTarea,
  useDocumentosExpedienteTarea,
  useDocumentosTarea,
  useEditarTarea,
  useEliminarDependenciaTarea,
  useMarcarNotificacionesLeidas,
  useMarcarSiguienteAccion,
  useMarcarSubtareaTarea,
  useMensajesTarea,
  usePonerTareaEnEspera,
  useRechazarTarea,
  useTareasPersistentes,
  useVincularDocumentoTarea,
  type DetallesReunion,
  type EstadoTarea,
  type RelevanciaTarea,
  type SiguienteTareaInput,
  type SubtareaPersistida,
  type TareaPersistida,
  RELEVANCIA_TAREA_LABELS,
} from '@/features/tareas'

const REMINDER_PREFIX = 'Recordatorio al responsable: '
const TASK_STATES: EstadoTarea[] = ['Pendiente', 'En curso', 'En espera', 'Completada', 'Cancelada']
const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-2 text-sm'
const inlineFieldClass =
  'hover:border-input focus-visible:border-input h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm shadow-none transition-colors disabled:cursor-default disabled:opacity-100'

const STATUS_META: Record<EstadoTarea, { icon: LucideIcon; className: string }> = {
  Pendiente: { icon: CircleDot, className: 'border-border bg-secondary text-secondary-foreground' },
  'En curso': { icon: Play, className: 'border-primary/30 bg-primary/10 text-primary' },
  'En espera': {
    icon: CirclePause,
    className: 'border-warning/30 bg-warning/10 text-warning-foreground',
  },
  Completada: { icon: CircleCheck, className: 'border-success/30 bg-success/10 text-success' },
  Cancelada: { icon: Ban, className: 'border-destructive/30 bg-destructive/10 text-destructive' },
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function DetailSection({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: LucideIcon
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Icon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  )
}

function PropertyRow({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon: LucideIcon
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
      <Label
        htmlFor={htmlFor}
        className="text-muted-foreground flex items-center gap-2 text-xs font-normal"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

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

const toDateTimeLocal = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function TaskDetail({
  taskId,
  embedded = false,
  onOpenTask,
}: {
  taskId: string
  embedded?: boolean
  onOpenTask?: (taskId: string) => void
}) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const messages = useMensajesTarea(firmId, taskId)
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
  const addSubtask = useAnadirSubtareaTarea(firmId)
  const setSubtaskDone = useMarcarSubtareaTarea(firmId)
  const addDependency = useCrearDependenciaTarea(firmId)
  const removeDependency = useEliminarDependenciaTarea(firmId)
  const firmDependencies = useDependenciasDespacho(firmId)
  const addNextTask = useAnadirSiguienteTarea(firmId)
  const convertSubtask = useConvertirSubtareaTarea(firmId)
  const linkDocument = useVincularDocumentoTarea(firmId, taskId)
  const unlinkDocument = useDesvincularDocumentoTarea(firmId, taskId)
  const [holdOpen, setHoldOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [remindOpen, setRemindOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [nextTaskOpen, setNextTaskOpen] = useState(false)
  const [convertingSubtask, setConvertingSubtask] = useState<SubtareaPersistida | null>(null)
  const edit = useEditarTarea(firmId)
  const create = useCrearTarea(firmId)
  const { mutate: markNotificationsRead } = useMarcarNotificacionesLeidas()
  const messageCount = messages.data?.length ?? 0
  useEffect(() => {
    if (session.user?.id) markNotificationsRead(taskId)
  }, [markNotificationsRead, messageCount, session.user?.id, taskId])
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
  const chain = useMemo(() => {
    const predecessorOf = new Map<string, string>()
    const successorOf = new Map<string, string>()
    for (const dependency of firmDependencies.data ?? []) {
      if (!predecessorOf.has(dependency.successor_task_id))
        predecessorOf.set(dependency.successor_task_id, dependency.predecessor_task_id)
      const current = successorOf.get(dependency.predecessor_task_id)
      if (!current || taskById.get(current)?.estado === 'Cancelada')
        successorOf.set(dependency.predecessor_task_id, dependency.successor_task_id)
    }
    const ids = [taskId]
    const seen = new Set(ids)
    for (let id = predecessorOf.get(taskId); id && !seen.has(id); id = predecessorOf.get(id)) {
      seen.add(id)
      ids.unshift(id)
    }
    for (let id = successorOf.get(taskId); id && !seen.has(id); id = successorOf.get(id)) {
      seen.add(id)
      ids.push(id)
    }
    return ids
  }, [firmDependencies.data, taskById, taskId])
  const chainPosition = chain.indexOf(taskId) + 1
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

  const Root = embedded ? 'div' : 'main'
  const isOpen = !['Completada', 'Cancelada'].includes(task.estado)
  const run = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation()
      toast.success(success)
      return true
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
      toast.error(message || 'No se pudo guardar la tarea.')
      return false
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
  const submitSubtask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const text = formText(new FormData(form), 'subtask')
    if (!text.trim()) return
    void run(async () => {
      await addSubtask.mutateAsync({ task, texto: text })
      form.reset()
    }, 'Subtarea añadida.')
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
  const saveFields = (
    patch: Partial<Pick<TareaPersistida, 'prioridad' | 'venceEn' | 'recordarEn' | 'asignadoId'>>,
    success: string,
  ) =>
    run(
      () =>
        edit.mutateAsync({
          task,
          titulo: task.titulo,
          descripcion: task.descripcion,
          estado: task.estado,
          prioridad: task.prioridad,
          venceEn: task.venceEn,
          recordarEn: task.recordarEn,
          asignadoId: task.asignadoId,
          ...patch,
        }),
      success,
    )
  const saveDateField = (field: 'venceEn' | 'recordarEn', value: string, success: string) => {
    const next = value ? new Date(value).toISOString() : null
    if (toDateTimeLocal(next) === toDateTimeLocal(task[field])) return
    void saveFields({ [field]: next }, success)
  }
  const selectStatus = (estado: EstadoTarea) => {
    if (estado === task.estado) return
    if (estado === 'En espera') return setHoldOpen(true)
    if (estado === 'Completada') return setCompleteOpen(true)
    if (estado === 'Cancelada') return setCancelOpen(true)
    void run(() => change.mutateAsync({ task, estado }), 'Estado actualizado.')
  }
  const duplicateTask = () =>
    run(async () => {
      const copy = await create.mutateAsync({
        expedienteId: task.expedienteId,
        oportunidadId: task.oportunidadId,
        lineaId: task.lineaId,
        tipo: task.tipo,
        titulo: `${task.titulo} (copia)`,
        descripcion: task.descripcion,
        prioridad: task.prioridad,
        venceEn: task.venceEn,
        recordarEn: task.recordarEn,
        clasePlazo: task.clasePlazo,
        critico: task.critico,
        asignadoId: task.asignadoId,
        etiquetaIds: task.etiquetas.map((label) => label.id),
      })
      onOpenTask?.(copy.id)
    }, 'Tarea duplicada.')
  const copyLink = () =>
    run(
      () => navigator.clipboard.writeText(`${window.location.origin}/tareas/${task.id}`),
      'Enlace copiado.',
    )
  const canRemind = Boolean(
    isOpen && canManage && task.asignadoId && task.asignadoId !== session.user?.id,
  )
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

  const status = STATUS_META[task.estado]
  const StatusIcon = status.icon
  const doneSubtasks = task.subtareas.filter((subtask) => subtask.hecha).length
  const subtaskProgress = task.subtareas.length
    ? Math.round((doneSubtasks / task.subtareas.length) * 100)
    : 0
  const overdue = isOpen && Boolean(task.venceEn) && new Date(task.venceEn ?? '') < new Date()
  const iconLinkClass =
    'text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors'

  return (
    <Root className={embedded ? 'space-y-6' : 'mx-auto max-w-6xl space-y-6 p-6'}>
      <header className="flex items-start justify-between gap-4 border-b pb-5">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`h-6 gap-1 px-2 text-[11px] ${status.className}`}>
              <StatusIcon className="h-3 w-3" aria-hidden="true" />
              {task.estado}
            </Badge>
            <Badge variant="secondary" className="h-6 gap-1 px-2 text-[11px]">
              <Tag className="h-3 w-3" aria-hidden="true" />
              {task.tipo}
            </Badge>
            {task.relevancia !== 'normal' ? (
              <Badge
                variant={task.relevancia === 'milestone' ? 'default' : 'outline'}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                <Milestone className="h-3 w-3" aria-hidden="true" />
                {RELEVANCIA_TAREA_LABELS[task.relevancia]}
              </Badge>
            ) : null}
            {task.esSiguienteAccion ? (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary h-6 gap-1 px-2 text-[11px]"
              >
                <Star className="h-3 w-3" aria-hidden="true" />
                Siguiente acción
              </Badge>
            ) : null}
            {task.bloqueada ? (
              <Badge variant="destructive" className="h-6 gap-1 px-2 text-[11px]">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Bloqueada por dependencia
              </Badge>
            ) : null}
            {chain.length > 1 ? (
              <Badge variant="outline" className="h-6 gap-1 px-2 text-[11px]">
                <ListOrdered className="h-3 w-3" aria-hidden="true" />
                Fase {chainPosition} de {chain.length}
              </Badge>
            ) : null}
            <span className="text-muted-foreground flex items-center gap-0.5 text-[11px]">
              <Hash className="h-3 w-3" aria-hidden="true" />
              {task.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="text-foreground text-xl leading-tight font-semibold text-balance">
            {task.titulo}
          </h1>
        </div>
        <div className={`flex shrink-0 items-center gap-0.5 ${embedded ? 'mr-8' : ''}`}>
          <DropdownMenu
            trigger={
              <Button
                variant="ghost"
                aria-label="Más acciones"
                title="Más acciones"
                className="text-muted-foreground size-9 p-0"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
            placement="bottom end"
            className="w-60"
          >
            <DropdownMenuItem
              textValue="Recordar al responsable"
              isDisabled={!canRemind}
              onAction={() => setRemindOpen(true)}
            >
              <Megaphone className="h-4 w-4" aria-hidden="true" /> Recordar al responsable
            </DropdownMenuItem>
            <DropdownMenuItem
              textValue="Recordatorio"
              isDisabled={!canManage || !isOpen}
              onAction={() => setReminderOpen(true)}
            >
              <BellPlus className="h-4 w-4" aria-hidden="true" /> Recordatorio
            </DropdownMenuItem>
            <DropdownMenuItem
              textValue="Añadir siguiente tarea"
              isDisabled={!canManage || task.estado === 'Cancelada'}
              onAction={() => setNextTaskOpen(true)}
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" /> Añadir siguiente tarea
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              textValue="Duplicar"
              isDisabled={!canManage || create.isPending}
              onAction={() => void duplicateTask()}
            >
              <Copy className="h-4 w-4" aria-hidden="true" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem textValue="Copiar enlace" onAction={() => void copyLink()}>
              <Link2 className="h-4 w-4" aria-hidden="true" /> Copiar enlace
            </DropdownMenuItem>
          </DropdownMenu>
          {embedded ? (
            <Hint label="Abrir página completa">
              <Link
                to="/tareas/$taskId"
                params={{ taskId: task.id }}
                aria-label="Abrir página completa"
                className={iconLinkClass}
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Hint>
          ) : (
            <Link
              to="/tareas"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Volver a tareas
            </Link>
          )}
        </div>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          {isOpen ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {task.estado === 'Pendiente' ? (
                  <Button
                    className="gap-1.5"
                    disabled={!canWork || change.isPending || task.bloqueada}
                    onClick={() =>
                      void run(
                        () => change.mutateAsync({ task, estado: 'En curso' }),
                        'Tarea iniciada.',
                      )
                    }
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Empezar
                  </Button>
                ) : null}
                <Button
                  className="gap-1.5"
                  variant={task.estado === 'Pendiente' ? 'outline' : 'default'}
                  disabled={!canWork || task.bloqueada}
                  onClick={() => setCompleteOpen(true)}
                >
                  <CircleCheck className="h-4 w-4" aria-hidden="true" />
                  Completar
                </Button>
                <Button
                  className="gap-1.5"
                  variant="outline"
                  disabled={!canWork}
                  onClick={() => setHoldOpen(true)}
                >
                  <CirclePause className="h-4 w-4" aria-hidden="true" />
                  Poner en espera
                </Button>
                <Button
                  className="gap-1.5"
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
                  {task.esSiguienteAccion ? (
                    <StarOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Star className="h-4 w-4" aria-hidden="true" />
                  )}
                  {task.esSiguienteAccion ? 'Quitar siguiente acción' : 'Marcar siguiente acción'}
                </Button>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground gap-1.5"
                    disabled={!canWork}
                    onClick={() => setRejectOpen(true)}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    Rechazar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                    disabled={!canManage}
                    onClick={() => setCancelOpen(true)}
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Cancelar
                  </Button>
                </div>
              </div>
              {!canWork ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Solo quien encargó, la persona responsable o un administrador puede operar la
                  tarea.
                </p>
              ) : null}
            </div>
          ) : null}
          {task.estado === 'En espera' ? (
            <div className="border-warning/30 bg-warning/10 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm">
              <Hourglass
                className="text-warning-foreground mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                <strong>{task.motivoEspera}</strong> · revisión: {date(task.revisarEn)}
                {task.detalleEspera ? ` · ${task.detalleEspera}` : ''}
              </p>
            </div>
          ) : null}
          {task.resultadoCierre ? (
            <div className="border-success/30 bg-success/10 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm">
              <CircleCheck className="text-success mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                <strong>Resultado:</strong> {task.resultadoCierre}
              </p>
            </div>
          ) : null}
          <DetailSection icon={FileText} title="Encargo">
            <p
              className={`text-sm leading-6 whitespace-pre-wrap ${task.descripcion ? 'text-foreground' : 'text-muted-foreground italic'}`}
            >
              {task.descripcion || 'Sin descripción adicional.'}
            </p>
            {task.origenSubtareaDeId ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Procede de una subtarea de{' '}
                <TaskReference
                  id={task.origenSubtareaDeId}
                  title={taskById.get(task.origenSubtareaDeId)?.titulo ?? 'otra tarea'}
                  onOpenTask={onOpenTask}
                />
              </p>
            ) : null}
          </DetailSection>
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
              firmId={firmId}
              task={task}
              caseLabel={caseNames.get(task.expedienteId ?? '')}
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
          <TaskCommunications firmId={firmId} task={task} canWork={canWork} />
          <DetailSection
            icon={ListChecks}
            title="Subtareas"
            aside={
              task.subtareas.length ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {doneSubtasks}/{task.subtareas.length} completadas
                </span>
              ) : null
            }
          >
            {task.subtareas.length ? (
              <div
                className="bg-muted h-1 overflow-hidden rounded-full"
                aria-hidden="true"
              >
                <div
                  className="bg-success h-full transition-all"
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>
            ) : null}
            <div className="-mx-2">
              {task.subtareas.map((subtask) => (
                <div
                  key={subtask.id}
                  className="group hover:bg-muted/60 flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      aria-label={subtask.texto}
                      checked={subtask.hecha}
                      disabled={!canWork || !isOpen || setSubtaskDone.isPending}
                      className="accent-primary mt-0.5 size-4 shrink-0"
                      onChange={(event) =>
                        void run(
                          () =>
                            setSubtaskDone.mutateAsync({
                              task,
                              subtaskId: subtask.id,
                              completed: event.currentTarget.checked,
                            }),
                          'Subtarea actualizada.',
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span
                        className={`block ${subtask.hecha ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {subtask.texto}
                      </span>
                    </span>
                  </label>
                  {subtask.convertidaEnId ? (
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                      Convertida en
                      <TaskReference
                        id={subtask.convertidaEnId}
                        title={taskById.get(subtask.convertidaEnId)?.titulo ?? 'tarea'}
                        onOpenTask={onOpenTask}
                        className="max-w-40"
                      />
                    </span>
                  ) : canWork ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Convertir en tarea: ${subtask.texto}`}
                      className="text-muted-foreground h-6 shrink-0 px-2 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => setConvertingSubtask(subtask)}
                    >
                      Convertir en tarea
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {!task.subtareas.length ? (
              <p className="text-muted-foreground text-sm">Aún no hay subtareas.</p>
            ) : null}
            {isOpen ? (
              <form className="flex items-center gap-2" onSubmit={submitSubtask}>
                <Input
                  name="subtask"
                  aria-label="Nueva subtarea"
                  required
                  maxLength={300}
                  disabled={!canWork || addSubtask.isPending}
                  placeholder="Añadir subtarea…"
                  className="h-9"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!canWork || addSubtask.isPending}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Añadir
                </Button>
              </form>
            ) : null}
          </DetailSection>
          <DetailSection icon={MessageSquare} title="Conversación">
            {(messages.data ?? []).length ? (
              <div className="space-y-4">
                {(messages.data ?? []).map((message) => {
                  const author = memberNames.get(message.author_id ?? '') ?? 'Sistema'
                  const isReminder = message.body.startsWith(REMINDER_PREFIX)
                  return (
                    <article key={message.id} className="flex gap-3 text-sm">
                      <span
                        aria-hidden="true"
                        className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      >
                        {initialsOf(author) || '·'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="text-foreground font-medium">{author}</span>
                          <span className="text-muted-foreground">{date(message.created_at)}</span>
                        </p>
                        {isReminder ? (
                          <p className="mt-1 flex items-start gap-1.5">
                            <Badge
                              variant="outline"
                              className="h-5 shrink-0 gap-1 px-1.5 text-[10px]"
                            >
                              <BellRing className="h-3 w-3" aria-hidden="true" />
                              Recordatorio
                            </Badge>
                            <span>{message.body.slice(REMINDER_PREFIX.length)}</span>
                          </p>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Todavía no hay mensajes.</p>
            )}
            <form
              className="focus-within:ring-ring/40 rounded-lg border focus-within:ring-2"
              onSubmit={submitMessage}
            >
              <Textarea
                name="message"
                aria-label="Mensaje"
                required
                disabled={!canWork}
                placeholder="Escribe una actualización…"
                className="min-h-16 resize-none border-0 shadow-none focus-visible:ring-0"
              />
              <div className="flex justify-end px-2 pb-2">
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5"
                  disabled={!canWork || addMessage.isPending}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Enviar mensaje
                </Button>
              </div>
            </form>
          </DetailSection>
          <DetailSection icon={Paperclip} title="Documentos vinculados">
            {documents.data?.length ? (
              <div className="-mx-2">
                {documents.data.map((document) => (
                  <div
                    key={document.id}
                    className="group hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors"
                  >
                    <FileText
                      className="text-muted-foreground h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <Link to="/documentos" className="min-w-0 flex-1 truncate hover:underline">
                      {document.original_name}
                    </Link>
                    <span className="text-muted-foreground text-xs">v{document.version}</span>
                    <Hint label="Desvincular">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Desvincular ${document.original_name}`}
                        className="text-muted-foreground hover:text-destructive size-7 p-0"
                        disabled={!canManage || unlinkDocument.isPending}
                        onClick={() =>
                          void run(
                            () => unlinkDocument.mutateAsync(document.id),
                            'Documento desvinculado.',
                          )
                        }
                      >
                        <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </Hint>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No hay documentos vinculados.</p>
            )}
            {task.expedienteId ? (
              <form className="flex items-center gap-2" onSubmit={submitDocumentLink}>
                <select
                  name="document"
                  aria-label="Documento para vincular"
                  defaultValue=""
                  disabled={!canManage || !availableDocuments.length}
                  className={`${selectClass} min-w-0 flex-1`}
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
                  className="gap-1.5"
                  disabled={!canManage || linkDocument.isPending}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Vincular
                </Button>
              </form>
            ) : null}
          </DetailSection>
        </div>
        <aside className="space-y-6 lg:border-l lg:pl-6">
          <div className="space-y-1" key={task.version}>
            <PropertyRow icon={UserRound} label="Asignada a" htmlFor="task-quick-assignee">
              <select
                id="task-quick-assignee"
                className={inlineFieldClass}
                value={task.asignadoId ?? ''}
                disabled={!canManage || !isOpen || edit.isPending}
                onChange={(event) =>
                  void saveFields(
                    { asignadoId: event.target.value || null },
                    'Responsable actualizado.',
                  )
                }
              >
                <option value="">Sin asignar</option>
                {(members.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nombre}
                  </option>
                ))}
              </select>
            </PropertyRow>
            <PropertyRow icon={StatusIcon} label="Estado" htmlFor="task-quick-status">
              <select
                id="task-quick-status"
                className={inlineFieldClass}
                value={task.estado}
                disabled={!canWork || !isOpen || change.isPending}
                onChange={(event) => selectStatus(event.target.value as EstadoTarea)}
              >
                {TASK_STATES.map((state) => (
                  <option
                    key={state}
                    value={state}
                    disabled={
                      (state === 'Cancelada' && !canManage) ||
                      (state === 'Completada' && task.bloqueada) ||
                      (state === 'En curso' && task.bloqueada)
                    }
                  >
                    {state}
                  </option>
                ))}
              </select>
            </PropertyRow>
            <PropertyRow icon={CalendarClock} label="Vencimiento" htmlFor="task-quick-due">
              <Input
                id="task-quick-due"
                type="datetime-local"
                className={`${inlineFieldClass} ${overdue ? 'text-destructive font-medium' : ''}`}
                defaultValue={toDateTimeLocal(task.venceEn)}
                disabled={!canManage || !isOpen || edit.isPending}
                onBlur={(event) =>
                  saveDateField('venceEn', event.target.value, 'Vencimiento actualizado.')
                }
              />
            </PropertyRow>
            <PropertyRow icon={BellRing} label="Recordatorio" htmlFor="task-quick-reminder">
              <Input
                id="task-quick-reminder"
                type="datetime-local"
                className={inlineFieldClass}
                defaultValue={toDateTimeLocal(task.recordarEn)}
                disabled={!canManage || !isOpen || edit.isPending}
                onBlur={(event) =>
                  saveDateField('recordarEn', event.target.value, 'Recordatorio actualizado.')
                }
              />
            </PropertyRow>
            <PropertyRow icon={Flag} label="Prioridad" htmlFor="task-quick-priority">
              <select
                id="task-quick-priority"
                className={inlineFieldClass}
                value={task.prioridad}
                disabled={!canManage || !isOpen || edit.isPending}
                onChange={(event) =>
                  void saveFields(
                    { prioridad: event.target.value as TareaPersistida['prioridad'] },
                    'Prioridad actualizada.',
                  )
                }
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </PropertyRow>
            <PropertyRow icon={Tag} label="Etiquetas">
              <div className="flex min-h-8 flex-wrap items-center gap-1 px-2">
                {task.etiquetas.length ? (
                  task.etiquetas.map((label) => (
                    <Badge key={label.id} variant="outline" className="h-5 px-1.5 text-[11px]">
                      {label.nombre}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">Sin etiquetas</span>
                )}
              </div>
            </PropertyRow>
            {!canManage ? (
              <p className="text-muted-foreground flex items-start gap-1.5 pt-2 text-xs">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                Solo quien encargó o un administrador puede cambiar responsable, plazo y prioridad.
              </p>
            ) : null}
          </div>
          <dl className="space-y-2.5 border-t pt-5 text-sm">
            {[
              {
                icon: UserPen,
                label: 'Encargada por:',
                value: memberNames.get(task.creadaPorId ?? '') ?? 'Sistema',
              },
              {
                icon: Eye,
                label: 'Acuse de recibo:',
                value: task.abiertaEn
                  ? `Abierta el ${date(task.abiertaEn)}`
                  : 'Todavía no abierta por el responsable',
              },
              {
                icon: BriefcaseBusiness,
                label: 'Expediente:',
                value: caseNames.get(task.expedienteId ?? '') ?? 'Lead vinculado',
              },
              {
                icon: Hourglass,
                label: 'Espera:',
                value:
                  task.estado === 'En espera'
                    ? `${task.motivoEspera ?? 'Sin motivo'} · revisión ${date(task.revisarEn)}`
                    : '—',
              },
              {
                icon: Star,
                label: 'Siguiente acción:',
                value: task.esSiguienteAccion ? 'Sí' : 'No',
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <Icon
                  className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="wrap-break-word">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
          {chain.length > 1 ? (
            <DetailSection
              icon={ListOrdered}
              title="Cadena de tareas"
              aside={
                canManage && task.estado !== 'Cancelada' ? (
                  <Hint label="Añadir siguiente tarea">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Añadir siguiente tarea"
                      className="text-muted-foreground size-7 p-0"
                      onClick={() => setNextTaskOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </Hint>
                ) : null
              }
            >
              <ol className="space-y-1 text-sm">
                {chain.map((id, index) => {
                  const phase = taskById.get(id)
                  const title = phase?.titulo ?? 'Tarea no disponible'
                  const state =
                    phase?.bloqueada && !['Completada', 'Cancelada'].includes(phase.estado)
                      ? 'Bloqueada'
                      : (phase?.estado ?? '—')
                  const assignee = phase?.asignadoId ? memberNames.get(phase.asignadoId) : null
                  return (
                    <li
                      key={id}
                      className={`-mx-2 flex items-center gap-2 rounded-md px-2 py-1 ${id === task.id
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground'
                        }`}
                    >
                      <span className="w-5 shrink-0 text-xs tabular-nums">{index + 1}.</span>
                      {id === task.id || !phase ? (
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                      ) : onOpenTask ? (
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left hover:underline"
                          onClick={() => onOpenTask(id)}
                        >
                          {title}
                        </button>
                      ) : (
                        <Link
                          to="/tareas/$taskId"
                          params={{ taskId: id }}
                          className="min-w-0 flex-1 truncate hover:underline"
                        >
                          {title}
                        </Link>
                      )}
                      {assignee ? (
                        <span className="max-w-24 shrink-0 truncate text-xs">{assignee}</span>
                      ) : null}
                      <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
                        {state}
                      </Badge>
                    </li>
                  )
                })}
              </ol>
            </DetailSection>
          ) : null}
          <DetailSection icon={GitBranch} title="Dependencias">
            <div className="space-y-1 text-sm">
              {predecessors.map((dependency) => (
                <div
                  key={dependency.id}
                  className="hover:bg-muted/60 -mx-2 flex items-center gap-2 rounded-md px-2 py-1 transition-colors"
                >
                  <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {onOpenTask ? (
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left hover:underline"
                      onClick={() => onOpenTask(dependency.predecessor_task_id)}
                    >
                      {taskById.get(dependency.predecessor_task_id)?.titulo ??
                        'Antecedente no disponible'}
                    </button>
                  ) : (
                    <Link
                      to="/tareas/$taskId"
                      params={{ taskId: dependency.predecessor_task_id }}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {taskById.get(dependency.predecessor_task_id)?.titulo ??
                        'Antecedente no disponible'}
                    </Link>
                  )}
                  <Hint label="Quitar dependencia">
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="Quitar dependencia"
                      className="text-muted-foreground hover:text-destructive size-7 p-0"
                      disabled={!canManage || removeDependency.isPending}
                      onClick={() =>
                        void run(
                          () => removeDependency.mutateAsync(dependency.id),
                          'Dependencia eliminada.',
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </Hint>
                </div>
              ))}
              {successors.map((dependency) => (
                <p key={dependency.id} className="text-muted-foreground flex items-center gap-2">
                  <Play className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    Desbloquea:{' '}
                    <span className="text-foreground">
                      {taskById.get(dependency.successor_task_id)?.titulo ?? 'Tarea no disponible'}
                    </span>
                  </span>
                </p>
              ))}
              {!predecessors.length && !successors.length ? (
                <p className="text-muted-foreground">Sin dependencias.</p>
              ) : null}
            </div>
            <form className="flex items-center gap-2" onSubmit={submitDependency}>
              <Label htmlFor="task-predecessor" className="sr-only">
                Añadir antecedente
              </Label>
              <select
                id="task-predecessor"
                name="predecessor"
                aria-label="Tarea antecedente"
                defaultValue=""
                disabled={!canManage}
                className={`${selectClass} min-w-0 flex-1`}
              >
                <option value="">Añadir antecedente…</option>
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
              <Hint label="Añadir dependencia">
                <Button
                  type="submit"
                  variant="outline"
                  aria-label="Añadir dependencia"
                  className="size-9 shrink-0 p-0"
                  disabled={!canManage || addDependency.isPending}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Hint>
            </form>
          </DetailSection>
        </aside>
      </div>
      {convertingSubtask ? (
        <TaskCreateDialog
          open
          onOpenChange={(next) => {
            if (!next) setConvertingSubtask(null)
          }}
          firmId={firmId}
          expedienteId={task.expedienteId}
          oportunidadId={task.oportunidadId}
          lineaId={task.lineaId}
          title="Convertir subtarea en tarea"
          description={`La subtarea quedará vinculada a la nueva tarea y ésta, a «${task.titulo}».`}
          defaultTitle={convertingSubtask.texto}
          defaultDescription={`Procede de una subtarea de «${task.titulo}».`}
          defaultAssigneeId={task.asignadoId}
          members={members.data ?? []}
          pending={create.isPending || convertSubtask.isPending}
          successMessage="Subtarea convertida en tarea."
          onCreate={async (input) => {
            const created = await create.mutateAsync(input)
            await convertSubtask.mutateAsync({
              task,
              subtaskId: convertingSubtask.id,
              convertedTaskId: created.id,
            })
          }}
        />
      ) : null}
      <NextTaskDialog
        open={nextTaskOpen}
        onOpenChange={setNextTaskOpen}
        pending={addNextTask.isPending}
        members={members.data ?? []}
        defaultAssigneeId={task.asignadoId}
        onSubmit={(input) => {
          void run(async () => {
            await addNextTask.mutateAsync({ task, ...input })
            setNextTaskOpen(false)
          }, 'Siguiente fase encadenada.')
        }}
      />
      <TaskHoldDialog
        open={holdOpen}
        onOpenChange={setHoldOpen}
        pending={hold.isPending}
        taskTitle={task.titulo}
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
        pending={complete.isPending}
        onSubmit={(resultado, continuidad, relevancia) => {
          void run(async () => {
            await complete.mutateAsync(
              continuidad
                ? { task, resultado, continuidad, relevancia }
                : { task, resultado, relevancia },
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
      <RemindAssigneeDialog
        open={remindOpen}
        onOpenChange={setRemindOpen}
        pending={addMessage.isPending}
        assigneeName={memberNames.get(task.asignadoId ?? '') ?? 'el responsable'}
        onSubmit={(message) => {
          void run(async () => {
            await addMessage.mutateAsync(`${REMINDER_PREFIX}${message}`)
            setRemindOpen(false)
          }, 'Recordatorio enviado al responsable.')
        }}
      />
      <TaskReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        pending={edit.isPending}
        current={task.recordarEn}
        onSubmit={(recordarEn) => {
          void saveFields(
            { recordarEn },
            recordarEn ? 'Recordatorio creado.' : 'Recordatorio eliminado.',
          ).then((saved) => {
            if (saved) setReminderOpen(false)
          })
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
    </Root>
  )
}

function TaskCompleteDialog({
  open,
  onOpenChange,
  nextAction,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nextAction: boolean
  pending: boolean
  onSubmit: (
    result: string,
    continuity: 'create_next_task' | 'close_without_continuity' | undefined,
    relevance: RelevanciaTarea,
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
      (formText(data, 'relevance') || 'normal') as RelevanciaTarea,
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
            Relevancia
            <select
              name="relevance"
              defaultValue="normal"
              className="border-input bg-background h-10 w-full rounded-md border px-3"
            >
              <option value="normal">Tarea normal</option>
              <option value="activity">Actuación</option>
              <option value="milestone">Hito histórico</option>
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

function TaskReference({
  id,
  title,
  onOpenTask,
  className = '',
}: {
  id: string
  title: string
  onOpenTask?: ((taskId: string) => void) | undefined
  className?: string
}) {
  const classes = `text-foreground truncate font-medium hover:underline ${className}`
  return onOpenTask ? (
    <button type="button" className={`${classes} text-left`} onClick={() => onOpenTask(id)}>
      {title}
    </button>
  ) : (
    <Link to="/tareas/$taskId" params={{ taskId: id }} className={classes}>
      {title}
    </Link>
  )
}

function NextTaskDialog({
  open,
  onOpenChange,
  pending,
  members,
  defaultAssigneeId,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  members: { id: string; nombre: string }[]
  defaultAssigneeId: string | null
  onSubmit: (input: Omit<SiguienteTareaInput, 'task'>) => void
}) {
  const [dueMode, setDueMode] = useState<'dias' | 'fija' | 'sin'>('dias')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const time = formText(data, 'next-time') || '18:00'
    const day = formText(data, 'next-date')
    onSubmit({
      titulo: formText(data, 'next-title'),
      descripcion: formText(data, 'next-description'),
      prioridad: formText(data, 'next-priority') as TareaPersistida['prioridad'],
      asignadoId: formText(data, 'next-assignee') || null,
      venceEn: dueMode === 'fija' && day ? new Date(`${day}T${time}:00`).toISOString() : null,
      diasTrasAnterior: dueMode === 'dias' ? Number(formText(data, 'next-days')) || 7 : null,
      horaLimite: dueMode === 'dias' ? time : null,
    })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Añadir siguiente tarea</DialogTitle>
          <DialogDescription>
            La nueva fase queda bloqueada y se activa automáticamente al completarse la anterior. El
            plazo puede fijarse por fecha o contarse desde el cierre de la fase previa.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="next-task-title">Título</Label>
            <Input id="next-task-title" name="next-title" required autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="next-task-assignee">Asignada a</Label>
            <select
              id="next-task-assignee"
              name="next-assignee"
              defaultValue={defaultAssigneeId ?? ''}
              className={selectClass}
            >
              <option value="">Sin asignar</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="next-task-priority">Prioridad</Label>
            <select
              id="next-task-priority"
              name="next-priority"
              defaultValue="Media"
              className={selectClass}
            >
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="next-task-due-mode">Cálculo del plazo</Label>
            <select
              id="next-task-due-mode"
              value={dueMode}
              onChange={(event) => setDueMode(event.target.value as typeof dueMode)}
              className={selectClass}
            >
              <option value="dias">Días desde el cierre de la anterior</option>
              <option value="fija">Fecha fija</option>
              <option value="sin">Sin plazo definido</option>
            </select>
          </div>
          {dueMode === 'dias' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="next-task-days">Días</Label>
              <Input
                id="next-task-days"
                name="next-days"
                type="number"
                min={1}
                max={365}
                defaultValue={7}
              />
            </div>
          ) : null}
          {dueMode === 'fija' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="next-task-date">Vencimiento</Label>
              <Input id="next-task-date" name="next-date" type="date" required />
            </div>
          ) : null}
          {dueMode !== 'sin' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="next-task-time">Hora límite</Label>
              <Input id="next-task-time" name="next-time" type="time" defaultValue="18:00" />
            </div>
          ) : null}
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="next-task-description">Mensaje inicial</Label>
            <Textarea id="next-task-description" name="next-description" rows={3} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <ListOrdered className="h-4 w-4" aria-hidden="true" /> Encadenar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemindAssigneeDialog({
  open,
  onOpenChange,
  pending,
  assigneeName,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  assigneeName: string
  onSubmit: (message: string) => void
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = formText(new FormData(event.currentTarget), 'remind-message').trim()
    onSubmit(message || '¿Puedes confirmar el estado de esta tarea?')
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Recordar al responsable</DialogTitle>
          <DialogDescription>
            Se avisa a {assigneeName}: el mensaje se añade a la conversación y queda en el
            histórico. El estado de la tarea no cambia.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="task-remind-message">Mensaje</Label>
            <Textarea
              id="task-remind-message"
              name="remind-message"
              rows={3}
              placeholder="¿Puedes confirmar el estado de esta tarea?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <Megaphone className="h-4 w-4" aria-hidden="true" /> Recordar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const defaultReminderAt = () => {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  date.setHours(9, 0, 0, 0)
  return date.toISOString()
}

function TaskReminderDialog({
  open,
  onOpenChange,
  pending,
  current,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  current: string | null
  onSubmit: (reminderAt: string | null) => void
}) {
  const initial = toDateTimeLocal(current ?? defaultReminderAt())
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const day = formText(data, 'reminder-date')
    const time = formText(data, 'reminder-time') || '09:00'
    if (!day) return
    onSubmit(new Date(`${day}T${time}:00`).toISOString())
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{current ? 'Editar recordatorio' : 'Nuevo recordatorio'}</DialogTitle>
          <DialogDescription>
            El recordatorio no es una tarea nueva: se guarda en este encargo y avisa al responsable
            en la fecha indicada.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="task-reminder-date">Fecha</Label>
            <Input
              id="task-reminder-date"
              name="reminder-date"
              type="date"
              required
              defaultValue={initial.slice(0, 10)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-reminder-time">Hora</Label>
            <Input
              id="task-reminder-time"
              name="reminder-time"
              type="time"
              defaultValue={initial.slice(11, 16)}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            {current ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => onSubmit(null)}
              >
                Quitar recordatorio
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              <BellPlus className="h-4 w-4" aria-hidden="true" /> Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SpecialMeetingWorkspace({
  firmId,
  task,
  caseLabel,
  members,
  participants,
  actorId,
  canManage,
  canWork,
  pending,
  onSave,
}: {
  firmId: string | undefined
  task: TareaPersistida
  caseLabel: string | undefined
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
  const formRef = useRef<HTMLFormElement>(null)
  const pickMeetingDay = (day: Date) => {
    const form = formRef.current
    const startInput = form?.elements.namedItem('specialStartsAt')
    const endInput = form?.elements.namedItem('specialEndsAt')
    const durationInput = form?.elements.namedItem('specialDuration')
    if (!(startInput instanceof HTMLInputElement) || !(endInput instanceof HTMLInputElement)) return
    const pad = (value: number) => String(value).padStart(2, '0')
    const dayText = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
    const time = startInput.value.slice(11, 16) || '10:00'
    const minutes =
      durationInput instanceof HTMLInputElement ? Number(durationInput.value) || 60 : 60
    const start = new Date(`${dayText}T${time}`)
    const end = new Date(start.getTime() + minutes * 60_000)
    startInput.value = `${dayText}T${time}`
    endInput.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`
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
        <form ref={formRef} className="space-y-4" onSubmit={submit}>
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
            <div className="space-y-1.5 sm:col-span-2">
              <p className="text-sm font-medium">Con quién</p>
              <MeetingAttendeesPicker
                key={task.version}
                firmId={firmId}
                caseParticipants={participants}
                members={members}
                contactsName="specialContacts"
                usersName="specialUsers"
                defaultContactIds={contactIds}
                defaultUserIds={userIds}
                disabled={!canManage}
              />
            </div>
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
          {['preparation', 'scheduled'].includes(status) ? (
            <section className="space-y-3 border-t pt-4">
              <h3 className="font-medium">Calendario</h3>
              <MeetingCalendarPanel
                firmId={firmId}
                taskId={task.id}
                disabled={!canManage}
                initialDate={
                  detailsText(details, 'startsAt') ? new Date(detailsText(details, 'startsAt')) : null
                }
                onPickDay={pickMeetingDay}
              />
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
        <MeetingInternalNotes
          firmId={firmId}
          task={task}
          caseLabel={caseLabel}
          contactIds={contactIds}
          canWork={canWork}
        />
        {notes.length ? (
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Notas anteriores del historial</h3>
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
