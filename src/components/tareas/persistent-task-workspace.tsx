import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import {
  CalendarClock,
  GripVertical,
  LayoutDashboard,
  Plus,
  Search,
  SlidersHorizontal,
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

type TaskView = 'kanban' | 'list'
type TaskFilterStatus = 'all' | TareaPersistida['estado'] | 'En espera'
type TaskBoardColumnId = 'pending' | 'in-progress' | 'waiting'

const TASK_BOARD_COLUMNS: ReadonlyArray<{
  id: TaskBoardColumnId
  title: string
  description: string
}> = [
  { id: 'pending', title: 'Pendiente', description: 'Trabajo por iniciar' },
  { id: 'in-progress', title: 'En curso', description: 'Trabajo activo' },
  { id: 'waiting', title: 'En espera', description: 'Plazos pendientes de validación' },
]

const TASK_COLUMN_STYLES: Record<TaskBoardColumnId, { panel: string; dot: string; count: string }> =
  {
    pending: {
      panel: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/25',
      dot: 'bg-amber-500',
      count:
        'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
    },
    'in-progress': {
      panel: 'border-sky-200/80 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/25',
      dot: 'bg-sky-500',
      count:
        'border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
    },
    waiting: {
      panel: 'border-violet-200/80 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/25',
      dot: 'bg-violet-500',
      count:
        'border-violet-200 bg-violet-100 text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
    },
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
  const caseNames = useMemo(
    () =>
      new Map((cases.data ?? []).map((item) => [item.id, `${item.referencia} · ${item.titulo}`])),
    [cases.data],
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
          {visible.length} {visible.length === 1 ? 'elemento' : 'elementos'}
        </Badge>
        <div className="ml-auto">
          <ViewSwitch
            value={view}
            onChange={(value) => setView(value as TaskView)}
            options={[
              { id: 'kanban', label: 'Kanban' },
              { id: 'list', label: 'Lista' },
            ]}
          />
        </div>
      </div>
      {view === 'kanban' ? (
        <TaskKanban
          tasks={visible}
          canValidate={canValidate}
          pending={change.isPending || validate.isPending}
          onChangeStatus={changeStatus}
          onValidate={validateTask}
        />
      ) : (
        <section aria-label="Lista de tareas" className="space-y-3">
          {visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canValidate={canValidate}
              pending={change.isPending || validate.isPending}
              onChangeStatus={changeStatus}
              onValidate={validateTask}
            />
          ))}
          {!visible.length ? <EmptyTasks /> : null}
        </section>
      )}
    </main>
  )
}

function TaskKanban({
  tasks,
  canValidate,
  pending,
  onChangeStatus,
  onValidate,
}: {
  tasks: TareaPersistida[]
  canValidate: boolean
  pending: boolean
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
      <div className="grid min-w-[960px] grid-cols-3 gap-4">
        {TASK_BOARD_COLUMNS.map((column) => {
          const items = tasks.filter((task) => taskBoardColumn(task) === column.id)
          const styles = TASK_COLUMN_STYLES[column.id]
          return (
            <section
              key={column.id}
              className={`min-h-80 rounded-2xl border p-3 shadow-sm transition-all ${styles.panel} ${canDropIn(column.id) ? 'ring-primary/35 scale-[1.01] ring-2' : ''}`}
              onDragOver={(event) => {
                if (canDropIn(column.id)) event.preventDefault()
              }}
              onDrop={(event) => dropInColumn(event, column.id)}
            >
              <header className="mb-4 flex items-start justify-between gap-3 px-1 pt-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} aria-hidden="true" />
                    <h2 className="text-sm font-semibold tracking-tight">{column.title}</h2>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-xs leading-4">
                    {column.description}
                  </p>
                </div>
                <Badge className={`shrink-0 border tabular-nums ${styles.count}`}>
                  {items.length}
                </Badge>
              </header>
              <div className="space-y-3">
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canValidate={canValidate}
                    pending={pending}
                    compact
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
                  <p className="text-muted-foreground bg-card/55 rounded-xl border border-dashed px-3 py-9 text-center text-xs">
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
  onChangeStatus,
  onValidate,
  drag,
}: {
  task: TareaPersistida
  canValidate: boolean
  pending: boolean
  compact?: boolean
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
      className={`${compact ? 'group/task border-border/70 bg-card/95 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md' : ''} ${drag?.isDragged ? 'scale-[0.98] opacity-50' : ''}`}
    >
      <CardContent className={`space-y-3 ${compact ? 'p-4' : 'pt-6'}`}>
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
              <p className="line-clamp-2 text-sm leading-5 font-semibold">{task.titulo}</p>
              {task.descripcion ? (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                  {task.descripcion}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {task.tipo}
            </Badge>
            <Badge
              variant={task.validacion === 'Propuesto' ? 'secondary' : 'outline'}
              className="h-5 px-1.5 text-[10px]"
            >
              {task.validacion === 'Propuesto' ? 'Pendiente de validar' : task.estado}
            </Badge>
            <Badge
              variant={task.critico || task.prioridad === 'Alta' ? 'destructive' : 'secondary'}
              className="h-5 px-1.5 text-[10px]"
            >
              {task.critico ? 'Crítica' : task.prioridad}
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground bg-muted/55 flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {task.venceEn ? new Date(task.venceEn).toLocaleString('es-ES') : 'Sin fecha'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {task.expedienteId ? (
            <Link
              to="/expedientes/$id"
              params={{ id: task.expedienteId }}
              className="bg-primary/8 text-primary hover:bg-primary/12 rounded-md px-2 py-1 text-xs font-medium transition-colors"
            >
              Abrir expediente
            </Link>
          ) : null}
          {task.oportunidadId ? (
            <Link
              to="/oportunidades/$id"
              params={{ id: task.oportunidadId }}
              className="bg-primary/8 text-primary hover:bg-primary/12 rounded-md px-2 py-1 text-xs font-medium transition-colors"
            >
              Abrir Lead
            </Link>
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
