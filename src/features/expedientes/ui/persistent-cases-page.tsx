import { PopoverContent, PopoverTrigger } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, GripVertical, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState, type DragEvent, type ReactNode } from 'react'

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
type CaseNature = 'all' | 'Judicial' | 'Extrajudicial'
type ActiveFilter = { label: string; value: string; onRemove: () => void }

const QUICK_VIEWS: ReadonlyArray<[QuickFilter, string]> = [
  ['all', 'Todas las vistas'],
  ['mine', 'Mis expedientes'],
  ['waiting', 'En espera de tercero'],
  ['action', 'Debemos actuar nosotros'],
  ['execution', 'En ejecución'],
  ['alerts', 'Con alertas'],
]

const CASE_NATURE_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'Extrajudicial', label: 'Extrajudicial' },
  { value: 'Judicial', label: 'Judicial' },
] as const

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
  const [nature, setNature] = useState<CaseNature>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [assignee, setAssignee] = useState('all')
  const [status, setStatus] = useState('all')
  const [dependency, setDependency] = useState('all')
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
  const activeFilters = [
    quickFilter !== 'all' && {
      label: 'Vista',
      value: quickViewLabel(quickFilter),
      onRemove: () => setQuickFilter('all'),
    },
    assignee !== 'all' && {
      label: 'Responsable',
      value: memberNames.get(assignee) ?? 'Usuario no disponible',
      onRemove: () => setAssignee('all'),
    },
    status !== 'all' && {
      label: 'Estado',
      value: status,
      onRemove: () => setStatus('all'),
    },
    dependency !== 'all' && {
      label: 'Dependencia',
      value: dependency,
      onRemove: () => setDependency('all'),
    },
  ].filter((filter): filter is ActiveFilter => Boolean(filter))
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

  const clearFilters = () => {
    setQuery('')
    setQuickFilter('all')
    setAssignee('all')
    setStatus('all')
    setDependency('all')
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
      <div className="border-border/80 flex items-center gap-1 border-b px-3 pt-2.5" role="tablist">
        {CASE_NATURE_TABS.map(({ value, label }) => {
          const count =
            value === 'all'
              ? expedientes.length
              : expedientes.filter((item) => item.naturaleza === value).length
          return (
            <button
              key={value}
              type="button"
              role="tab"
              id={`case-nature-tab-${value.toLowerCase()}`}
              aria-controls="case-control-board"
              aria-selected={nature === value}
              tabIndex={nature === value ? 0 : -1}
              onClick={() => setNature(value)}
              className={caseNatureTabClass(nature === value)}
            >
              {label}
              <span
                aria-hidden="true"
                className="text-muted-foreground ml-1.5 text-xs tabular-nums"
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
      <div className="border-border/80 space-y-2 border-b pb-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:items-center">
          <label htmlFor="case-search" className="relative min-w-0">
            <span className="sr-only">Buscar expedientes</span>
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="case-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar expediente, referencia o cliente…"
              className="border-border/80 bg-muted/20 focus-visible:bg-background h-9 pl-11! shadow-none"
            />
          </label>
          <PopoverTrigger>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-border/80 bg-background hover:bg-muted/60 h-9 gap-1.5 px-3 font-normal shadow-none"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filtros
              {activeFilters.length ? (
                <span className="bg-primary text-primary-foreground flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                  {activeFilters.length}
                </span>
              ) : null}
            </Button>
            <PopoverContent
              placement="bottom end"
              className="border-border/80 w-[min(26rem,calc(100vw-2rem))] rounded-xl p-0 shadow-lg"
            >
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Filtros de expedientes</p>
                  <p className="text-muted-foreground text-xs">Acota el tablero por sus datos</p>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {activeFilters.length ? `${activeFilters.length} activos` : 'Sin filtros'}
                </span>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <FilterField label="Responsable">
                  <ControlSelect
                    ariaLabel="Filtrar por responsable"
                    value={assignee}
                    onChange={setAssignee}
                    options={[
                      ['all', 'Todos los responsables'],
                      ...miembros.map((item) => [item.id, item.nombre]),
                    ]}
                  />
                </FilterField>
                <FilterField label="Estado">
                  <ControlSelect
                    ariaLabel="Filtrar por estado"
                    value={status}
                    onChange={setStatus}
                    options={[
                      ['all', 'Cualquier estado'],
                      ...statusOptions.map((item) => [item, item]),
                    ]}
                  />
                </FilterField>
                <FilterField label="Dependencia">
                  <ControlSelect
                    ariaLabel="Filtrar por dependencia"
                    value={dependency}
                    onChange={setDependency}
                    options={[
                      ['all', 'Cualquier dependencia'],
                      ...dependencyOptions.map((item) => [item, item]),
                    ]}
                  />
                </FilterField>
              </div>
              {activeFilters.length ? (
                <div className="border-border border-t px-4 py-2.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground h-8 w-full"
                    onClick={clearFilters}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Restablecer filtros
                  </Button>
                </div>
              ) : null}
            </PopoverContent>
          </PopoverTrigger>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ControlSelect
            ariaLabel="Vista rápida"
            value={quickFilter}
            onChange={(value) => setQuickFilter(value as QuickFilter)}
            options={QUICK_VIEWS.map(([value, label]) => [value, `Vista: ${label}`])}
            className="border-border/80 bg-background hover:bg-muted/60 h-8 w-auto min-w-44 text-xs font-medium shadow-none"
          />
          <span className="bg-border h-3 w-px" aria-hidden="true" />
          <p className="text-muted-foreground text-xs">
            {filtered.length} {filtered.length === 1 ? 'expediente' : 'expedientes'} en la vista
            actual
          </p>
          {activeFilters.length ? (
            <>
              <span className="bg-border h-3 w-px" aria-hidden="true" />
              {activeFilters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  onClick={filter.onRemove}
                  className="border-border bg-muted/35 hover:bg-muted inline-flex h-6 max-w-full items-center gap-1 rounded-md border px-1.5 text-xs transition-colors"
                  aria-label={`Quitar filtro ${filter.label}: ${filter.value}`}
                >
                  <span className="text-muted-foreground">{filter.label}:</span>
                  <span className="max-w-32 truncate font-medium">{filter.value}</span>
                  <X className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground h-6 px-1 text-xs transition-colors"
              >
                Limpiar filtros
              </button>
            </>
          ) : null}
        </div>
      </div>
      <section
        id="case-control-board"
        role="tabpanel"
        aria-labelledby={`case-nature-tab-${nature.toLowerCase()}`}
        aria-label="Kanban de control de expedientes"
        className="overflow-x-auto pb-2"
      >
        <div className="grid min-w-340 grid-cols-5 grid-rows-[auto_1fr] gap-x-4 gap-y-3">
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
  ariaLabel,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: string[][]
  ariaLabel: string
  className?: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={
        className ?? 'border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
      }
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  )
}

function quickViewLabel(value: QuickFilter) {
  return QUICK_VIEWS.find(([filter]) => filter === value)?.[1] ?? 'Vista personalizada'
}

function caseNatureTabClass(active: boolean) {
  return `border-b-2 px-3 pb-2 text-sm font-medium transition-colors ${
    active
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`
}
