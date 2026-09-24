import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  BellRing,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  LayoutDashboard,
  Link2,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'
import { useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader, ViewSwitch } from '@/components/common'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes, useParticipantesPersistentes } from '@/features/expedientes'
import {
  useCambiarEstadoTarea,
  useCapturarInboxTarea,
  useCrearTarea,
  useEditarTarea,
  useEtiquetasTarea,
  useInboxTareas,
  useMoverInboxTarea,
  useTareasPersistentes,
  useValidarPlazo,
  type CrearTareaInput,
  type DetallesReunion,
  type TaskInboxItemRow,
  type TareaPersistida,
} from '@/features/tareas'

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

export function specialMeetingCreationIssue(details: DetallesReunion): string | null {
  if (!details.subject?.trim()) return 'Indica el objeto de la reunión.'
  if (
    !details.attendeeContactIds.length &&
    !details.attendeeUserIds.length &&
    !details.attendeeNames?.some((name) => name.trim())
  ) {
    return 'Añade al menos una persona asistente.'
  }
  return null
}

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
  return Boolean(
    current &&
    current !== 'waiting' &&
    target !== 'waiting' &&
    current !== target &&
    taskStatusForBoardColumn(target),
  )
}

export function TaskWorkspace() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const labels = useEtiquetasTarea(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const change = useCambiarEstadoTarea(firmId)
  const edit = useEditarTarea(firmId)
  const validate = useValidarPlazo(firmId)
  const inbox = useInboxTareas(firmId, session.user?.id)
  const captureInbox = useCapturarInboxTarea(firmId, session.user?.id)
  const moveInbox = useMoverInboxTarea(firmId, session.user?.id)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CrearTareaInput['tipo']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TareaPersistida['prioridad']>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<TaskFilterStatus>('all')
  const [labelFilter, setLabelFilter] = useState('all')
  const [scope, setScope] = useState<TaskScope>('mine')
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
  const visible = allTasks.filter((task) => {
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
      (!onlyNextActions || task.esSiguienteAccion) &&
      matchesStatus
    )
  })
  const orderedVisible = sortTasksForAgenda(visible)
  const activeFilterCount = [
    typeFilter,
    priorityFilter,
    assigneeFilter,
    statusFilter,
    labelFilter,
    onlyNextActions,
  ].filter((value) => value !== 'all' && value !== false).length
  const clearFilters = () => {
    setTypeFilter('all')
    setPriorityFilter('all')
    setAssigneeFilter('all')
    setStatusFilter('all')
    setLabelFilter('all')
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

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
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
              await navigate({ to: '/tareas/$taskId', params: { taskId: task.id } })
            }}
          />
        }
      />
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
          En espera: {allTasks.filter((task) => task.estado === 'En espera').length}
        </Badge>
        <Badge variant="secondary">
          Sin abrir: {allTasks.filter((task) => task.asignadoId && !task.abiertaEn).length}
        </Badge>
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
      </div>
      <TaskInbox
        items={inbox.data ?? []}
        tasks={allTasks}
        pending={captureInbox.isPending || moveInbox.isPending}
        onCapture={addInboxItem}
        onMove={changeInboxStage}
      />
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
                label="Etiqueta"
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
          canValidate={canValidate}
          pending={change.isPending || validate.isPending}
          caseNames={caseNames}
          memberNames={memberNames}
          onChangeStatus={changeStatus}
          onValidate={validateTask}
          onEdit={editTask}
          canEdit={canEditTasks}
          memberOptions={members.data ?? []}
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
    </main>
  )
}

