import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import {
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  GripVertical,
  Link2,
  PanelRightOpen,
  Play,
  Search,
  ShieldAlert,
  Milestone,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react'
import {
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type MouseEventHandler,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader, ViewSwitch } from '@/components/common'
import {
  specialMeetingCreationIssue,
  TaskCreateDialog,
  taskLabelClass,
} from '@/components/tareas/task-create-dialog'
import { TaskHoldDialog } from '@/components/tareas/task-hold-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  RELEVANCIA_TAREA_LABELS,
  useCambiarEstadoTarea,
  useCapturarInboxTarea,
  useCrearTarea,
  useEditarTarea,
  useEtiquetasTarea,
  useInboxTareas,
  useMoverInboxTarea,
  usePonerTareaEnEspera,
  useReordenarTableroTareas,
  useTareasPersistentes,
  useValidarPlazo,
  type CrearTareaInput,
  type RelevanciaTarea,
  type TaskInboxItemRow,
  type TareaPersistida,
} from '@/features/tareas'
import { TaskDetailDialog } from '@/features/tareas/ui/task-detail-dialog'

type TaskView = 'calendar' | 'kanban' | 'list'
type TaskFilterStatus = 'all' | TareaPersistida['estado']
type TaskBoardColumnId = 'pending' | 'in-progress' | 'waiting'
type TaskScope = 'mine' | 'delegated' | 'all' | 'administration'

const INBOX_STAGE_LABELS: Record<TaskInboxItemRow['stage'], string> = {
  inbox: 'INBOX',
  clarify: 'Aclarar',
  delegate: 'Delegar',
  next: 'Siguiente',
  now: 'Ahora',
  waiting: 'En espera',
  weekly_review: 'Revisión semanal',
}

const AGENDA_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const AGENDA_START_HOUR = 8
const AGENDA_END_HOUR = 20
const AGENDA_HOURS = Array.from(
  { length: AGENDA_END_HOUR - AGENDA_START_HOUR },
  (_, index) => index + AGENDA_START_HOUR,
)
const CALENDAR_HOUR_HEIGHT = 80
const CALENDAR_EVENT_DURATION_MINUTES = 50

export type CalendarEventLayout = {
  task: TareaPersistida
  top: number
  height: number
  column: number
  columnCount: number
}

const TASK_BOARD_COLUMNS: ReadonlyArray<{
  id: TaskBoardColumnId
  title: string
  description: string
}> = [
    { id: 'pending', title: 'Pendiente', description: 'Trabajo por iniciar' },
    { id: 'in-progress', title: 'En curso', description: 'Trabajo activo' },
    { id: 'waiting', title: 'En espera', description: 'Pendientes de una respuesta o revisión' },
  ]

const TASK_PRIORITY_CLASS: Record<TareaPersistida['prioridad'], string> = {
  Alta: 'border-destructive/30 bg-destructive/10 text-destructive',
  Media: 'border-warning/30 bg-warning/10 text-warning-foreground',
  Baja: 'border-border bg-secondary text-secondary-foreground',
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

function TaskIconHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function TaskIconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
}) {
  return (
    <TaskIconHint label={label}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="text-muted-foreground hover:text-foreground size-8 p-0"
      >
        {icon}
      </Button>
    </TaskIconHint>
  )
}

const formatTaskDate = (value: string | null) => {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replace(',', '')
}

function taskDateValue(value: string | null) {
  const timestamp = value ? Date.parse(value) : Number.POSITIVE_INFINITY
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

export { specialMeetingCreationIssue }

/** Orden cronológico estable para que las acciones más próximas nunca queden ocultas. */
export function sortTasksForAgenda(tasks: TareaPersistida[]) {
  return [...tasks].sort((first, second) => {
    const dueDifference = taskDateValue(first.venceEn) - taskDateValue(second.venceEn)
    if (dueDifference) return dueDifference
    if (first.critico !== second.critico) return first.critico ? -1 : 1
    const priorityDifference =
      ({ Alta: 0, Media: 1, Baja: 2 }[first.prioridad] ?? 3) -
      ({ Alta: 0, Media: 1, Baja: 2 }[second.prioridad] ?? 3)
    if (priorityDifference) return priorityDifference
    return first.titulo.localeCompare(second.titulo, 'es')
  })
}

function weekStart(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return date
}

function shiftWeek(value: Date, amount: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount * 7)
  return date
}

function calendarDateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function calendarSlotHour(value: string) {
  const hour = new Date(value).getHours()
  return Math.min(Math.max(hour, AGENDA_START_HOUR), AGENDA_END_HOUR - 1)
}

/** Distribuye los eventos solapados en columnas, como una agenda semanal. */
export function layoutCalendarEvents(tasks: TareaPersistida[]): CalendarEventLayout[] {
  const startOfDay = AGENDA_START_HOUR * 60
  const endOfDay = AGENDA_END_HOUR * 60
  const events = tasks
    .filter((task): task is TareaPersistida & { venceEn: string } => Boolean(task.venceEn))
    .map((task) => {
      const date = new Date(task.venceEn)
      const minutes = date.getHours() * 60 + date.getMinutes()
      const start = Math.min(Math.max(minutes, startOfDay), endOfDay - 1)
      const reunion =
        task.reunion && typeof task.reunion === 'object' && !Array.isArray(task.reunion)
          ? task.reunion
          : {}
      const meetingStartsAt = reunion['startsAt']
      const meetingEndsAt = reunion['endsAt']
      const actualMeetingDuration =
        task.tipo === 'Evento' &&
          reunion['specialType'] === 'meeting' &&
          typeof meetingStartsAt === 'string' &&
          typeof meetingEndsAt === 'string'
          ? (Date.parse(meetingEndsAt) - Date.parse(meetingStartsAt)) / 60_000
          : Number.NaN
      const displayDuration =
        Number.isFinite(actualMeetingDuration) && actualMeetingDuration > 0
          ? Math.max(CALENDAR_EVENT_DURATION_MINUTES, Math.ceil(actualMeetingDuration))
          : CALENDAR_EVENT_DURATION_MINUTES
      const end = Math.min(start + displayDuration, endOfDay)
      return {
        task,
        start,
        end,
        height: Math.max(
          CALENDAR_EVENT_DURATION_MINUTES - 4,
          ((end - start) / 60) * CALENDAR_HOUR_HEIGHT - 4,
        ),
      }
    })
    .sort(
      (first, second) =>
        first.start - second.start || first.task.titulo.localeCompare(second.task.titulo, 'es'),
    )

  const layouts: Array<CalendarEventLayout & { end: number; group: number }> = []
  let group = -1
  let groupEnd = -1

  for (const event of events) {
    if (event.start >= groupEnd) {
      group += 1
      groupEnd = event.end
    } else {
      groupEnd = Math.max(groupEnd, event.end)
    }
    const occupiedColumns = new Set(
      layouts
        .filter((item) => item.group === group && item.end > event.start)
        .map((item) => item.column),
    )
    let column = 0
    while (occupiedColumns.has(column)) column += 1
    layouts.push({
      task: event.task,
      top: ((event.start - startOfDay) / 60) * CALENDAR_HOUR_HEIGHT,
      height: event.height,
      column,
      columnCount: 1,
      end: event.end,
      group,
    })
  }

  for (const item of layouts) {
    item.columnCount = Math.max(
      ...layouts
        .filter((candidate) => candidate.group === item.group)
        .map((candidate) => candidate.column + 1),
    )
  }
  return layouts.map(({ end: _end, group: _group, ...layout }) => layout)
}

