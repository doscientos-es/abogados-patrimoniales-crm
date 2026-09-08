import { Link } from '@tanstack/react-router'
import { AlertTriangle, Bookmark, GripVertical, Search } from 'lucide-react'
import { useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ContactoPersistido } from '@/features/contactos'
import type { MiembroDespacho } from '@/features/crm'
import {
  CASE_CONTROL_COLUMNS,
  caseAlerts,
  caseControlColumn,
  caseDependency,
  caseLastMovement,
  caseMegaphase,
  casePhaseForColumn,
  relativeDays,
  type CaseControlColumnId,
} from '@/features/expedientes/application/case-control'
import type {
  ActuacionPersistida,
  ExpedientePersistido,
} from '@/features/expedientes/application/case-types'
import type { TareaPersistida } from '@/features/tareas/application/task-types'

type QuickFilter = 'all' | 'mine' | 'waiting' | 'action' | 'execution' | 'alerts'

const QUICK_FILTERS: ReadonlyArray<[QuickFilter, string]> = [
  ['mine', 'Mis expedientes'],
  ['waiting', 'En espera de tercero'],
  ['action', 'Debemos actuar nosotros'],
  ['execution', 'En ejecución'],
  ['alerts', 'Con alertas'],
]

export function PersistentCasesPage({
  expedientes,
  contactos,
  miembros,
  tareas,
  actuaciones,
  usuarioId,
  moving,
  onMove,
  actions,
}: {
  expedientes: ExpedientePersistido[]
  contactos: ContactoPersistido[]
  miembros: MiembroDespacho[]
  tareas: TareaPersistida[]
  actuaciones: ActuacionPersistida[]
  usuarioId: string
  moving: boolean
  onMove: (expediente: ExpedientePersistido, fase: string) => Promise<void>
  actions?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [nature, setNature] = useState<'all' | 'Judicial' | 'Extrajudicial'>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [assignee, setAssignee] = useState('all')
  const [status, setStatus] = useState('all')
  const [dependency, setDependency] = useState('all')
  const [saved, setSaved] = useState(false)
  const now = useMemo(() => Date.now(), [])
  const contactNames = useMemo(
    () => new Map(contactos.map((item) => [item.id, item.nombre])),
    [contactos],
  )
  const memberNames = useMemo(
    () => new Map(miembros.map((item) => [item.id, item.nombre])),
    [miembros],
  )
  const statusOptions = useMemo(
    () => [...new Set(expedientes.map((item) => item.estadoGeneral).filter(Boolean))].sort(),
    [expedientes],
  )
  const dependencyOptions = useMemo(
    () => [...new Set(expedientes.map((item) => caseDependency(item.estadoOperativo)))].sort(),
    [expedientes],
  )
  const filtered = expedientes.filter((item) => {
    const text =
      `${item.referencia} ${item.titulo} ${item.area} ${contactNames.get(item.contactoPrincipalId) ?? ''}`.toLowerCase()
    const alerts = caseAlerts(item, tareas, actuaciones, now)
    const itemDependency = caseDependency(item.estadoOperativo)
    const quickMatches =
      quickFilter === 'all' ||
      (quickFilter === 'mine' && item.asignadoId === usuarioId) ||
      (quickFilter === 'waiting' && itemDependency === 'En espera de tercero') ||
      (quickFilter === 'action' && itemDependency === 'Debemos actuar nosotros') ||
      (quickFilter === 'execution' && itemDependency === 'En ejecución') ||
      (quickFilter === 'alerts' && alerts.length > 0)
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (nature === 'all' || item.naturaleza === nature) &&
      (assignee === 'all' || item.asignadoId === assignee) &&
      (status === 'all' || item.estadoGeneral === status) &&
      (dependency === 'all' || itemDependency === dependency) &&
      quickMatches
    )
  })

  const saveCurrentView = () => {
    window.localStorage.setItem(
      'lex-case-control-view',
      JSON.stringify({ nature, quickFilter, assignee, status, dependency }),
    )
    setSaved(true)
    toast.success('Vista actual guardada en este navegador.')
  }
  const moveToColumn = async (item: ExpedientePersistido, column: CaseControlColumnId) => {
    if (caseControlColumn(item) !== column) await onMove(item, casePhaseForColumn(column))
  }
  const dropInColumn = (event: DragEvent<HTMLElement>, column: CaseControlColumnId) => {
    event.preventDefault()
    const item = expedientes.find(
      (candidate) => candidate.id === event.dataTransfer.getData('text/plain'),
    )
    if (item) void moveToColumn(item, column)
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 p-6">
      <SectionHeader
        title="Control de expedientes"
        subtitle="Supervisión y seguimiento del recorrido de los expedientes judiciales y extrajudiciales del despacho."
        actions={actions}
      />
      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        {(['Extrajudicial', 'Judicial', 'all'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={nature === value ? 'default' : 'ghost'}
            onClick={() => setNature(value)}
          >
            {value === 'all' ? 'Todos — vista general' : value}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_FILTERS.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={quickFilter === value ? 'secondary' : 'outline'}
            onClick={() => setQuickFilter(quickFilter === value ? 'all' : value)}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto gap-1.5"
          onClick={saveCurrentView}
        >
          <Bookmark className="h-4 w-4" />
          {saved ? 'Vista guardada' : 'Guardar vista actual'}
        </Button>
      </div>
      <div className="bg-card flex flex-wrap gap-2 rounded-xl border p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar expediente…"
            className="pl-9"
          />
        </div>
        <ControlSelect
          value={assignee}
          onChange={setAssignee}
          options={[
            ['all', 'Todos los responsables'],
            ...miembros.map((item) => [item.id, item.nombre]),
          ]}
        />
        <ControlSelect
          value={status}
          onChange={setStatus}
          options={[['all', 'Cualquier estado'], ...statusOptions.map((item) => [item, item])]}
        />
        <ControlSelect
          value={dependency}
          onChange={setDependency}
          options={[
            ['all', 'Cualquier dependencia'],
            ...dependencyOptions.map((item) => [item, item]),
          ]}
        />
        <Badge variant="secondary" className="h-9 px-3">
          {filtered.length} {filtered.length === 1 ? 'expediente' : 'expedientes'}
        </Badge>
      </div>
      <p className="text-muted-foreground rounded-md border border-dashed px-4 py-3 text-xs leading-5">
        <strong className="text-foreground">Lectura:</strong> las bandas agrupan las megafases y
        cada subcolumna representa una fase operativa. Arrastra un expediente entre ellas para
        actualizar su recorrido.
      </p>
      <section aria-label="Kanban de control de expedientes" className="overflow-x-auto pb-2">
        <div className="grid min-w-[1360px] grid-cols-5 grid-rows-[auto_1fr] gap-x-4 gap-y-3">
          <header className="col-span-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/70 dark:bg-sky-950/30">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-600" />
              <h2 className="font-serif text-lg font-semibold">F3 · CASEWORK</h2>
              <Badge variant="secondary">
                {
                  filtered.filter(
                    (item) => caseMegaphase(caseControlColumn(item)) === 'F3 · CASEWORK',
                  ).length
                }
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Trabajo técnico, decisión, preparación y seguimiento activo.
            </p>
          </header>
          <header className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900/70 dark:bg-violet-950/30">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-600" />
              <h2 className="font-serif text-lg font-semibold">F4 · DELIVERY</h2>
              <Badge variant="secondary">
                {
                  filtered.filter(
                    (item) => caseMegaphase(caseControlColumn(item)) === 'F4 · DELIVERY',
                  ).length
                }
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Propuesta, entrega y formalización.
            </p>
          </header>
          {CASE_CONTROL_COLUMNS.map((column) => (
            <CaseColumn
              key={column.id}
              column={column.id}
              title={column.title}
              description={column.description}
              items={filtered.filter((item) => caseControlColumn(item) === column.id)}
              contactNames={contactNames}
              memberNames={memberNames}
              tasks={tareas}
              activities={actuaciones}
              now={now}
              moving={moving}
              onMove={moveToColumn}
              onDrop={dropInColumn}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

function CaseColumn({
  column,
  title,
  description,
  items,
  contactNames,
  memberNames,
  tasks,
  activities,
  now,
  moving,
  onMove,
  onDrop,
}: {
  column: CaseControlColumnId
  title: string
  description: string
  items: ExpedientePersistido[]
  contactNames: Map<string, string>
  memberNames: Map<string, string>
  tasks: TareaPersistida[]
  activities: ActuacionPersistida[]
  now: number
  moving: boolean
  onMove: (item: ExpedientePersistido, column: CaseControlColumnId) => Promise<void>
  onDrop: (event: DragEvent<HTMLElement>, column: CaseControlColumnId) => void
}) {
  return (
    <section
      className="bg-muted/45 h-full min-h-56 rounded-xl border p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDrop(event, column)}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-4">{description}</p>
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </header>
      <div className="space-y-3">
        {items.map((item) => (
          <CaseCard
            key={item.id}
            item={item}
            contactName={contactNames.get(item.contactoPrincipalId) ?? 'Contacto no disponible'}
            assigneeName={memberNames.get(item.asignadoId ?? '') ?? 'Sin responsable'}
            alerts={caseAlerts(item, tasks, activities, now)}
            lastMovement={caseLastMovement(item, activities)}
            moving={moving}
            onMove={onMove}
          />
        ))}
        {!items.length ? (
          <p className="text-muted-foreground bg-card/50 rounded-lg border border-dashed px-3 py-8 text-center text-sm">
            Sin expedientes en esta fase. Arrastra una tarjeta aquí.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function CaseCard({
  item,
  contactName,
  assigneeName,
  alerts,
  lastMovement,
  moving,
  onMove,
}: {
  item: ExpedientePersistido
  contactName: string
  assigneeName: string
  alerts: string[]
  lastMovement: string
  moving: boolean
  onMove: (item: ExpedientePersistido, column: CaseControlColumnId) => Promise<void>
}) {
  const currentColumn = caseControlColumn(item)
  return (
    <Card
      draggable={!moving}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
      className="bg-card hover:border-primary/40 cursor-grab shadow-sm transition active:cursor-grabbing"
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground flex items-center gap-1 text-xs font-semibold">
            <GripVertical className="h-3.5 w-3.5" />
            {item.referencia}
          </span>
          <Badge variant={item.prioridad === 'Alta' ? 'destructive' : 'secondary'}>
            {item.prioridad}
          </Badge>
        </div>
        <Link to="/expedientes/$id" params={{ id: item.id }} className="block">
          <h3 className="line-clamp-2 text-sm font-semibold hover:underline">{item.titulo}</h3>
          <p className="text-muted-foreground mt-1 truncate text-sm">{contactName}</p>
        </Link>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{caseMegaphase(currentColumn)}</Badge>
          <Badge variant="outline">{item.naturaleza}</Badge>
          <Badge variant="secondary">{casePhaseForColumn(currentColumn)}</Badge>
        </div>
        <div className="space-y-1 border-y py-2 text-xs leading-5">
          <p>
            <span className="text-muted-foreground">Responsable:</span> {assigneeName}
          </p>
          <p>
            <span className="text-muted-foreground">Depende de:</span>{' '}
            {caseDependency(item.estadoOperativo)}
          </p>
          <p>
            <span className="text-muted-foreground">Próxima:</span>{' '}
            {item.proximaAccion || 'Sin próxima acción definida'}
          </p>
          <p>
            <span className="text-muted-foreground">Último movimiento:</span>{' '}
            {relativeDays(lastMovement)}
          </p>
        </div>
        {alerts.length ? (
          <div className="space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {alerts.slice(0, 2).map((alert) => (
              <p key={alert} className="flex gap-1">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {alert}
              </p>
            ))}
            {alerts.length > 2 ? <p>+{alerts.length - 2} alertas</p> : null}
          </div>
        ) : null}
        <select
          aria-label={`Mover ${item.referencia} a otra fase`}
          value={currentColumn}
          disabled={moving}
          onChange={(event) => void onMove(item, event.target.value as CaseControlColumnId)}
          className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs"
        >
          {CASE_CONTROL_COLUMNS.map((column) => (
            <option key={column.id} value={column.id}>
              {column.megafase} · {column.title}
            </option>
          ))}
        </select>
      </CardContent>
    </Card>
  )
}

function ControlSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: string[][]
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  )
}