export function TaskInbox({
  items,
  tasks,
  pending,
  onCapture,
  onMove,
}: {
  items: TaskInboxItemRow[]
  tasks: TareaPersistida[]
  pending: boolean
  onCapture: (captureText: string, taskId: string | null) => Promise<void>
  onMove: (itemId: string, stage: TaskInboxItemRow['stage']) => Promise<void>
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
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">INBOX personal</h2>
            <p className="text-muted-foreground text-sm">
              Organiza tus capturas sin modificar el estado compartido de las tareas.
            </p>
          </div>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        <p id="task-inbox-drag-help" className="text-muted-foreground sr-only">
          Arrastra una entrada a otra etapa o utiliza su selector para cambiarla.
        </p>
        <form
          className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]"
          onSubmit={(event) => void submit(event)}
        >
          <Input
            name="capture"
            aria-label="Captura rápida"
            placeholder="Anota algo para revisar…"
          />
          <select
            name="task"
            aria-label="Tarea opcional para INBOX"
            defaultValue=""
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="">Sin tarea vinculada</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.titulo}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={pending}>
            Capturar
          </Button>
        </form>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
                className={`bg-muted/30 space-y-2 rounded-md border p-3 transition-colors ${dropStage === stage ? 'border-primary bg-primary/5 ring-primary/20 ring-2' : ''}`}
              >
                <h3 className="text-xs font-semibold tracking-wide uppercase">
                  {INBOX_STAGE_LABELS[stage]} · {stageItems.length}
                </h3>
                {stageItems.map((item) => (
                  <article
                    key={item.id}
                    className={`bg-background space-y-2 rounded border p-2 text-sm ${draggedItemId === item.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
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
                        className="text-muted-foreground hover:bg-muted mt-0.5 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded active:cursor-grabbing disabled:cursor-not-allowed"
                      >
                        <GripVertical className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <p>
                        {item.capture_text || titles.get(item.task_id ?? '') || 'Tarea vinculada'}
                      </p>
                    </div>
                    {item.task_id ? (
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
                      className="border-input bg-background h-8 w-full rounded border px-2 text-xs"
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
                  <p className="text-muted-foreground text-xs">Sin elementos.</p>
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
  canValidate,
  pending,
  caseNames,
  memberNames,
  onChangeStatus,
  onValidate,
  onEdit,
  canEdit,
  memberOptions,
}: {
  tasks: TareaPersistida[]
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
}) {
  const hasActiveTasks = tasks.some((task) => taskBoardColumn(task))
  const [dragged, setDragged] = useState<TareaPersistida | null>(null)
  const canDropIn = (column: TaskBoardColumnId) =>
    Boolean(dragged && canMoveTaskInBoard(dragged, column))
  const startDrag = (event: DragEvent<HTMLElement>, task: TareaPersistida) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
    setDragged(task)
  }
  const dropInColumn = (event: DragEvent<HTMLElement>, column: TaskBoardColumnId) => {
    event.preventDefault()
    const status = taskStatusForBoardColumn(column)
    if (dragged && status && canMoveTaskInBoard(dragged, column)) {
      void onChangeStatus(dragged, status)
    }
    setDragged(null)
  }
  return (
    <section aria-label="Tablero Kanban de tareas" className="overflow-x-auto pb-2">
      <p id="task-drag-help" className="sr-only">
        Arrastra una tarea entre Pendiente y En curso para actualizar su estado. Las tareas en
        espera se gestionan desde su detalle.
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
              onDrop={(event) => dropInColumn(event, column.id)}
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
                  <TaskCard
                    key={task.id}
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
                    {...(canMoveTaskInBoard(task, 'pending') ||
                    canMoveTaskInBoard(task, 'in-progress')
                      ? {
                          drag: {
                            onStart: (event) => startDrag(event, task),
                            onEnd: () => setDragged(null),
                            isDragged: dragged?.id === task.id,
                          },
                        }
                      : {})}
                  />
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
  return (
    <Card
      className={`${compact ? 'group/task border-border bg-card hover:border-primary/35 rounded-xl shadow-sm transition-all hover:shadow-md' : ''} ${drag?.isDragged ? 'opacity-50' : ''}`}
    >
      <CardContent className={`space-y-3 ${compact ? 'p-3.5' : 'pt-6'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
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
              <Link
                to="/tareas/$taskId"
                params={{ taskId: task.id }}
                className="hover:text-primary line-clamp-2 text-left text-[15px] leading-5 font-semibold transition-colors hover:underline"
              >
                {task.titulo}
              </Link>
              {!compact && task.descripcion ? (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                  {task.descripcion}
                </p>
              ) : null}
            </div>
          </div>
          <Badge
            className={`h-6 shrink-0 rounded-full px-2 text-xs ${TASK_PRIORITY_CLASS[task.prioridad]}`}
          >
            {task.critico ? 'Crítica' : task.prioridad}
          </Badge>
        </div>
        {task.expedienteId ? (
          <Link
            to="/expedientes/$id"
            params={{ id: task.expedienteId }}
            className="text-muted-foreground hover:text-primary flex min-w-0 items-center gap-1.5 text-xs transition-colors"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="bg-muted text-foreground flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 font-medium">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{assigneeName ?? 'Sin responsable'}</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatTaskDate(task.venceEn)}
          </span>
        </div>
        <div className="border-border flex flex-wrap gap-1.5 border-t pt-2.5">
          <Badge variant="secondary" className="h-6 gap-1 px-2 text-[11px]">
            {task.tipo}
          </Badge>
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
            <Badge variant="secondary" className="h-6 gap-1 px-2 text-[11px]">
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
              Recordatorio activo
            </Badge>
          ) : null}
          {task.validacion === 'Propuesto' ? (
            <Badge variant="secondary" className="h-6 px-2 text-[11px]">
              Pendiente de validar
            </Badge>
          ) : null}
        </div>
        {task.validacion === 'Propuesto' && canValidate ? (
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
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
                disabled={pending || !source.trim()}
                onClick={() => void onValidate(task, 'Validado', source, note)}
              >
                Validar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void onValidate(task, 'Rechazado', source, note)}
              >
                Rechazar
              </Button>
            </div>
          </div>
        ) : null}
        {task.validacion !== 'Propuesto' &&
        task.estado !== 'Completada' &&
        task.estado !== 'Cancelada' ? (
          <div className="flex flex-wrap gap-2">
            {task.estado === 'Pendiente' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void onChangeStatus(task, 'En curso')}
              >
                Empezar
              </Button>
            ) : null}
            <Link
              to="/tareas/$taskId"
              params={{ taskId: task.id }}
              className="border-input hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium"
            >
              Abrir detalle
            </Link>
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

function TaskCreateDialog({
  firmId,
  cases,
  members,
  labels,
  pending,
  onCreate,
}: {
  firmId: string
  cases: { id: string; referencia: string; titulo: string }[]
  members: { id: string; nombre: string }[]
  labels: { id: string; nombre: string; color: string }[]
  pending: boolean
  onCreate: (input: CrearTareaInput) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<CrearTareaInput['tipo']>('Tarea')
  const [isSpecialMeeting, setIsSpecialMeeting] = useState(false)
  const [isSpecialCommunication, setIsSpecialCommunication] = useState(false)
  const [caseId, setCaseId] = useState('')
  const participants = useParticipantesPersistentes(firmId, caseId)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const meeting: DetallesReunion | undefined = isSpecialMeeting
        ? {
            startsAt: '',
            endsAt: '',
            mode: text(data, 'meetingMode') as DetallesReunion['mode'],
            location: text(data, 'meetingPreferredLocation'),
            meetingUrl: '',
            preparation: text(data, 'meetingPreparation'),
            attendeeContactIds: data
              .getAll('meetingContacts')
              .filter((value): value is string => typeof value === 'string'),
            attendeeUserIds: data
              .getAll('meetingUsers')
              .filter((value): value is string => typeof value === 'string'),
            specialType: 'meeting',
            status: 'preparation',
            meetingType: text(data, 'meetingType'),
            subject: text(data, 'meetingSubject'),
            attendeeNames: text(data, 'meetingOtherAttendees')
              .split(',')
              .map((name) => name.trim())
              .filter(Boolean),
            durationMinutes: Number(text(data, 'meetingDuration')) || 60,
            preferredDate: text(data, 'meetingPreferredDate'),
            preferredTimeSlot: text(data, 'meetingTimeSlot'),
            preferredLocation: text(data, 'meetingPreferredLocation'),
            internalInstructions: text(data, 'meetingInstructions'),
          }
        : isSpecialCommunication
          ? {
              startsAt: '',
              endsAt: '',
              mode: 'office_bilbao',
              location: '',
              meetingUrl: '',
              preparation: '',
              attendeeContactIds: [],
              attendeeUserIds: [],
              specialType: 'communication',
              communicationChannel: text(data, 'communicationChannel') as NonNullable<
                DetallesReunion['communicationChannel']
              >,
              communicationDirection: text(data, 'communicationDirection') as NonNullable<
                DetallesReunion['communicationDirection']
              >,
              communicationContact: text(data, 'communicationContact'),
              communicationPhone: text(data, 'communicationPhone'),
              communicationSubject: text(data, 'communicationSubject'),
              communicationOriginalContent: text(data, 'communicationOriginalContent'),
            }
          : undefined
      if (meeting?.specialType === 'meeting') {
        const issue = specialMeetingCreationIssue(meeting)
        if (issue) {
          toast.error(issue)
          return
        }
      }
      await onCreate({
        expedienteId: text(data, 'case'),
        oportunidadId: null,
        tipo: kind,
        titulo: text(data, 'title'),
        descripcion: text(data, 'description'),
        prioridad: text(data, 'priority') as CrearTareaInput['prioridad'],
        venceEn: iso(text(data, 'due')),
        recordarEn: iso(text(data, 'reminder')),
        clasePlazo:
          kind === 'Plazo' ? (text(data, 'deadlineClass') as CrearTareaInput['clasePlazo']) : null,
        critico: data.get('critical') === 'on',
        asignadoId: text(data, 'assignee') || null,
        mensajeInicial: text(data, 'initialMessage'),
        etiquetaIds: data.get('label') ? [text(data, 'label')] : [],
        ...(meeting ? { detallesReunion: meeting } : {}),
      })
      toast.success(kind === 'Plazo' ? 'Plazo propuesto; requiere validación.' : 'Tarea creada.')
      form.reset()
      setKind('Tarea')
      setIsSpecialMeeting(false)
      setIsSpecialCommunication(false)
      setCaseId('')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea.')
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="h-4 w-4" aria-hidden="true" /> Crear tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-3xl overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)]">
        <DialogHeader>
          <div className="bg-muted/45 border-b px-6 py-5">
            <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle>Crear tarea</DialogTitle>
            <DialogDescription className="mt-1.5">
              Registra el trabajo pendiente y vincúlalo al expediente correspondiente.
            </DialogDescription>
          </div>
        </DialogHeader>
        {!cases.length ? (
          <div className="px-6 py-8 text-sm">
            Primero necesitas un expediente para poder crear y trazar una tarea.
          </div>
        ) : (
          <form
            className="space-y-5 px-6 py-6"
            aria-busy={pending}
            onSubmit={(event) => void submit(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="title" label="Título *" required className="sm:col-span-2" />
              <Field name="description" label="Descripción" className="sm:col-span-2" />
              <Field name="initialMessage" label="Mensaje inicial" className="sm:col-span-2" />
              <Select
                name="case"
                label="Expediente *"
                required
                onValueChange={setCaseId}
                options={[
                  ['', 'Selecciona expediente'],
                  ...cases.map((item) => [item.id, `${item.referencia} · ${item.titulo}`]),
                ]}
              />
              <div className="space-y-1.5">
                <Label htmlFor="task-kind">Tipo</Label>
                <select
                  id="task-kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as CrearTareaInput['tipo'])}
                  className={selectClassName}
                >
                  <option>Tarea</option>
                  <option>Recordatorio</option>
                  <option>Evento</option>
                  <option>Plazo</option>
                </select>
              </div>
              <Select
                name="priority"
                label="Prioridad"
                options={['Media', 'Alta', 'Baja'].map((value) => [value, value])}
              />
              <Select
                name="assignee"
                label="Responsable"
                options={[
                  ['', 'Sin asignar'],
                  ...members.map((member) => [member.id, member.nombre]),
                ]}
              />
              <Select
                name="label"
                label="Etiqueta"
                options={[['', 'Sin etiqueta'], ...labels.map((label) => [label.id, label.nombre])]}
              />
              <Field
                name="due"
                label="Fecha y hora"
                type="datetime-local"
                required={kind === 'Plazo'}
              />
              <Field name="reminder" label="Recordatorio" type="datetime-local" />
              {kind === 'Plazo' ? (
                <Select
                  name="deadlineClass"
                  label="Clase *"
                  options={[
                    ['Judicial', 'Judicial'],
                    ['Extrajudicial', 'Extrajudicial'],
                  ]}
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input name="critical" type="checkbox" /> Marcar como crítica
              </label>
              {kind === 'Evento' ? (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={isSpecialMeeting}
                    onChange={(event) => {
                      setIsSpecialMeeting(event.target.checked)
                      if (event.target.checked) setIsSpecialCommunication(false)
                    }}
                  />
                  Crear como tarea especial · Reunión
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isSpecialCommunication}
                  onChange={(event) => {
                    setIsSpecialCommunication(event.target.checked)
                    if (event.target.checked) setIsSpecialMeeting(false)
                  }}
                />
                Crear como tarea especial · Comunicación
              </label>
              {isSpecialCommunication ? (
                <div className="bg-muted/30 grid gap-4 rounded-md border p-4 sm:col-span-2 sm:grid-cols-2">
                  <Select
                    name="communicationChannel"
                    label="Canal"
                    options={['Email', 'WhatsApp', 'Llamada'].map((value) => [value, value])}
                  />
                  <Select
                    name="communicationDirection"
                    label="Sentido"
                    options={['Entrada', 'Salida'].map((value) => [value, value])}
                  />
                  <Field name="communicationContact" label="Contacto" />
                  <Field name="communicationPhone" label="Teléfono" />
                  <Field
                    name="communicationSubject"
                    label="Asunto original"
                    className="sm:col-span-2"
                  />
                  <Field
                    name="communicationOriginalContent"
                    label="Resumen de la comunicación original"
                    className="sm:col-span-2"
                  />
                  <p className="text-muted-foreground text-xs sm:col-span-2">
                    La tarea se cerrará al marcarla como contestada. Si aparece trabajo jurídico
                    adicional, crea otra tarea.
                  </p>
                </div>
              ) : null}
              {isSpecialMeeting ? (
                <div className="bg-muted/30 space-y-4 rounded-md border p-4 sm:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      name="meetingType"
                      label="Tipo de reunión"
                      required
                      options={[
                        'Primera cita',
                        'Seguimiento',
                        'Firma / formalización',
                        'Económica',
                        'Interna',
                        'Externa',
                      ].map((value) => [value, value])}
                    />
                    <Field name="meetingSubject" label="Objeto de la reunión" required />
                    <Label>
                      Contactos asistentes
                      <select name="meetingContacts" multiple size={3} className={selectClassName}>
                        {(participants.data ?? [])
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
                      <select name="meetingUsers" multiple size={3} className={selectClassName}>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.nombre}
                          </option>
                        ))}
                      </select>
                    </Label>
                    <Field name="meetingOtherAttendees" label="Otros asistentes" />
                    <Select
                      name="meetingDuration"
                      label="Duración estimada"
                      options={['15', '30', '45', '60', '90'].map((value) => [
                        value,
                        `${value} minutos`,
                      ])}
                    />
                    <Field name="meetingPreferredDate" label="Preferencia de fecha" type="date" />
                    <Select
                      name="meetingTimeSlot"
                      label="Franja preferida"
                      options={['Indiferente', 'Mañana', 'Tarde'].map((value) => [value, value])}
                    />
                    <Select
                      name="meetingMode"
                      label="Modalidad / lugar"
                      options={[
                        ['office_bilbao', 'Despacho Bilbao'],
                        ['office_recalde', 'Despacho Rekalde'],
                        ['phone', 'Teléfono'],
                        ['outside_office', 'Fuera del despacho / videollamada'],
                      ]}
                    />
                    <Field name="meetingPreferredLocation" label="Lugar / dirección" />
                    <Field
                      name="meetingPreparation"
                      label="Preparación previa"
                      className="sm:col-span-2"
                    />
                    <Field
                      name="meetingInstructions"
                      label="Indicaciones internas"
                      className="sm:col-span-2"
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    La reunión se crea en preparación. Las fechas definitivas se guardan al
                    agendarla.
                  </p>
                </div>
              ) : null}
            </div>
            <DialogFooter className="gap-2 border-t pt-5 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                <Plus className="h-4 w-4" aria-hidden="true" />{' '}
                {pending ? 'Creando…' : 'Crear tarea'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
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

function Field({
  name,
  label,
  className,
  defaultValue,
  ...props
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  className?: string
  defaultValue?: string
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`task-${name}`}>{label}</Label>
      <Input id={`task-${name}`} name={name} defaultValue={defaultValue} {...props} />
    </div>
  )
}

function Select({
  name,
  label,
  options,
  required,
  onValueChange,
}: {
  name: string
  label: string
  options: string[][]
  required?: boolean
  onValueChange?: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`task-${name}`}>{label}</Label>
      <select
        id={`task-${name}`}
        name={name}
        required={required}
        onChange={(event) => onValueChange?.(event.target.value)}
        className={selectClassName}
      >
        {options.map(([value, labelValue]) => (
          <option key={`${name}-${value}`} value={value}>
            {labelValue}
          </option>
        ))}
      </select>
    </div>
  )
}

const selectClassName =
  'border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

function taskLabelClass(color: string) {
  const classes: Record<string, string> = {
    gray: 'border-border text-muted-foreground',
    blue: 'border-blue-500/30 text-blue-700 dark:text-blue-300',
    amber: 'border-amber-500/30 text-amber-700 dark:text-amber-300',
    rose: 'border-rose-500/30 text-rose-700 dark:text-rose-300',
    green: 'border-green-500/30 text-green-700 dark:text-green-300',
    purple: 'border-purple-500/30 text-purple-700 dark:text-purple-300',
    teal: 'border-teal-500/30 text-teal-700 dark:text-teal-300',
  }
  return classes[color] ?? classes['gray']
}

function text(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function iso(value: string) {
  return value ? new Date(value).toISOString() : null
}