export function taskBoardColumn(task: TareaPersistida): TaskBoardColumnId | null {
  if (task.estado === 'Pendiente') return 'pending'
  if (task.estado === 'En curso') return 'in-progress'
  if (task.estado === 'En espera') return 'waiting'
  return null
}

export function taskStatusForBoardColumn(
  column: TaskBoardColumnId,
): TareaPersistida['estado'] | null {
  if (column === 'pending') return 'Pendiente'
  if (column === 'in-progress') return 'En curso'
  return null
}

export function canMoveTaskInBoard(task: TareaPersistida, target: TaskBoardColumnId) {
  const current = taskBoardColumn(task)
  return Boolean(current && current !== target)
}

export function reorderTasksWithFilteredItems(completeOrder: string[], visibleOrder: string[]) {
  const visible = new Set(visibleOrder)
  let nextVisibleIndex = 0
  return completeOrder.map((id) => (visible.has(id) ? visibleOrder[nextVisibleIndex++] : id))
}

export type TaskWorkspaceProps = {
  expedienteId?: string | undefined
  expedienteLabel?: string | undefined
  defaultAssigneeId?: string | null
  titleTemplates?: string[]
}

export function TaskWorkspace({
  expedienteId,
  expedienteLabel,
  defaultAssigneeId = null,
  titleTemplates = [],
}: TaskWorkspaceProps = {}) {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const labels = useEtiquetasTarea(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const change = useCambiarEstadoTarea(firmId)
  const hold = usePonerTareaEnEspera(firmId)
  const edit = useEditarTarea(firmId)
  const validate = useValidarPlazo(firmId)
  const inbox = useInboxTareas(firmId, session.user?.id)
  const captureInbox = useCapturarInboxTarea(firmId, session.user?.id)
  const moveInbox = useMoverInboxTarea(firmId, session.user?.id)
  const reorderBoard = useReordenarTableroTareas(firmId)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CrearTareaInput['tipo']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TareaPersistida['prioridad']>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<TaskFilterStatus>('all')
  const [labelFilter, setLabelFilter] = useState('all')
  const [relevanceFilter, setRelevanceFilter] = useState<
    'all' | Exclude<RelevanciaTarea, 'normal'>
  >('all')
  const [scope, setScope] = useState<TaskScope>(expedienteId ? 'all' : 'mine')
  const [onlyNextActions, setOnlyNextActions] = useState(false)
  const [view, setView] = useState<TaskView>('kanban')
  const [calendarWeek, setCalendarWeek] = useState(() => weekStart(new Date()))
  const [calendarEditTask, setCalendarEditTask] = useState<TareaPersistida | null>(null)
  const caseNames = useMemo(
    () =>
      new Map((cases.data ?? []).map((item) => [item.id, `${item.referencia} · ${item.titulo}`])),
    [cases.data],
  )
  const memberNames = useMemo(
    () => new Map((members.data ?? []).map((member) => [member.id, member.nombre])),
    [members.data],
  )

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando agenda" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel title="Agenda no disponible" description="Necesitas una membresía activa." />
    )
  if (
    tasks.isPending ||
    labels.isPending ||
    cases.isPending ||
    members.isPending ||
    inbox.isPending
  )
    return <PendingPanel title="Cargando agenda" description="Consultando tareas y plazos…" />
  if (tasks.isError || labels.isError || cases.isError || members.isError || inbox.isError)
    return (
      <PendingPanel
        title="No se pudo cargar la agenda"
        description="Reintenta en unos instantes."
      />
    )

  const canValidate = membership.data?.role !== 'paralegal'
  const canEditTasks = membership.data?.role !== 'paralegal'
  const allTasks = tasks.data ?? []
  const scopedTasks = expedienteId
    ? allTasks.filter((task) => task.expedienteId === expedienteId)
    : allTasks
  const visible = scopedTasks.filter((task) => {
    const searchable =
      `${task.titulo} ${task.descripcion} ${task.tipo} ${task.etiquetas.map((label) => label.nombre).join(' ')} ${caseNames.get(task.expedienteId ?? '') ?? ''}`.toLowerCase()
    const matchesStatus = statusFilter === 'all' || task.estado === statusFilter
    return (
      (scope === 'all' ||
        (scope === 'mine' && task.asignadoId === session.user?.id) ||
        (scope === 'delegated' &&
          task.creadaPorId === session.user?.id &&
          task.asignadoId !== session.user?.id) ||
        (scope === 'administration' &&
          ['owner', 'admin', 'lawyer'].includes(membership.data?.role ?? ''))) &&
      (!query.trim() || searchable.includes(query.trim().toLowerCase())) &&
      (typeFilter === 'all' || task.tipo === typeFilter) &&
      (priorityFilter === 'all' || task.prioridad === priorityFilter) &&
      (assigneeFilter === 'all' ||
        (assigneeFilter === '' ? !task.asignadoId : task.asignadoId === assigneeFilter)) &&
      (labelFilter === 'all' || task.etiquetas.some((label) => label.id === labelFilter)) &&
      (relevanceFilter === 'all' || task.relevancia === relevanceFilter) &&
      (!onlyNextActions || task.esSiguienteAccion) &&
      matchesStatus
    )
  })
  const orderedVisible =
    view === 'kanban'
      ? [...visible].sort(
        (a, b) =>
          (a.boardPosition ?? Number.MAX_SAFE_INTEGER) -
          (b.boardPosition ?? Number.MAX_SAFE_INTEGER) ||
          a.titulo.localeCompare(b.titulo, 'es'),
      )
      : sortTasksForAgenda(visible)
  const activeFilterCount = [
    typeFilter,
    priorityFilter,
    assigneeFilter,
    statusFilter,
    labelFilter,
    relevanceFilter,
    onlyNextActions,
  ].filter((value) => value !== 'all' && value !== false).length
  const clearFilters = () => {
    setTypeFilter('all')
    setPriorityFilter('all')
    setAssigneeFilter('all')
    setStatusFilter('all')
    setLabelFilter('all')
    setRelevanceFilter('all')
    setOnlyNextActions(false)
  }
  const changeStatus = async (task: TareaPersistida, estado: TareaPersistida['estado']) => {
    try {
      await change.mutateAsync({ task, estado })
      toast.success(estado === 'Completada' ? 'Tarea completada.' : 'Estado actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la tarea.')
    }
  }
  const holdTask = async (
    task: TareaPersistida,
    motivo: string,
    revisarEn: string,
    detalle: string,
  ) => {
    try {
      await hold.mutateAsync({ task, motivo, revisarEn, detalle })
      toast.success('Tarea en espera', { description: motivo })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo poner en espera.')
      throw error
    }
  }
  const validateTask = async (
    task: TareaPersistida,
    decision: 'Validado' | 'Rechazado',
    source: string,
    note: string,
  ) => {
    try {
      await validate.mutateAsync({
        id: task.id,
        versionEsperada: task.version,
        decision,
        venceEn: task.venceEn,
        fuente: source,
        nota: note,
      })
      toast.success(decision === 'Validado' ? 'Plazo validado.' : 'Plazo rechazado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo validar el plazo.')
    }
  }
  const editTask = async (input: Parameters<typeof edit.mutateAsync>[0]) => {
    try {
      await edit.mutateAsync(input)
      toast.success('Tarea actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la tarea.')
      throw error
    }
  }
  const addInboxItem = async (captureText: string, taskId: string | null) => {
    try {
      await captureInbox.mutateAsync({ captureText, taskId })
      toast.success('Añadido a tu INBOX personal.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar en el INBOX.')
      throw error
    }
  }
  const changeInboxStage = async (itemId: string, stage: TaskInboxItemRow['stage']) => {
    try {
      await moveInbox.mutateAsync({ itemId, stage })
      toast.success('INBOX actualizado sin cambiar el estado de la tarea.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo mover la entrada del INBOX.')
    }
  }

  const Root = expedienteId ? 'section' : 'main'

  return (
    <Root
      className={expedienteId ? 'space-y-4' : 'mx-auto max-w-6xl space-y-4 p-6'}
      aria-label={expedienteId ? 'Tareas del expediente' : undefined}
    >
      {expedienteId ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Tareas</h2>
            <p className="text-muted-foreground text-sm">
              Trabajo pendiente y completado vinculado a este expediente.
            </p>
          </div>
          <TaskCreateDialog
            firmId={firmId}
            expedienteId={expedienteId}
            title="Nueva tarea para el expediente"
            contextLabel={expedienteLabel ? `el expediente ${expedienteLabel}` : 'este expediente'}
            defaultAssigneeId={defaultAssigneeId}
            members={members.data ?? []}
            labels={labels.data ?? []}
            titleTemplates={titleTemplates}
            titleAriaLabel="Título de tarea"
            pending={createTask.isPending}
            successMessage="Tarea vinculada al expediente."
            onCreate={(input) => createTask.mutateAsync(input)}
          />
        </div>
      ) : (
        <SectionHeader
          title="Tareas y plazos"
          subtitle="Fechas compartidas con zona horaria, responsable y trazabilidad."
          actions={
            <TaskCreateDialog
              firmId={firmId}
              cases={cases.data ?? []}
              members={members.data ?? []}
              labels={labels.data ?? []}
              pending={createTask.isPending}
              onCreate={async (input) => {
                const task = await createTask.mutateAsync(input)
                setOpenTaskId(task.id)
              }}
            />
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2" aria-label="Ámbitos de tareas">
        {(
          [
            ['mine', 'Mis tareas'],
            ['delegated', 'Delegadas'],
            ['all', 'Todas'],
            ['administration', 'Administración'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={scope === id ? 'default' : 'outline'}
            onClick={() => setScope(id)}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={onlyNextActions ? 'default' : 'outline'}
          onClick={() => setOnlyNextActions((current) => !current)}
        >
          Siguientes acciones
        </Button>
        <Badge variant="secondary">
          En espera: {scopedTasks.filter((task) => task.estado === 'En espera').length}
        </Badge>
        <Badge variant="secondary">
          Sin abrir: {scopedTasks.filter((task) => task.asignadoId && !task.abiertaEn).length}
        </Badge>
        {expedienteId ? null : (
          <Badge variant="secondary">
            Sin siguiente acción:{' '}
            {cases.data?.filter(
              (item) =>
                !allTasks.some(
                  (task) =>
                    task.expedienteId === item.id &&
                    task.esSiguienteAccion &&
                    !['Completada', 'Cancelada'].includes(task.estado),
                ),
            ).length ?? 0}
          </Badge>
        )}
      </div>
      {expedienteId ? null : (
        <TaskInbox
          items={inbox.data ?? []}
          tasks={allTasks}
          pending={captureInbox.isPending || moveInbox.isPending}
          onCapture={addInboxItem}
          onMove={changeInboxStage}
          onOpenTask={setOpenTaskId}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="task-search" className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar tareas y plazos</span>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="task-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, detalle o expediente…"
            className="bg-muted/20 h-9 !pl-11 shadow-none"
          />
        </label>
        <PopoverTrigger>
          <Button type="button" variant="outline" size="sm" className="h-9 shadow-none">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filtros
            {activeFilterCount ? (
              <span className="bg-primary text-primary-foreground flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
          <PopoverContent
            placement="bottom end"
            className="border-border/80 w-[min(26rem,calc(100vw-2rem))] rounded-xl p-0 shadow-lg"
          >
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Filtros de tareas</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Acota por tipo, responsable, prioridad o estado.
              </p>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <FilterSelect
                label="Tipo"
                value={typeFilter}
                onChange={(value) => setTypeFilter(value as typeof typeFilter)}
                options={[
                  ['all', 'Todos los tipos'],
                  ['Tarea', 'Tarea'],
                  ['Recordatorio', 'Recordatorio'],
                  ['Evento', 'Evento'],
                  ['Plazo', 'Plazo'],
                ]}
              />
              <FilterSelect
                label="Etiquetas"
                value={labelFilter}
                onChange={setLabelFilter}
                options={[
                  ['all', 'Todas las etiquetas'],
                  ...(labels.data ?? []).map((label) => [label.id, label.nombre]),
                ]}
              />
              <FilterSelect
                label="Responsable"
                value={assigneeFilter}
                onChange={setAssigneeFilter}
                options={[
                  ['all', 'Todos los responsables'],
                  ['', 'Sin asignar'],
                  ...(members.data ?? []).map((member) => [member.id, member.nombre]),
                ]}
              />
              <FilterSelect
                label="Prioridad"
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value as typeof priorityFilter)}
                options={[
                  ['all', 'Cualquier prioridad'],
                  ['Alta', 'Alta'],
                  ['Media', 'Media'],
                  ['Baja', 'Baja'],
                ]}
              />
              <FilterSelect
                label="Estado"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as TaskFilterStatus)}
                options={[
                  ['all', 'Todos los estados'],
                  ['Pendiente', 'Pendiente'],
                  ['En curso', 'En curso'],
                  ['En espera', 'En espera'],
                  ['Completada', 'Completada'],
                  ['Cancelada', 'Cancelada'],
                ]}
              />
              <FilterSelect
                label="Relevancia"
                value={relevanceFilter}
                onChange={(value) => setRelevanceFilter(value as typeof relevanceFilter)}
                options={[
                  ['all', 'Cualquier relevancia'],
                  ['activity', RELEVANCIA_TAREA_LABELS.activity],
                  ['milestone', RELEVANCIA_TAREA_LABELS.milestone],
                ]}
              />
            </div>
            {activeFilterCount ? (
              <div className="border-t px-4 py-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </PopoverTrigger>
        <Badge variant="secondary" className="h-9 px-3 tabular-nums">
          {orderedVisible.length} {orderedVisible.length === 1 ? 'elemento' : 'elementos'}
        </Badge>
        <div className="ml-auto">
          <ViewSwitch
            value={view}
            onChange={(value) => setView(value as TaskView)}
            options={[
              { id: 'calendar', label: 'Calendario' },
              { id: 'kanban', label: 'Kanban' },
              { id: 'list', label: 'Lista' },
            ]}
          />
        </div>
      </div>
      {view === 'calendar' ? (
        <TaskCalendar
          tasks={orderedVisible}
          week={calendarWeek}
          onPreviousWeek={() => setCalendarWeek((current) => shiftWeek(current, -1))}
          onNextWeek={() => setCalendarWeek((current) => shiftWeek(current, 1))}
          onCurrentWeek={() => setCalendarWeek(weekStart(new Date()))}
          onEdit={(task) => setCalendarEditTask(task)}
        />
      ) : view === 'kanban' ? (
        <TaskKanban
          tasks={orderedVisible}
          allTasks={allTasks}
          canValidate={canValidate}
          pending={change.isPending || validate.isPending}
          caseNames={caseNames}
          memberNames={memberNames}
          onChangeStatus={changeStatus}
          onValidate={validateTask}
          onEdit={editTask}
          canEdit={canEditTasks}
          memberOptions={members.data ?? []}
          onHold={holdTask}
          holdPending={hold.isPending}
          onOpenTask={(task) => setOpenTaskId(task.id)}
          onReorder={async (status, taskIds) => {
            try {
              const completeOrder = [...allTasks]
                .filter((task) =>
                  status === 'pending' ? task.estado === 'Pendiente' : task.estado === 'En curso',
                )
                .sort(
                  (a, b) =>
                    (a.boardPosition ?? Number.MAX_SAFE_INTEGER) -
                    (b.boardPosition ?? Number.MAX_SAFE_INTEGER) ||
                    a.titulo.localeCompare(b.titulo, 'es'),
                )
              const taskIdsWithHidden = reorderTasksWithFilteredItems(
                completeOrder.map((task) => task.id),
                taskIds,
              ).filter((id): id is string => Boolean(id))
              await reorderBoard.mutateAsync({ status, taskIds: taskIdsWithHidden })
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : 'No se pudo guardar el orden del tablero.',
              )
            }
          }}
        />
      ) : (
        <section aria-label="Lista de tareas" className="space-y-3">
          {orderedVisible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canValidate={canValidate}
              pending={change.isPending || validate.isPending}
              caseName={caseNames.get(task.expedienteId ?? '')}
              assigneeName={memberNames.get(task.asignadoId ?? '')}
              onChangeStatus={changeStatus}
              onValidate={validateTask}
              onEdit={editTask}
              canEdit={canEditTasks}
              memberOptions={members.data ?? []}
              onOpen={(item) => setOpenTaskId(item.id)}
            />
          ))}
          {!orderedVisible.length ? <EmptyTasks /> : null}
        </section>
      )}
      {calendarEditTask ? (
        <div className="hidden">
          <TaskCard
            task={calendarEditTask}
            canValidate={canValidate}
            pending={change.isPending || validate.isPending}
            caseName={caseNames.get(calendarEditTask.expedienteId ?? '')}
            assigneeName={memberNames.get(calendarEditTask.asignadoId ?? '')}
            onChangeStatus={changeStatus}
            onValidate={validateTask}
            onEdit={editTask}
            canEdit={canEditTasks}
            memberOptions={members.data ?? []}
            initialEditOpen
            onEditClose={() => setCalendarEditTask(null)}
          />
        </div>
      ) : null}
      <TaskDetailDialog
        taskId={openTaskId}
        onOpenChange={(open) => {
          if (!open) setOpenTaskId(null)
        }}
        onOpenTask={setOpenTaskId}
      />
    </Root>
  )
}

export function TaskInbox({
  items,
  tasks,
  pending,
  onCapture,
  onMove,
  onOpenTask,
}: {
  items: TaskInboxItemRow[]
  tasks: TareaPersistida[]
  pending: boolean
  onCapture: (captureText: string, taskId: string | null) => Promise<void>
  onMove: (itemId: string, stage: TaskInboxItemRow['stage']) => Promise<void>
  onOpenTask?: (taskId: string) => void
}) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dropStage, setDropStage] = useState<TaskInboxItemRow['stage'] | null>(null)
  const titles = new Map(tasks.map((task) => [task.id, task.titulo]))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const captureText = String(data.get('capture') ?? '')
    const taskId = String(data.get('task') ?? '') || null
    try {
      await onCapture(captureText, taskId)
      form.reset()
    } catch {
      // The mutation has already shown its actionable error message.
    }
  }
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            className="text-sm font-semibold"
            title="Organiza tus capturas sin modificar el estado compartido de las tareas."
          >
            INBOX personal
          </h2>
          <Badge variant="secondary">{items.length}</Badge>
          <form
            className="flex min-w-64 flex-1 flex-wrap items-center gap-2"
            onSubmit={(event) => void submit(event)}
          >
            <Input
              name="capture"
              aria-label="Captura rápida"
              placeholder="Anota algo para revisar…"
              className="h-8 min-w-40 flex-1 text-sm"
            />
            <select
              name="task"
              aria-label="Tarea opcional para INBOX"
              defaultValue=""
              className="border-input bg-background h-8 w-44 rounded-md border px-2 text-xs"
            >
              <option value="">Sin tarea vinculada</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.titulo}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" className="h-8" disabled={pending}>
              Capturar
            </Button>
          </form>
        </div>
        <p id="task-inbox-drag-help" className="text-muted-foreground sr-only">
          Arrastra una entrada a otra etapa o utiliza su selector para cambiarla.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(INBOX_STAGE_LABELS) as TaskInboxItemRow['stage'][]).map((stage) => {
            const stageItems = items.filter((item) => item.stage === stage)
            return (
              <section
                key={stage}
                data-testid={`task-inbox-stage-${stage}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDropStage(stage)
                }}
                onDragLeave={(event) => {
                  const nextTarget = event.relatedTarget
                  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
                  setDropStage((current) => (current === stage ? null : current))
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  const itemId = event.dataTransfer.getData('text/plain')
                  setDropStage(null)
                  setDraggedItemId(null)
                  if (itemId && items.some((item) => item.id === itemId && item.stage !== stage))
                    void onMove(itemId, stage)
                }}
                className={`bg-muted/30 min-w-36 space-y-1.5 rounded-md border p-2 transition-colors ${stageItems.length ? 'w-56 shrink-0' : 'w-36 shrink-0'} ${dropStage === stage ? 'border-primary bg-primary/5 ring-primary/20 ring-2' : ''}`}
              >
                <h3 className="text-[11px] font-semibold tracking-wide uppercase">
                  {INBOX_STAGE_LABELS[stage]} · {stageItems.length}
                </h3>
                {stageItems.map((item) => (
                  <article
                    key={item.id}
                    className={`bg-background space-y-1 rounded border p-1.5 text-xs ${draggedItemId === item.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        draggable={!pending}
                        disabled={pending}
                        aria-label={`Arrastrar entrada ${item.capture_text || 'del INBOX'}`}
                        aria-describedby="task-inbox-drag-help"
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', item.id)
                          setDraggedItemId(item.id)
                        }}
                        onDragEnd={() => {
                          setDraggedItemId(null)
                          setDropStage(null)
                        }}
                        className="text-muted-foreground hover:bg-muted flex h-5 w-4 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing disabled:cursor-not-allowed"
                      >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <p className="line-clamp-2 min-w-0 flex-1 leading-snug">
                        {item.capture_text || titles.get(item.task_id ?? '') || 'Tarea vinculada'}
                      </p>
                    </div>
                    {item.task_id && onOpenTask ? (
                      <button
                        type="button"
                        onClick={() => item.task_id && onOpenTask(item.task_id)}
                        className="text-primary block max-w-full truncate text-left text-xs underline underline-offset-4"
                      >
                        {titles.get(item.task_id) ?? 'Abrir tarea vinculada'}
                      </button>
                    ) : item.task_id ? (
                      <Link
                        to="/tareas/$taskId"
                        params={{ taskId: item.task_id }}
                        className="text-primary block truncate text-xs underline underline-offset-4"
                      >
                        {titles.get(item.task_id) ?? 'Abrir tarea vinculada'}
                      </Link>
                    ) : null}
                    <select
                      aria-label={`Mover ${item.capture_text || 'entrada'} del INBOX`}
                      value={item.stage}
                      disabled={pending}
                      onChange={(event) =>
                        void onMove(item.id, event.target.value as TaskInboxItemRow['stage'])
                      }
                      className="border-input bg-background text-muted-foreground h-6 w-full rounded border px-1 text-[11px]"
                    >
                      {(Object.keys(INBOX_STAGE_LABELS) as TaskInboxItemRow['stage'][]).map(
                        (option) => (
                          <option key={option} value={option}>
                            {INBOX_STAGE_LABELS[option]}
                          </option>
                        ),
                      )}
                    </select>
                  </article>
                ))}
                {!stageItems.length ? (
                  <p className="text-muted-foreground text-[11px]">Vacío</p>
                ) : null}
              </section>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function TaskCalendar({
  tasks,
  week,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  onEdit,
}: {
  tasks: TareaPersistida[]
  week: Date
  onPreviousWeek: () => void
  onNextWeek: () => void
  onCurrentWeek: () => void
  onEdit: (task: TareaPersistida) => void
}) {
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(week)
    day.setDate(day.getDate() + index)
    return day
  })
  const today = new Date()
  const weekEnd = new Date(week)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const undated = tasks.filter((task) => !task.venceEn)
  const scheduledByDay = new Map<string, TareaPersistida[]>()
  for (const task of tasks) {
    if (!task.venceEn) continue
    const taskDate = new Date(task.venceEn)
    if (Number.isNaN(taskDate.getTime()) || taskDate < week || taskDate >= weekEnd) continue
    const key = calendarDateKey(task.venceEn)
    scheduledByDay.set(key, [...(scheduledByDay.get(key) ?? []), task])
  }

  const weekLabel = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  })
  const weekRange = `${weekLabel.format(weekDays[0])} – ${weekLabel.format(weekDays[6])}`

  return (
    <section aria-label="Calendario de tareas y plazos" className="space-y-4">
      <Card className="border-border/80 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <header className="from-primary/10 via-background flex flex-wrap items-center justify-between gap-3 border-b bg-linear-to-r to-transparent px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold capitalize">{weekRange}</h2>
                <p className="text-muted-foreground text-xs">
                  Vista semanal · usa los filtros generales de Tareas
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onPreviousWeek}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onCurrentWeek}>
                Hoy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onNextWeek}
                aria-label="Semana siguiente"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </header>
          <div className="max-h-[44rem] overflow-auto">
            <div className="grid min-w-[760px] grid-cols-[3.5rem_repeat(7,minmax(7.5rem,1fr))]">
              <div className="bg-muted/45 sticky top-0 z-20 border-b" />
              {weekDays.map((day, index) => {
                const isToday = day.toDateString() === today.toDateString()
                return (
                  <div
                    key={day.toISOString()}
                    className="bg-muted/45 sticky top-0 z-20 border-b border-l px-2 py-2 text-center"
                  >
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                      {AGENDA_WEEKDAYS[index]}
                    </p>
                    <span
                      className={`mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : ''}`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                )
              })}
              <div
                className="relative"
                style={{ height: AGENDA_HOURS.length * CALENDAR_HOUR_HEIGHT }}
              >
                {AGENDA_HOURS.map((hour, index) => (
                  <div
                    key={hour}
                    className="text-muted-foreground absolute right-0 left-0 -translate-y-2 border-b pr-2 text-right text-[10px] font-medium"
                    style={{ top: index * CALENDAR_HOUR_HEIGHT }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
                <div className="text-muted-foreground absolute right-0 bottom-0 left-0 translate-y-2 pr-2 text-right text-[10px] font-medium">
                  20:00
                </div>
              </div>
              {weekDays.map((day) => (
                <CalendarDayColumn
                  key={day.toISOString()}
                  day={day}
                  tasks={scheduledByDay.get(calendarDateKey(day.toISOString())) ?? []}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      {undated.length ? (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Sin fecha asignada ({undated.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {undated.map((task) => (
                <Badge key={task.id} variant="secondary">
                  {task.titulo}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {!tasks.length ? <EmptyTasks /> : null}
    </section>
  )
}

function CalendarDayColumn({
  day,
  tasks,
  onEdit,
}: {
  day: Date
  tasks: TareaPersistida[]
  onEdit: (task: TareaPersistida) => void
}) {
  const layouts = layoutCalendarEvents(tasks)
  const height = AGENDA_HOURS.length * CALENDAR_HOUR_HEIGHT
  return (
    <div className="relative border-l" style={{ height }}>
      {AGENDA_HOURS.map((hour, index) => (
        <div
          key={hour}
          className="pointer-events-none absolute right-0 left-0 border-b"
          style={{ top: index * CALENDAR_HOUR_HEIGHT }}
        />
      ))}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 border-b" />
      {layouts.map(({ task, top, height, column, columnCount }) => (
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label={`Editar tarea: ${task.titulo}`}
          key={task.id}
          title={`${formatTaskDate(task.venceEn)} · ${task.titulo}`}
          className={`absolute z-10 overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight font-semibold shadow-xs ${TASK_PRIORITY_CLASS[task.prioridad]}`}
          style={{
            top: top + 2,
            left: `calc(${(column / columnCount) * 100}% + 0.25rem)`,
            width: `calc(${100 / columnCount}% - 0.5rem)`,
            minHeight: height,
          }}
        >
          <span className="block opacity-75">
            {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(
              new Date(task.venceEn ?? ''),
            )}
          </span>
          <span className="line-clamp-2 block">{task.titulo}</span>
        </button>
      ))}
      <span className="sr-only">Eventos del {day.toLocaleDateString('es-ES')}</span>
    </div>
  )
}

function TaskKanban({
  tasks,
  allTasks,
  canValidate,
  pending,
  caseNames,
  memberNames,
  onChangeStatus,
  onValidate,
  onEdit,
  canEdit,
  memberOptions,
  onReorder,
  onHold,
  holdPending,
  onOpenTask,
}: {
  tasks: TareaPersistida[]
  allTasks: TareaPersistida[]
  onHold: (task: TareaPersistida, reason: string, reviewAt: string, detail: string) => Promise<void>
  holdPending: boolean
  onOpenTask: (task: TareaPersistida) => void
  canValidate: boolean
  pending: boolean
  caseNames: ReadonlyMap<string, string>
  memberNames: ReadonlyMap<string, string>
  onChangeStatus: (task: TareaPersistida, status: TareaPersistida['estado']) => Promise<void>
  onValidate: (
    task: TareaPersistida,
    decision: 'Validado' | 'Rechazado',
    source: string,
    note: string,
  ) => Promise<void>
  onEdit: (input: Parameters<ReturnType<typeof useEditarTarea>['mutateAsync']>[0]) => Promise<void>
  canEdit: boolean
  memberOptions: Array<{ id: string; nombre: string }>
  onReorder: (status: 'pending' | 'in_progress', taskIds: string[]) => Promise<void>
}) {
  const hasActiveTasks = tasks.some((task) => taskBoardColumn(task))
  const [dragged, setDragged] = useState<TareaPersistida | null>(null)
  const [orderDropId, setOrderDropId] = useState<string | null>(null)
  const [holdTask, setHoldTask] = useState<TareaPersistida | null>(null)
  const orderedAllTasks = [...allTasks].sort(
    (a, b) =>
      (a.boardPosition ?? Number.MAX_SAFE_INTEGER) - (b.boardPosition ?? Number.MAX_SAFE_INTEGER) ||
      a.titulo.localeCompare(b.titulo, 'es'),
  )
  const canDropIn = (column: TaskBoardColumnId) =>
    Boolean(dragged && canMoveTaskInBoard(dragged, column))
  const resetDrag = () => {
    setDragged(null)
    setOrderDropId(null)
  }
  const moveToColumn = (task: TareaPersistida, column: TaskBoardColumnId) => {
    if (!canMoveTaskInBoard(task, column)) return
    if (column === 'waiting') {
      setHoldTask(task)
      return
    }
    const status = taskStatusForBoardColumn(column)
    if (status) void onChangeStatus(task, status)
  }
  const dropInColumn = (event: DragEvent<HTMLElement>, column: TaskBoardColumnId) => {
    event.preventDefault()
    if (dragged) moveToColumn(dragged, column)
    resetDrag()
  }
  return (
    <section aria-label="Tablero Kanban de tareas" className="overflow-x-auto pb-2">
      <p id="task-drag-help" className="sr-only">
        Arrastra una tarea entre columnas para actualizar su estado. Al soltarla en En espera se
        pedirá el motivo y la fecha de revisión.
      </p>
      <div className="grid min-w-[960px] grid-cols-3 gap-3">
        {TASK_BOARD_COLUMNS.map((column) => {
          const items = tasks.filter((task) => taskBoardColumn(task) === column.id)
          return (
            <section
              key={column.id}
              className={`bg-muted/40 min-h-[34rem] rounded-md border p-2.5 transition-colors ${canDropIn(column.id) ? 'border-primary bg-primary/5 ring-primary/20 ring-2' : ''}`}
              onDragOver={(event) => {
                if (canDropIn(column.id)) event.preventDefault()
              }}
              onDrop={(event) => {
                if (canDropIn(column.id)) dropInColumn(event, column.id)
                else resetDrag()
              }}
            >
              <header className="border-border mb-3 flex items-start justify-between gap-3 border-b px-1 pt-1 pb-2.5">
                <div className="min-w-0">
                  <h2 className="text-xs font-bold tracking-wide uppercase">{column.title}</h2>
                  <p className="text-muted-foreground mt-1 text-[11px] leading-4">
                    {column.description}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="h-6 min-w-6 shrink-0 rounded-full px-2 text-xs tabular-nums"
                >
                  {items.length}
                </Badge>
              </header>
              <div className="space-y-2.5">
                {items.map((task) => (
                  <div
                    key={task.id}
                    className={`relative ${orderDropId === task.id ? 'before:bg-primary before:absolute before:-top-1 before:left-0 before:h-1 before:w-full before:rounded' : ''}`}
                    onDragOver={(event) => {
                      if (!dragged || dragged.id === task.id) return
                      const sameColumn = taskBoardColumn(dragged) === column.id
                      if (sameColumn && column.id === 'waiting') return
                      if (!sameColumn && !canMoveTaskInBoard(dragged, column.id)) return
                      event.preventDefault()
                      event.stopPropagation()
                      if (sameColumn) setOrderDropId(task.id)
                    }}
                    onDragLeave={() =>
                      setOrderDropId((current) => (current === task.id ? null : current))
                    }
                    onDrop={(event) => {
                      const source = dragged
                      if (!source || source.id === task.id) return
                      event.preventDefault()
                      event.stopPropagation()
                      resetDrag()
                      if (taskBoardColumn(source) !== column.id) {
                        moveToColumn(source, column.id)
                        return
                      }
                      if (column.id === 'waiting') return
                      const fullColumn = orderedAllTasks.filter(
                        (item) => taskBoardColumn(item) === column.id,
                      )
                      const next = fullColumn.filter((item) => item.id !== source.id)
                      const index = next.findIndex((item) => item.id === task.id)
                      next.splice(index < 0 ? next.length : index, 0, source)
                      void onReorder(
                        column.id === 'pending' ? 'pending' : 'in_progress',
                        next.map((item) => item.id),
                      )
                    }}
                  >
                    <TaskCard
                      task={task}
                      canValidate={canValidate}
                      pending={pending}
                      compact
                      caseName={caseNames.get(task.expedienteId ?? '')}
                      assigneeName={memberNames.get(task.asignadoId ?? '')}
                      onChangeStatus={onChangeStatus}
                      onValidate={onValidate}
                      onEdit={onEdit}
                      canEdit={canEdit}
                      memberOptions={memberOptions}
                      onOpen={onOpenTask}
                      drag={{
                        onStart: (event) => {
                          event.dataTransfer.setData('application/x-lex-task-id', task.id)
                          event.dataTransfer.effectAllowed = 'move'
                          setDragged(task)
                        },
                        onEnd: resetDrag,
                        isDragged: dragged?.id === task.id,
                      }}
                    />
                  </div>
                ))}
                {!items.length ? (
                  <p className="text-muted-foreground rounded-md border border-dashed bg-transparent px-3 py-9 text-center text-xs">
                    {canDropIn(column.id)
                      ? 'Suelta la tarea aquí'
                      : 'Sin elementos en esta categoría.'}
                  </p>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>
      {!hasActiveTasks ? <EmptyTasks /> : null}
      <TaskHoldDialog
        open={Boolean(holdTask)}
        onOpenChange={(open) => {
          if (!open) setHoldTask(null)
        }}
        pending={holdPending}
        taskTitle={holdTask?.titulo}
        onSubmit={(reason, reviewAt, detail) => {
          if (!holdTask) return
          void onHold(holdTask, reason, reviewAt, detail).then(() => setHoldTask(null))
        }}
      />
    </section>
  )
}

function TaskCard({
  task,
  canValidate,
  pending,
  compact = false,
  caseName,
  assigneeName,
  onChangeStatus,
  onValidate,
  onEdit,
  canEdit,
  memberOptions,
  drag,
  initialEditOpen = false,
  onEditClose,
  onOpen,
}: {
  task: TareaPersistida
  canValidate: boolean
  pending: boolean
  compact?: boolean
  caseName?: string | undefined
  assigneeName?: string | undefined
  onChangeStatus: (task: TareaPersistida, status: TareaPersistida['estado']) => Promise<void>
  onValidate: (
    task: TareaPersistida,
    decision: 'Validado' | 'Rechazado',
    source: string,
    note: string,
  ) => Promise<void>
  onEdit: (input: Parameters<ReturnType<typeof useEditarTarea>['mutateAsync']>[0]) => Promise<void>
  canEdit: boolean
  memberOptions: Array<{ id: string; nombre: string }>
  drag?: {
    onStart: (event: DragEvent<HTMLButtonElement>) => void
    onEnd: () => void
    isDragged: boolean
  }
  initialEditOpen?: boolean
  onEditClose?: () => void
  onOpen?: (task: TareaPersistida) => void
}) {
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [editOpen, setEditOpen] = useState(initialEditOpen ?? false)
  const [editTitle, setEditTitle] = useState(task.titulo)
  const [editDescription, setEditDescription] = useState(task.descripcion)
  const [editPriority, setEditPriority] = useState(task.prioridad)
  const [editAssignee, setEditAssignee] = useState(task.asignadoId ?? '')
  const [editDue, setEditDue] = useState(task.venceEn?.slice(0, 16) ?? '')
  const [editBusy, setEditBusy] = useState(false)
  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    setEditBusy(true)
    try {
      await onEdit({
        task,
        titulo: editTitle,
        descripcion: editDescription,
        prioridad: editPriority,
        estado: task.estado,
        venceEn: editDue ? new Date(editDue).toISOString() : null,
        recordarEn: task.recordarEn,
        asignadoId: editAssignee || null,
      })
      setEditOpen(false)
    } finally {
      setEditBusy(false)
    }
  }
  const closed = task.estado === 'Completada' || task.estado === 'Cancelada'
  const overdue = !closed && Boolean(task.venceEn) && new Date(task.venceEn ?? '') < new Date()
  const actionable = task.validacion !== 'Propuesto' && !closed
  return (
    <Card
      className={`${compact ? 'group/task border-border bg-card hover:border-primary/35 rounded-xl shadow-sm transition-all hover:shadow-md' : ''} ${drag?.isDragged ? 'opacity-50' : ''}`}
    >
      <CardContent className={`space-y-2.5 ${compact ? 'p-3' : 'pt-6'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            {drag ? (
              <button
                type="button"
                draggable={!pending}
                disabled={pending}
                aria-label={`Arrastrar ${task.titulo}`}
                aria-describedby="task-drag-help"
                onDragStart={drag.onStart}
                onDragEnd={drag.onEnd}
                className="text-muted-foreground hover:bg-muted hover:text-foreground mt-0.5 -ml-1 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded transition-colors active:cursor-grabbing disabled:cursor-not-allowed"
              >
                <GripVertical className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className="hover:text-primary line-clamp-2 text-left text-[15px] leading-5 font-semibold transition-colors hover:underline"
                >
                  {task.titulo}
                </button>
              ) : (
                <Link
                  to="/tareas/$taskId"
                  params={{ taskId: task.id }}
                  className="hover:text-primary line-clamp-2 text-left text-[15px] leading-5 font-semibold transition-colors hover:underline"
                >
                  {task.titulo}
                </Link>
              )}
              {!compact && task.descripcion ? (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                  {task.descripcion}
                </p>
              ) : null}
            </div>
          </div>
          <Badge
            className={`h-6 shrink-0 gap-1 rounded-full px-2 text-[11px] ${TASK_PRIORITY_CLASS[task.prioridad]}`}
          >
            <Flag className="h-3 w-3" aria-hidden="true" />
            {task.critico ? 'Crítica' : task.prioridad}
          </Badge>
        </div>
        {task.expedienteId ? (
          <Link
            to="/expedientes/$id"
            params={{ id: task.expedienteId }}
            className="text-muted-foreground hover:text-primary flex min-w-0 items-center gap-1.5 text-xs transition-colors"
          >
            <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{caseName ?? 'Expediente vinculado'}</span>
          </Link>
        ) : null}
        {task.oportunidadId && !task.expedienteId ? (
          <Link
            to="/oportunidades/$id"
            params={{ id: task.oportunidadId }}
            className="text-muted-foreground hover:text-primary flex min-w-0 items-center gap-1.5 text-xs transition-colors"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Lead vinculado</span>
          </Link>
        ) : null}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-foreground flex min-w-0 items-center gap-1.5">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${assigneeName ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
              aria-hidden="true"
            >
              {assigneeName ? initialsOf(assigneeName) : '?'}
            </span>
            <span className={`truncate ${assigneeName ? '' : 'text-muted-foreground'}`}>
              {assigneeName ?? 'Sin responsable'}
            </span>
          </span>
          <span
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatTaskDate(task.venceEn)}
          </span>
        </div>
        <div className="border-border flex items-center justify-between gap-2 border-t pt-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
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
            {task.etiquetas.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className={`h-6 gap-1 px-2 text-[11px] ${taskLabelClass(label.color)}`}
              >
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {label.nombre}
              </Badge>
            ))}
            {task.recordarEn ? (
              <TaskIconHint label="Recordatorio activo">
                <span
                  role="img"
                  aria-label="Recordatorio activo"
                  className="bg-secondary text-secondary-foreground flex size-6 items-center justify-center rounded-md"
                >
                  <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </TaskIconHint>
            ) : null}
            {task.validacion === 'Propuesto' ? (
              <Badge
                variant="outline"
                className="border-warning/30 bg-warning/10 text-warning-foreground h-6 gap-1 px-2 text-[11px]"
              >
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                Pendiente de validar
              </Badge>
            ) : null}
          </div>
          {actionable ? (
            <div className="flex shrink-0 items-center gap-0.5">
              {task.estado === 'Pendiente' ? (
                <TaskIconAction
                  label="Empezar"
                  icon={<Play className="h-4 w-4" aria-hidden="true" />}
                  disabled={pending}
                  onClick={() => void onChangeStatus(task, 'En curso')}
                />
              ) : null}
              {onOpen ? (
                <TaskIconAction
                  label="Abrir detalle"
                  icon={<PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => onOpen(task)}
                />
              ) : (
                <TaskIconHint label="Abrir detalle">
                  <Link
                    to="/tareas/$taskId"
                    params={{ taskId: task.id }}
                    aria-label="Abrir detalle"
                    className={buttonVariants({
                      variant: 'ghost',
                      size: 'sm',
                      className: 'text-muted-foreground hover:text-foreground size-8 p-0',
                    })}
                  >
                    <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </TaskIconHint>
              )}
            </div>
          ) : null}
        </div>
        {task.validacion === 'Propuesto' && canValidate ? (
          <div className={`grid gap-2 ${compact ? '' : 'md:grid-cols-[1fr_1fr_auto]'}`}>
            <Input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Fuente jurídica obligatoria"
            />
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nota profesional"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="gap-1"
                disabled={pending || !source.trim()}
                onClick={() => void onValidate(task, 'Validado', source, note)}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Validar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={pending}
                onClick={() => void onValidate(task, 'Rechazado', source, note)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Rechazar
              </Button>
            </div>
          </div>
        ) : null}
        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open)
            if (!open) onEditClose?.()
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar tarea</DialogTitle>
              <DialogDescription>
                Actualiza la información operativa de esta tarea.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(event) => void submitEdit(event)}>
              <div className="space-y-1.5">
                <Label htmlFor={`edit-title-${task.id}`}>Título</Label>
                <Input
                  id={`edit-title-${task.id}`}
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  required
                  maxLength={240}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`edit-description-${task.id}`}>Descripción</Label>
                <Textarea
                  id={`edit-description-${task.id}`}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={5}
                  placeholder="Añade contexto, instrucciones o próximos pasos"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`edit-priority-${task.id}`}>Prioridad</Label>
                  <select
                    id={`edit-priority-${task.id}`}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={editPriority}
                    onChange={(event) =>
                      setEditPriority(event.target.value as TareaPersistida['prioridad'])
                    }
                  >
                    <option>Baja</option>
                    <option>Media</option>
                    <option>Alta</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`edit-due-${task.id}`}>Vencimiento</Label>
                  <Input
                    id={`edit-due-${task.id}`}
                    type="datetime-local"
                    value={editDue}
                    onChange={(event) => setEditDue(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`edit-assignee-${task.id}`}>Responsable</Label>
                  <select
                    id={`edit-assignee-${task.id}`}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={editAssignee}
                    onChange={(event) => setEditAssignee(event.target.value)}
                  >
                    <option value="">Sin responsable</option>
                    {memberOptions.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!canEdit || editBusy}>
                  {editBusy ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[][]
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

function EmptyTasks() {
  return (
    <p className="text-muted-foreground py-10 text-center text-sm">No hay elementos que mostrar.</p>
  )
}

const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
