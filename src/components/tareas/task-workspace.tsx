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
import { Textarea } from '@/components/ui/textarea'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  useCambiarEstadoTarea,
  useCrearTarea,
  useEditarTarea,
  useTareasPersistentes,
  useValidarPlazo,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'

type TaskView = 'calendar' | 'kanban' | 'list'
type TaskFilterStatus = 'all' | TareaPersistida['estado'] | 'En espera'
type TaskBoardColumnId = 'pending' | 'in-progress' | 'waiting'

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
      return { task, start, end: Math.min(start + CALENDAR_EVENT_DURATION_MINUTES, endOfDay) }
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

export function TaskWorkspace() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const change = useCambiarEstadoTarea(firmId)
  const edit = useEditarTarea(firmId)
  const validate = useValidarPlazo(firmId)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CrearTareaInput['tipo']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TareaPersistida['prioridad']>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<TaskFilterStatus>('all')
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
  const canEditTasks = membership.data?.role !== 'paralegal'
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
  const editTask = async (input: Parameters<typeof edit.mutateAsync>[0]) => {
    try {
      await edit.mutateAsync(input)
      toast.success('Tarea actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la tarea.')
      throw error
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
      {layouts.map(({ task, top, column, columnCount }) => (
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
            minHeight: CALENDAR_EVENT_DURATION_MINUTES - 4,
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
  const [editStatus, setEditStatus] = useState(task.estado)
  const [editAssignee, setEditAssignee] = useState(task.asignadoId ?? '')
  const [editDue, setEditDue] = useState(task.venceEn?.slice(0, 16) ?? '')
  const [editBusy, setEditBusy] = useState(false)
  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEditBusy(true)
    try {
      await onEdit({
        task,
        titulo: editTitle,
        descripcion: editDescription,
        prioridad: editPriority,
        estado: editStatus,
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
              {canEdit ? (
                <button
                  type="button"
                  className="hover:text-primary line-clamp-2 text-left text-[15px] leading-5 font-semibold transition-colors hover:underline"
                  onClick={() => setEditOpen(true)}
                  aria-label={`Editar tarea: ${task.titulo}`}
                >
                  {task.titulo}
                </button>
              ) : (
                <p className="line-clamp-2 text-[15px] leading-5 font-semibold">{task.titulo}</p>
              )}
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
                  <Label htmlFor={`edit-status-${task.id}`}>Estado / columna</Label>
                  <select
                    id={`edit-status-${task.id}`}
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                    value={editStatus}
                    onChange={(event) =>
                      setEditStatus(event.target.value as TareaPersistida['estado'])
                    }
                  >
                    <option>Pendiente</option>
                    <option>En curso</option>
                    <option>Completada</option>
                    <option>Cancelada</option>
                  </select>
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
                <Button type="submit" disabled={editBusy}>
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
