import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
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
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  useCambiarEstadoTarea,
  useCrearTarea,
  useTareasPersistentes,
  useValidarPlazo,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'

type TaskView = 'calendar' | 'kanban' | 'list'
type TaskFilterStatus = 'all' | TareaPersistida['estado'] | 'En espera'
type TaskBoardColumnId = 'pending' | 'in-progress' | 'waiting'

const AGENDA_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const TASK_BOARD_COLUMNS: ReadonlyArray<{
  id: TaskBoardColumnId
  title: string
  description: string
}> = [
  { id: 'pending', title: 'Pendiente', description: 'Trabajo por iniciar' },
  { id: 'in-progress', title: 'En curso', description: 'Trabajo activo' },
  { id: 'waiting', title: 'En espera', description: 'Plazos pendientes de validación' },
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

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function shiftMonth(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

function calendarDateKey(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** "En espera" es una categoría de visualización para plazos propuestos, no un estado nuevo. */
export function taskBoardColumn(task: TareaPersistida): TaskBoardColumnId | null {
  if (task.validacion === 'Propuesto') return 'waiting'
  if (task.estado === 'Pendiente') return 'pending'
  if (task.estado === 'En curso') return 'in-progress'
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

export function PersistentTaskWorkspace() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const change = useCambiarEstadoTarea(firmId)
  const validate = useValidarPlazo(firmId)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CrearTareaInput['tipo']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TareaPersistida['prioridad']>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<TaskFilterStatus>('all')
  const [view, setView] = useState<TaskView>('kanban')
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()))
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
  if (tasks.isPending || cases.isPending || members.isPending)
    return <PendingPanel title="Cargando agenda" description="Consultando tareas y plazos…" />
  if (tasks.isError || cases.isError || members.isError)
    return (
      <PendingPanel
        title="No se pudo cargar la agenda"
        description="Reintenta en unos instantes."
      />
    )

  const canValidate = membership.data?.role !== 'paralegal'
  const visible = (tasks.data ?? []).filter((task) => {
    const searchable =
      `${task.titulo} ${task.descripcion} ${task.tipo} ${caseNames.get(task.expedienteId ?? '') ?? ''}`.toLowerCase()
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'En espera'
        ? taskBoardColumn(task) === 'waiting'
        : task.estado === statusFilter)
    return (
      (!query.trim() || searchable.includes(query.trim().toLowerCase())) &&
      (typeFilter === 'all' || task.tipo === typeFilter) &&
      (priorityFilter === 'all' || task.prioridad === priorityFilter) &&
      (assigneeFilter === 'all' ||
        (assigneeFilter === '' ? !task.asignadoId : task.asignadoId === assigneeFilter)) &&
      matchesStatus
    )
  })
  const orderedVisible = sortTasksForAgenda(visible)
  const activeFilterCount = [typeFilter, priorityFilter, assigneeFilter, statusFilter].filter(
    (value) => value !== 'all',
  ).length
  const clearFilters = () => {
    setTypeFilter('all')
    setPriorityFilter('all')
    setAssigneeFilter('all')
    setStatusFilter('all')
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

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <SectionHeader
        title="Tareas y plazos"
        subtitle="Fechas compartidas con zona horaria, responsable y trazabilidad."
        actions={
          <TaskCreateDialog
            cases={cases.data ?? []}
            members={members.data ?? []}
            pending={createTask.isPending}
            onCreate={(input) => createTask.mutateAsync(input)}
          />
        }
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
                  ['En espera', 'En espera de validación'],
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
          month={calendarMonth}
          onPreviousMonth={() => setCalendarMonth((current) => shiftMonth(current, -1))}
          onNextMonth={() => setCalendarMonth((current) => shiftMonth(current, 1))}
          onCurrentMonth={() => setCalendarMonth(monthStart(new Date()))}
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
            />
          ))}
          {!orderedVisible.length ? <EmptyTasks /> : null}
        </section>
      )}
    </main>
  )
}

