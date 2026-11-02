import { IconButton } from '@doscientos/ui'
import { CalendarDays, ChevronLeft, ChevronRight, Gavel, List, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { TaskCreateDialog } from '@/components/tareas/task-create-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  buildMonthGrid,
  isSameDay,
  isSameMonth,
  shiftMonth,
  startOfMonth,
} from '@/features/calendar/application/calendar-model'
import {
  AGENDA_BUCKETS,
  agendaBucket,
  countdown,
  datedEntries,
  daysUntil,
  isOpenTask,
  nextAgendaItem,
  type AgendaEntry,
} from '@/features/expedientes/application/case-agenda'
import type { CrearTareaInput, TareaPersistida } from '@/features/tareas'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const QUICK: Array<{ label: string; kind: CrearTareaInput['tipo']; title: string }> = [
  { label: 'Señalamiento / vista', kind: 'Evento', title: 'Señalamiento: ' },
  { label: 'Plazo procesal', kind: 'Plazo', title: 'Plazo: ' },
  { label: 'Cita / reunión', kind: 'Evento', title: 'Reunión: ' },
  { label: 'Recordatorio interno', kind: 'Recordatorio', title: '' },
]

const TONE: Record<string, string> = {
  Plazo: 'border-destructive/30 bg-destructive/10 text-destructive',
  Evento: 'border-primary/30 bg-primary/10 text-primary',
  Recordatorio: 'border-warning/30 bg-warning/10 text-warning-foreground',
  Tarea: 'border-border bg-secondary text-secondary-foreground',
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

const isoDay = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`

/** Banner for the case Summary: the next open hearing or deadline. */
export function NextAgendaBanner({
  tasks,
  onOpen,
}: {
  tasks: TareaPersistida[]
  onOpen: () => void
}) {
  const next = nextAgendaItem(tasks)
  if (!next) return null
  const days = daysUntil(next.date)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm',
        days <= 2 ? TONE['Plazo'] : TONE['Evento'],
      )}
    >
      <Gavel className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        <strong>Próximo en agenda:</strong> {next.task.titulo} · {formatDateTime(next.date)}
      </span>
      <Badge variant="outline">{countdown(days)}</Badge>
    </button>
  )
}

type DialogState = { kind: CrearTareaInput['tipo']; title: string; date?: string }

export function AgendaSection({
  tasks,
  firmId,
  expedienteId,
  asignadoId,
  members,
  pending,
  onCreate,
  rowAction,
}: {
  tasks: TareaPersistida[]
  firmId?: string | undefined
  expedienteId: string
  asignadoId: string | null
  members: Array<{ id: string; nombre: string }>
  pending: boolean
  onCreate: (input: CrearTareaInput) => Promise<unknown>
  rowAction?: (task: TareaPersistida) => ReactNode
}) {
  const [view, setView] = useState<'list' | 'month'>('list')
  const [showDone, setShowDone] = useState(false)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const dated = datedEntries(tasks)
  const visible = showDone ? dated : dated.filter((entry) => isOpenTask(entry.task))
  const groups = AGENDA_BUCKETS.map((name) => ({
    name,
    items: visible.filter(
      (entry) => isOpenTask(entry.task) && agendaBucket(daysUntil(entry.date)) === name,
    ),
  }))
  const done = visible.filter((entry) => !isOpenTask(entry.task))

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-base font-semibold">Agenda</h2>
          <p className="text-muted-foreground text-xs">
            Señalamientos, plazos, citas y recordatorios del expediente. Aparecen también en el
            Calendario general.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div
            className="flex rounded-md border p-0.5"
            role="group"
            aria-label="Vista de la agenda"
          >
            <Button
              size="sm"
              variant={view === 'list' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List className="size-4" aria-hidden="true" /> Lista
            </Button>
            <Button
              size="sm"
              variant={view === 'month' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'month'}
              onClick={() => setView('month')}
            >
              <CalendarDays className="size-4" aria-hidden="true" /> Calendario
            </Button>
          </div>
          <Button size="sm" onClick={() => setDialog({ kind: 'Evento', title: '' })}>
            <Plus className="size-4" aria-hidden="true" /> Nuevo apunte
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((quick) => (
          <Button
            key={quick.label}
            size="sm"
            variant="outline"
            onClick={() => setDialog({ kind: quick.kind, title: quick.title })}
          >
            + {quick.label}
          </Button>
        ))}
      </div>

      {view === 'list' ? (
        <Card>
          <CardContent className="space-y-4 pt-4">
            {groups.map((group) =>
              group.items.length ? (
                <section key={group.name}>
                  <h3
                    className={cn(
                      'mb-1 text-xs font-semibold uppercase',
                      group.name === 'Vencidos' && 'text-destructive',
                    )}
                  >
                    {group.name} · {group.items.length}
                  </h3>
                  <div className="divide-y">
                    {group.items.map((entry) => (
                      <AgendaRow
                        key={entry.task.id}
                        entry={entry}
                        action={rowAction?.(entry.task)}
                      />
                    ))}
                  </div>
                </section>
              ) : null,
            )}
            {showDone && done.length ? (
              <section>
                <h3 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                  Atendidos · {done.length}
                </h3>
                <div className="divide-y opacity-70">
                  {done.map((entry) => (
                    <AgendaRow key={entry.task.id} entry={entry} />
                  ))}
                </div>
              </section>
            ) : null}
            {!visible.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No hay nada en la agenda de este expediente.
              </p>
            ) : null}
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showDone}
                onChange={(event) => setShowDone(event.target.checked)}
              />
              Mostrar también los atendidos
            </label>
          </CardContent>
        </Card>
      ) : (
        <MonthView
          month={month}
          entries={visible}
          onShift={(amount) => setMonth((current) => shiftMonth(current, amount))}
          onPickDay={(day) => setDialog({ kind: 'Evento', title: '', date: isoDay(day) })}
        />
      )}

      {dialog ? (
        <TaskCreateDialog
          key={`${dialog.kind}-${dialog.title}-${dialog.date ?? ''}`}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          firmId={firmId}
          expedienteId={expedienteId}
          title="Nuevo apunte en agenda"
          contextLabel="Agenda del expediente"
          defaultAssigneeId={asignadoId}
          members={members}
          defaultKind={dialog.kind}
          defaultTitle={dialog.title || undefined}
          defaultDueDate={dialog.date}
          pending={pending}
          successMessage="Apunte añadido a la agenda del expediente."
          onCreate={async (input) => {
            const result = await onCreate(input)
            setDialog(null)
            return result
          }}
        />
      ) : null}
    </div>
  )
}

function MonthView({
  month,
  entries,
  onShift,
  onPickDay,
}: {
  month: Date
  entries: AgendaEntry[]
  onShift: (amount: number) => void
  onPickDay: (day: Date) => void
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="mb-3 flex items-center justify-between">
          <IconButton label="Mes anterior" variant="ghost" onClick={() => onShift(-1)}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </IconButton>
          <span className="text-sm font-semibold capitalize">
            {new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)}
          </span>
          <IconButton label="Mes siguiente" variant="ghost" onClick={() => onShift(1)}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 gap-px text-xs">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="text-muted-foreground py-1 text-center font-medium">
              {weekday}
            </div>
          ))}
          {buildMonthGrid(month).map((day) => {
            const items = entries.filter((entry) => isSameDay(entry.date, day))
            return (
              <button
                key={day.toISOString()}
                type="button"
                title="Añadir apunte este día"
                onClick={() => onPickDay(day)}
                className={cn(
                  'hover:bg-muted/60 min-h-20 rounded border p-1 text-left align-top',
                  !isSameMonth(day, month) && 'opacity-40',
                  isSameDay(day, new Date()) && 'border-primary',
                )}
              >
                <span className="font-medium">{day.getDate()}</span>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((entry) => (
                    <div
                      key={entry.task.id}
                      className={cn('truncate rounded border px-1', TONE[entry.task.tipo])}
                    >
                      {entry.task.titulo}
                    </div>
                  ))}
                  {items.length > 3 ? (
                    <div className="text-muted-foreground">+{items.length - 3}</div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function AgendaRow({ entry, action }: { entry: AgendaEntry; action?: ReactNode }) {
  const days = daysUntil(entry.date)
  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5">
      <Badge variant="outline" className={TONE[entry.task.tipo]}>
        {entry.task.tipo === 'Evento' ? 'Cita / vista' : entry.task.tipo}
      </Badge>
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium">{entry.task.titulo}</p>
        <p className="text-muted-foreground text-xs">
          {formatDateTime(entry.date)} · {entry.task.estado}
          {entry.task.tipo === 'Plazo' && entry.task.validacion !== 'No aplica'
            ? ` · ${entry.task.validacion}`
            : ''}
        </p>
      </div>
      {isOpenTask(entry.task) ? (
        <Badge variant={days < 0 ? 'destructive' : 'secondary'}>{countdown(days)}</Badge>
      ) : null}
      {action}
    </div>
  )
}
