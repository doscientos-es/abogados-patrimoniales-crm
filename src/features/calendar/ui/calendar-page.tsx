import { Link } from '@tanstack/react-router'
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, List, Plus } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { buttonVariants, Button } from '@/components/ui/button'
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
import { useActiveMembership, useAuthSession } from '@/features/auth'
import {
  buildMonthGrid,
  calendarEntries,
  dayKey,
  isSameDay,
  isSameMonth,
  shiftMonth,
  startOfMonth,
  type CalendarEntry,
} from '@/features/calendar/application/calendar-model'
import { useMiembrosDespacho } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import {
  useCrearTarea,
  useEditarTarea,
  useTareasPersistentes,
  type CrearTareaInput,
  type TareaPersistida,
} from '@/features/tareas'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const EVENT_LIMIT_PER_DAY = 3

type CalendarView = 'month' | 'agenda'
type CalendarFilter = 'all' | TareaPersistida['tipo']

const eventStyle: Record<TareaPersistida['tipo'], string> = {
  Tarea: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
  Recordatorio: 'border-warning/30 bg-warning/10 text-warning-foreground hover:bg-warning/15',
  Evento: 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
  Plazo: 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
}

const eventLabel: Record<TareaPersistida['tipo'], string> = {
  Tarea: 'Tarea',
  Recordatorio: 'Recordatorio',
  Evento: 'Evento',
  Plazo: 'Plazo',
}

function dateTimeLocalValue(value: Date) {
  const offsetDate = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

function formatEventDate(value: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(value)
    .replace(',', ' ·')
}

export function CalendarPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasks = useTareasPersistentes(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)
  const createTask = useCrearTarea(firmId)
  const editTask = useEditarTarea(firmId)
  const [view, setView] = useState<CalendarView>('month')
  const [filter, setFilter] = useState<CalendarFilter>('all')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [createDay, setCreateDay] = useState<Date | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null)

  const entries = useMemo(
    () =>
      calendarEntries(tasks.data ?? []).filter(
        (entry) => filter === 'all' || entry.task.tipo === filter,
      ),
    [filter, tasks.data],
  )
  const days = useMemo(() => buildMonthGrid(month), [month])
  const entriesByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEntry[]>()
    for (const entry of entries)
      grouped.set(entry.dayKey, [...(grouped.get(entry.dayKey) ?? []), entry])
    return grouped
  }, [entries])
  const monthEntries = entries.filter((entry) => isSameMonth(entry.date, month))
  const criticalCount = monthEntries.filter(
    (entry) => entry.task.critico || entry.task.tipo === 'Plazo',
  ).length
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(
    month,
  )

  if (session.status === 'loading' || membership.isPending)
    return (
      <PendingPanel title="Cargando calendario" description="Consultando el despacho activo…" />
    )
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Calendario no disponible"
        description="Necesitas una membresía activa."
      />
    )
  if (tasks.isPending || cases.isPending || members.isPending)
    return (
      <PendingPanel title="Cargando calendario" description="Preparando las fechas del despacho…" />
    )
  if (tasks.isError || cases.isError || members.isError)
    return (
      <PendingPanel
        title="No se pudo cargar el calendario"
        description="Reintenta en unos instantes."
      />
    )

  return (
    <main className="mx-auto max-w-375 space-y-4 p-3 sm:p-6">
      <SectionHeader
        title="Calendario"
        subtitle="Vista centralizada de tareas, recordatorios, eventos y plazos del despacho."
        actions={
          <Link to="/tareas" className={buttonVariants({ className: 'gap-1.5' })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Nueva tarea
          </Link>
        }
      />

      <section className="flex flex-wrap items-center gap-2" aria-label="Controles del calendario">
        <div
          className="border-border bg-muted/30 flex rounded-lg border p-1"
          role="tablist"
          aria-label="Vista"
        >
          <CalendarViewButton
            active={view === 'month'}
            onClick={() => setView('month')}
            label="Mes"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </CalendarViewButton>
          <CalendarViewButton
            active={view === 'agenda'}
            onClick={() => setView('agenda')}
            label="Agenda"
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </CalendarViewButton>
        </div>
        <fieldset className="border-border bg-card flex overflow-x-auto rounded-lg border p-1">
          <legend className="sr-only">Filtrar por tipo</legend>
          {(['all', 'Tarea', 'Evento', 'Plazo', 'Recordatorio'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                filter === value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'all' ? 'Todo' : eventLabel[value]}
            </button>
          ))}
        </fieldset>
        <Badge variant="secondary" className="h-8 px-2.5 tabular-nums">
          {monthEntries.length} {monthEntries.length === 1 ? 'fecha' : 'fechas'}
        </Badge>
        {criticalCount ? (
          <Badge variant="destructive" className="h-8 px-2.5 tabular-nums">
            {criticalCount} prioritarias
          </Badge>
        ) : null}
      </section>

      <Card className="border-border/80 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <CalendarToolbar
            label={monthLabel}
            onPrevious={() => setMonth((current) => shiftMonth(current, -1))}
            onNext={() => setMonth((current) => shiftMonth(current, 1))}
            onToday={() => setMonth(startOfMonth(new Date()))}
          />
          {view === 'month' ? (
            <MonthGrid
              days={days}
              month={month}
              entriesByDay={entriesByDay}
              onCreateEvent={setCreateDay}
              onSelectEntry={setSelectedEntry}
            />
          ) : (
            <Agenda entries={monthEntries} month={month} onSelectEntry={setSelectedEntry} />
          )}
        </CardContent>
      </Card>
      <CreateEventDialog
        key={createDay?.toISOString()}
        day={createDay}
        cases={cases.data ?? []}
        members={members.data ?? []}
        pending={createTask.isPending}
        onOpenChange={(open) => {
          if (!open) setCreateDay(null)
        }}
        onCreate={(input) => createTask.mutateAsync(input)}
      />
      <EventDetailDialog
        key={selectedEntry?.task.id}
        entry={selectedEntry}
        pending={editTask.isPending}
        onUpdate={(task, dueAt) =>
          editTask.mutateAsync({
            task,
            titulo: task.titulo,
            descripcion: task.descripcion,
            estado: task.estado,
            prioridad: task.prioridad,
            venceEn: dueAt,
            recordarEn: task.recordarEn,
            asignadoId: task.asignadoId,
          })
        }
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null)
        }}
      />
    </main>
  )
}

function CalendarViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children} {label}
    </button>
  )
}

function CalendarToolbar({
  label,
  onPrevious,
  onNext,
  onToday,
}: {
  label: string
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <header className="from-primary/10 via-background flex flex-wrap items-center justify-between gap-3 border-b bg-linear-to-r to-transparent px-4 py-3 sm:px-5">
      <h2 className="text-base font-semibold capitalize sm:text-lg">{label}</h2>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mes anterior"
          onClick={onPrevious}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onToday}>
          Hoy
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mes siguiente"
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}

function MonthGrid({
  days,
  month,
  entriesByDay,
  onCreateEvent,
  onSelectEntry,
}: {
  days: Date[]
  month: Date
  entriesByDay: ReadonlyMap<string, CalendarEntry[]>
  onCreateEvent: (day: Date) => void
  onSelectEntry: (entry: CalendarEntry) => void
}) {
  const today = new Date()
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-175 grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="bg-muted/45 border-b px-2 py-2 text-center text-[11px] font-semibold tracking-wide uppercase"
          >
            {weekday}
          </div>
        ))}
        {days.map((day) => {
          const dayEntries = entriesByDay.get(dayKey(day)) ?? []
          const currentMonth = isSameMonth(day, month)
          const isToday = isSameDay(day, today)
          const dateLabel = new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(day)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'relative min-h-32 border-r border-b p-1.5 last:border-r-0',
                !currentMonth && 'bg-muted/20',
              )}
            >
              <button
                type="button"
                aria-label={`Crear evento el ${dateLabel}`}
                onClick={() => onCreateEvent(day)}
                className="focus-visible:ring-ring absolute inset-0 z-0 focus-visible:ring-2 focus-visible:outline-none"
              />
              <div className="relative z-10 mb-1 flex justify-end">
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                    isToday && 'bg-primary text-primary-foreground',
                    !currentMonth && 'text-muted-foreground',
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="relative z-10 space-y-1">
                {dayEntries.slice(0, EVENT_LIMIT_PER_DAY).map((entry) => (
                  <CalendarEvent
                    key={entry.task.id}
                    entry={entry}
                    onSelect={() => onSelectEntry(entry)}
                  />
                ))}
                {dayEntries.length > EVENT_LIMIT_PER_DAY ? (
                  <p className="text-muted-foreground px-1 text-[10px] font-medium">
                    +{dayEntries.length - EVENT_LIMIT_PER_DAY} más
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Agenda({
  entries,
  month,
  onSelectEntry,
}: {
  entries: CalendarEntry[]
  month: Date
  onSelectEntry: (entry: CalendarEntry) => void
}) {
  const grouped = new Map<string, CalendarEntry[]>()
  for (const entry of entries)
    grouped.set(entry.dayKey, [...(grouped.get(entry.dayKey) ?? []), entry])
  const dateLabel = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  if (!entries.length)
    return (
      <div className="p-8 text-center">
        <CheckSquare className="text-muted-foreground/60 mx-auto h-8 w-8" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">No hay fechas para este mes</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Crea o programa una tarea desde la sección de Tareas.
        </p>
      </div>
    )

  return (
    <section
      aria-label={`Agenda de ${month.toLocaleDateString('es-ES', { month: 'long' })}`}
      className="divide-y"
    >
      {[...grouped.values()].map((dayEntries) => {
        const firstEntry = dayEntries[0]
        if (!firstEntry) return null
        return (
          <div
            key={firstEntry.dayKey}
            className="grid gap-3 p-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:px-5"
          >
            <h3 className="text-sm font-semibold capitalize">
              {dateLabel.format(firstEntry.date)}
            </h3>
            <div className="space-y-2">
              {dayEntries.map((entry) => (
                <CalendarEvent
                  key={entry.task.id}
                  entry={entry}
                  agenda
                  onSelect={() => onSelectEntry(entry)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function CalendarEvent({
  entry,
  agenda = false,
  onSelect,
}: {
  entry: CalendarEntry
  agenda?: boolean
  onSelect: () => void
}) {
  const task = entry.task
  const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(
    entry.date,
  )

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      title={`${eventLabel[task.tipo]} · ${time} · ${task.titulo}`}
      aria-label={`Ver detalles de ${task.titulo}`}
      className={cn(
        'block w-full rounded-md border text-left transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        eventStyle[task.tipo],
        task.critico && 'ring-destructive/30 ring-1',
        agenda ? 'px-3 py-2 text-sm' : 'truncate px-1.5 py-1 text-[10px] font-medium',
      )}
    >
      {agenda ? (
        <span className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-semibold tabular-nums">{time}</span>
          <span className="min-w-0 truncate font-medium">{task.titulo}</span>
          <span className="ml-auto shrink-0 text-[11px] opacity-75">{eventLabel[task.tipo]}</span>
        </span>
      ) : (
        <span className="block truncate">
          <span className="mr-1 opacity-70">{time}</span>
          {task.titulo}
        </span>
      )}
    </button>
  )
}

function CreateEventDialog({
  day,
  cases,
  members,
  pending,
  onOpenChange,
  onCreate,
}: {
  day: Date | null
  cases: { id: string; referencia: string; titulo: string }[]
  members: { id: string; nombre: string }[]
  pending: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: CrearTareaInput) => Promise<unknown>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [caseId, setCaseId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueAt, setDueAt] = useState(() =>
    day ? dateTimeLocalValue(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9)) : '',
  )

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTitle('')
      setDescription('')
      setCaseId('')
      setAssigneeId('')
      setDueAt('')
    }
    onOpenChange(open)
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await onCreate({
        expedienteId: caseId,
        oportunidadId: null,
        tipo: 'Evento',
        titulo: title,
        descripcion: description,
        prioridad: 'Media',
        venceEn: dueAt ? new Date(dueAt).toISOString() : null,
        recordarEn: null,
        clasePlazo: null,
        critico: false,
        asignadoId: assigneeId || null,
      })
      toast.success('Evento creado.')
      handleOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el evento.')
    }
  }

  return (
    <Dialog open={Boolean(day)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Crear evento</DialogTitle>
          <DialogDescription>
            {day
              ? `Programa un evento para el ${formatEventDate(new Date(day.getFullYear(), day.getMonth(), day.getDate()))}.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        {!cases.length ? (
          <p className="text-sm">Primero necesitas un expediente para poder vincular el evento.</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div className="space-y-1.5">
              <Label htmlFor="calendar-event-title">Título *</Label>
              <Input
                id="calendar-event-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={240}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calendar-event-description">Descripción</Label>
              <Textarea
                id="calendar-event-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="calendar-event-case">Expediente *</Label>
                <select
                  id="calendar-event-case"
                  value={caseId}
                  onChange={(event) => setCaseId(event.target.value)}
                  required
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  <option value="">Selecciona un expediente</option>
                  {cases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.referencia} · {item.titulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calendar-event-assignee">Responsable</Label>
                <select
                  id="calendar-event-assignee"
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="calendar-event-due">Fecha y hora *</Label>
                <Input
                  id="calendar-event-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creando…' : 'Crear evento'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EventDetailDialog({
  entry,
  pending,
  onUpdate,
  onOpenChange,
}: {
  entry: CalendarEntry | null
  pending: boolean
  onUpdate: (task: TareaPersistida, dueAt: string | null) => Promise<unknown>
  onOpenChange: (open: boolean) => void
}) {
  const task = entry?.task
  const updateDate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!task) return
    const dueAtValue = new FormData(event.currentTarget).get('dueAt')
    const dueAt = typeof dueAtValue === 'string' ? dueAtValue : ''
    try {
      await onUpdate(task, dueAt ? new Date(dueAt).toISOString() : null)
      toast.success('Fecha de tarea actualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la fecha.')
    }
  }

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {task && entry ? (
          <>
            <DialogHeader>
              <DialogTitle>{task.titulo}</DialogTitle>
              <DialogDescription>
                {eventLabel[task.tipo]} · {formatEventDate(entry.date)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {task.descripcion ? (
                <p className="text-muted-foreground whitespace-pre-wrap">{task.descripcion}</p>
              ) : (
                <p className="text-muted-foreground">Sin descripción.</p>
              )}
              <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                <div>
                  <dt className="text-muted-foreground text-xs">Estado</dt>
                  <dd className="font-medium">{task.estado}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Prioridad</dt>
                  <dd className="font-medium">{task.critico ? 'Crítica' : task.prioridad}</dd>
                </div>
              </dl>
              <form className="space-y-1.5" onSubmit={(event) => void updateDate(event)}>
                <Label htmlFor={`calendar-task-date-${task.id}`}>Fecha y hora</Label>
                <div className="flex gap-2">
                  <Input
                    id={`calendar-task-date-${task.id}`}
                    name="dueAt"
                    type="datetime-local"
                    defaultValue={task.venceEn ? dateTimeLocalValue(new Date(task.venceEn)) : ''}
                  />
                  <Button type="submit" variant="outline" disabled={pending}>
                    Actualizar fecha
                  </Button>
                </div>
              </form>
            </div>
            <DialogFooter>
              <Link to="/tareas/$taskId" params={{ taskId: task.id }} className={buttonVariants()}>
                Abrir tarea
              </Link>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