function TaskCalendar({
  tasks,
  month,
  onPreviousMonth,
  onNextMonth,
  onCurrentMonth,
}: {
  tasks: TareaPersistida[]
  month: Date
  onPreviousMonth: () => void
  onNextMonth: () => void
  onCurrentMonth: () => void
}) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const leadingDays = (firstDay.getDay() + 6) % 7
  const gridDays = Math.ceil((leadingDays + daysInMonth) / 7) * 7
  const today = new Date()
  const itemsByDay = new Map<string, TareaPersistida[]>()
  const undated = tasks.filter((task) => !task.venceEn)

  tasks.forEach((task) => {
    if (!task.venceEn) return
    const taskDate = new Date(task.venceEn)
    if (taskDate.getFullYear() !== month.getFullYear() || taskDate.getMonth() !== month.getMonth())
      return
    const key = calendarDateKey(task.venceEn)
    itemsByDay.set(key, [...(itemsByDay.get(key) ?? []), task])
  })

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
                <h2 className="text-base font-semibold capitalize">
                  {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
                    month,
                  )}
                </h2>
                <p className="text-muted-foreground text-xs">Plazos y tareas ordenados por fecha</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onPreviousMonth}
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onCurrentMonth}>
                Hoy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onNextMonth}
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </header>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="bg-muted/45 grid grid-cols-7 border-b">
                {AGENDA_WEEKDAYS.map((day) => (
                  <p
                    key={day}
                    className="text-muted-foreground px-3 py-2 text-center text-[11px] font-semibold tracking-wide uppercase"
                  >
                    {day}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: gridDays }, (_, index) => {
                  const dayNumber = index - leadingDays + 1
                  const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth
                  const date = new Date(month.getFullYear(), month.getMonth(), dayNumber)
                  const dayTasks = isCurrentMonth
                    ? (itemsByDay.get(calendarDateKey(date.toISOString())) ?? [])
                    : []
                  const isToday = isCurrentMonth && date.toDateString() === today.toDateString()
                  return (
                    <div
                      key={`${month.getFullYear()}-${month.getMonth()}-${dayNumber}`}
                      className={`min-h-36 border-r border-b p-2 ${isCurrentMonth ? 'bg-card' : 'bg-muted/25'}`}
                    >
                      {isCurrentMonth ? (
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                        >
                          {dayNumber}
                        </span>
                      ) : null}
                      <div className="mt-1.5 space-y-1">
                        {dayTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className={`truncate rounded-md border px-1.5 py-1 text-[11px] font-medium ${TASK_PRIORITY_CLASS[task.prioridad]}`}
                            title={task.titulo}
                          >
                            {task.titulo}
                          </div>
                        ))}
                        {dayTasks.length > 3 ? (
                          <p className="text-muted-foreground px-1 text-[11px] font-medium">
                            +{dayTasks.length - 3} más
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
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

function TaskKanban({
  tasks,
  canValidate,
  pending,
  caseNames,
  memberNames,
  onChangeStatus,
  onValidate,
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
        Arrastra una tarea entre Pendiente y En curso para actualizar su estado. Los plazos en
        espera requieren validación profesional.
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
  drag,
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
  drag?: {
    onStart: (event: DragEvent<HTMLButtonElement>) => void
    onEnd: () => void
    isDragged: boolean
  }
}) {
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
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
              <p className="line-clamp-2 text-[15px] leading-5 font-semibold">{task.titulo}</p>
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
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void onChangeStatus(task, 'Completada')}
            >
              Completar
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TaskCreateDialog({
  cases,
  members,
  pending,
  onCreate,
}: {
  cases: { id: string; referencia: string; titulo: string }[]
  members: { id: string; nombre: string }[]
  pending: boolean
  onCreate: (input: CrearTareaInput) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<CrearTareaInput['tipo']>('Tarea')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
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
      })
      toast.success(kind === 'Plazo' ? 'Plazo propuesto; requiere validación.' : 'Tarea creada.')
      form.reset()
      setKind('Tarea')
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
              <Select
                name="case"
                label="Expediente *"
                required
                options={cases.map((item) => [item.id, `${item.referencia} · ${item.titulo}`])}
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
  ...props
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={`task-${name}`}>{label}</Label>
      <Input id={`task-${name}`} name={name} {...props} />
    </div>
  )
}

function Select({
  name,
  label,
  options,
  required,
}: {
  name: string
  label: string
  options: string[][]
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`task-${name}`}>{label}</Label>
      <select id={`task-${name}`} name={name} required={required} className={selectClassName}>
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

function text(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function iso(value: string) {
  return value ? new Date(value).toISOString() : null
}
