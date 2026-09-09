import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CalendarClock, LayoutDashboard, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
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

/** "En espera" es una categoría de visualización para plazos propuestos, no un estado nuevo. */
export function taskBoardColumn(task: TareaPersistida): TaskBoardColumnId | null {
  if (task.validacion === 'Propuesto') return 'waiting'
  if (task.estado === 'Pendiente') return 'pending'
  if (task.estado === 'En curso') return 'in-progress'
  return null
}

export function PersistentTaskWorkspace({ mode = 'tasks' }: { mode?: 'tasks' | 'calendar' }) {
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
  const caseNames = useMemo(
    () => new Map((cases.data ?? []).map((item) => [item.id, `${item.referencia} · ${item.titulo}`])),
    [cases.data],
  )
  const visible = (tasks.data ?? []).filter((task) => {
    if (mode === 'calendar' && !task.venceEn) return false
    const searchable = `${task.titulo} ${task.descripcion} ${task.tipo} ${caseNames.get(task.expedienteId ?? '') ?? ''}`.toLowerCase()
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'En espera'
        ? taskBoardColumn(task) === 'waiting'
        : task.estado === statusFilter)
    return (
      (!query.trim() || searchable.includes(query.trim().toLowerCase())) &&
      (typeFilter === 'all' || task.tipo === typeFilter) &&
      (priorityFilter === 'all' || task.prioridad === priorityFilter) &&
      (assigneeFilter === 'all' || task.asignadoId === assigneeFilter) &&
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
        title={mode === 'tasks' ? 'Tareas y plazos' : 'Calendario unificado'}
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
      <Card className="border-border/80 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
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
              className="bg-muted/20 h-9 pl-10 shadow-none"
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
                  <Button type="button" variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
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
        </CardContent>
      </Card>
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
  return (
    <section aria-label="Tablero Kanban de tareas" className="overflow-x-auto pb-2">
      <div className="grid min-w-[900px] grid-cols-3 gap-4">
        {TASK_BOARD_COLUMNS.map((column) => {
          const items = tasks.filter((task) => taskBoardColumn(task) === column.id)
          return (
            <section key={column.id} className="bg-muted/45 min-h-72 rounded-xl border p-3">
              <header className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{column.title}</h2>
                  <p className="text-muted-foreground mt-1 text-xs">{column.description}</p>
                </div>
                <Badge variant="secondary" className="tabular-nums">
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
                  />
                ))}
                {!items.length ? (
                  <p className="text-muted-foreground bg-card/50 rounded-lg border border-dashed px-3 py-8 text-center text-xs">
                    Sin elementos en esta categoría.
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
}) {
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  return (
    <Card>
      <CardContent className={`space-y-3 ${compact ? 'p-4' : 'pt-6'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{task.titulo}</p>
            {task.descripcion ? <p className="text-muted-foreground mt-1 text-sm">{task.descripcion}</p> : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Badge variant="outline">{task.tipo}</Badge>
            <Badge variant={task.critico || task.prioridad === 'Alta' ? 'destructive' : 'secondary'}>
              {task.critico ? 'Crítica' : task.prioridad}
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          {task.venceEn ? new Date(task.venceEn).toLocaleString('es-ES') : 'Sin fecha'}
        </p>
        <div className="flex flex-wrap gap-2">
          {task.expedienteId ? (
            <Link
              to="/expedientes/$id"
              params={{ id: task.expedienteId }}
              className="text-primary text-sm font-medium hover:underline"
            >
              Abrir expediente
            </Link>
          ) : null}
          {task.oportunidadId ? (
            <Link
              to="/oportunidades/$id"
              params={{ id: task.oportunidadId }}
              className="text-primary text-sm font-medium hover:underline"
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
        {task.estado !== 'Completada' && task.estado !== 'Cancelada' ? (
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
          <form className="space-y-5 px-6 py-6" aria-busy={pending} onSubmit={(event) => void submit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="title" label="Título *" required autoFocus className="sm:col-span-2" />
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
                options={[['', 'Sin asignar'], ...members.map((member) => [member.id, member.nombre])]}
              />
              <Field name="due" label="Fecha y hora" type="datetime-local" required={kind === 'Plazo'} />
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
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {pending ? 'Creando…' : 'Crear tarea'}
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClassName}>
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
  return <p className="text-muted-foreground py-10 text-center text-sm">No hay elementos que mostrar.</p>
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
  autoFocus?: boolean
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