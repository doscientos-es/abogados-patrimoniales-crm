import {
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from '@doscientos/ui'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { PendingPanel, SectionHeader, ViewSwitch } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos, type ContactoPersistido } from '@/features/contactos'
import {
  ALL_LEAD_FILTER,
  EMPTY_LEAD_FILTER,
  filterLeads,
  nextOpportunityStage,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  UNASSIGNED_LEAD_FILTER,
  useMiembrosDespacho,
  useOportunidades,
  useTransicionarOportunidad,
  type LeadFilters,
  type MiembroDespacho,
  type OportunidadResumen,
} from '@/features/crm'
import { PipelineBoard } from '@/features/crm-presentation'
import type { OpportunityStage } from '@/shared/infrastructure/supabase'

export const Route = createFileRoute('/oportunidades/')({
  validateSearch: (search: Record<string, unknown>) => ({
    vista: typeof search['vista'] === 'string' ? (search['vista'] as string) : 'todas',
    abrir: typeof search['abrir'] === 'string' ? (search['abrir'] as string) : '',
  }),
  head: () => ({
    meta: [
      { title: 'Leads — LEX' },
      {
        name: 'description',
        content:
          'Kanban comercial de ocho fases con gates, subestados, próxima acción, tareas y actividades vinculadas.',
      },
      { property: 'og:title', content: 'Leads — LEX' },
      {
        property: 'og:description',
        content: 'Núcleo del CRM del despacho: del primer contacto a la apertura del expediente.',
      },
    ],
  }),
  component: LeadsPage,
})

/** El alta se realiza en su propia pantalla central: /oportunidades/nueva */
function NuevaOportunidadBoton() {
  return (
    <Link
      to="/oportunidades/nueva"
      search={{}}
      className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}
    >
      <Plus className="h-4 w-4" /> Nuevo Lead
    </Link>
  )
}

function LeadsPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const oportunidades = useOportunidades(membership.data?.firmId)
  const contactos = useContactos(membership.data?.firmId)
  const miembros = useMiembrosDespacho(membership.data?.firmId)

  if (session.status === 'loading') {
    return <PendingPanel title="Cargando Leads" description="Consultando el despacho activo…" />
  }
  if (session.status !== 'signed-in') {
    return (
      <PendingPanel
        title="Leads no disponibles"
        description="Necesitas una sesión y una membresía activa en un despacho. No se cargarán datos demo."
      />
    )
  }
  if (membership.isPending) {
    return <PendingPanel title="Cargando Leads" description="Consultando el despacho activo…" />
  }
  if (!membership.data) {
    return (
      <PendingPanel
        title="Leads no disponibles"
        description="Tu usuario no tiene una membresía activa en un despacho."
      />
    )
  }
  return (
    <LeadsPersistidos
      firmId={membership.data.firmId}
      oportunidades={oportunidades.data ?? []}
      contactos={contactos.data ?? []}
      miembros={miembros.data ?? []}
      cargando={oportunidades.isLoading || contactos.isLoading || miembros.isLoading}
      error={oportunidades.isError || contactos.isError || miembros.isError}
    />
  )
}

const NOMBRES_FASE: Record<string, string> = {
  entry: 'Entrada',
  qualification: 'Cualificación',
  first_meeting: 'Primera cita',
  quote: 'Solicitud de presupuesto',
  validation: 'Validación',
  engagement: 'Enviado al cliente',
  won: 'Aceptado',
  lost: 'Cerrado / Perdido',
}

const INITIAL_FILTERS: LeadFilters = {
  query: '',
  responsableId: ALL_LEAD_FILTER,
  fase: ALL_LEAD_FILTER,
  estadoOperativo: ALL_LEAD_FILTER,
  origen: ALL_LEAD_FILTER,
  prioridad: ALL_LEAD_FILTER,
}

type ActiveFilter = { label: string; value: string; onRemove: () => void }

function LeadsPersistidos({
  firmId,
  oportunidades,
  contactos,
  miembros,
  cargando,
  error,
}: {
  firmId: string
  oportunidades: OportunidadResumen[]
  contactos: ContactoPersistido[]
  miembros: MiembroDespacho[]
  cargando: boolean
  error: boolean
}) {
  const [modo, setModo] = useState('kanban')
  const [filters, setFilters] = useState<LeadFilters>(INITIAL_FILTERS)
  const transition = useTransicionarOportunidad(firmId)
  const contactosPorId = useMemo(
    () =>
      new Map(
        contactos.map((contacto) => [
          contacto.id,
          contacto.razonSocial || `${contacto.nombre} ${contacto.apellidos ?? ''}`.trim(),
        ]),
      ),
    [contactos],
  )
  const miembrosPorId = useMemo(
    () => new Map(miembros.map((miembro) => [miembro.id, miembro.nombre])),
    [miembros],
  )
  const estadosOperativos = useMemo(
    () => uniqueNonEmptyValues(oportunidades.map((oportunidad) => oportunidad.estadoOperativo)),
    [oportunidades],
  )
  const origenes = useMemo(
    () => uniqueNonEmptyValues(oportunidades.map((oportunidad) => oportunidad.origen)),
    [oportunidades],
  )
  const filtradas = filterLeads(oportunidades, contactosPorId, filters)
  const setFilter = <Key extends keyof LeadFilters>(key: Key, value: LeadFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }
  const clearFilters = () => setFilters(INITIAL_FILTERS)
  const activeFilters = [
    filters.responsableId !== ALL_LEAD_FILTER && {
      label: 'Responsable',
      value:
        filters.responsableId === UNASSIGNED_LEAD_FILTER
          ? 'Sin asignar'
          : (miembrosPorId.get(filters.responsableId) ?? 'Usuario no disponible'),
      onRemove: () => setFilter('responsableId', ALL_LEAD_FILTER),
    },
    filters.fase !== ALL_LEAD_FILTER && {
      label: 'Fase',
      value: NOMBRES_FASE[filters.fase] ?? filters.fase,
      onRemove: () => setFilter('fase', ALL_LEAD_FILTER),
    },
    filters.estadoOperativo !== ALL_LEAD_FILTER && {
      label: 'Estado',
      value: filters.estadoOperativo === EMPTY_LEAD_FILTER ? 'Sin estado' : filters.estadoOperativo,
      onRemove: () => setFilter('estadoOperativo', ALL_LEAD_FILTER),
    },
    filters.origen !== ALL_LEAD_FILTER && {
      label: 'Origen',
      value: filters.origen === EMPTY_LEAD_FILTER ? 'Sin origen' : filters.origen,
      onRemove: () => setFilter('origen', ALL_LEAD_FILTER),
    },
    filters.prioridad !== ALL_LEAD_FILTER && {
      label: 'Prioridad',
      value: filters.prioridad,
      onRemove: () => setFilter('prioridad', ALL_LEAD_FILTER),
    },
  ].filter((filter): filter is ActiveFilter => Boolean(filter))
  const advance = async (oportunidad: OportunidadResumen, target: OpportunityStage) => {
    try {
      await transition.mutateAsync({
        id: oportunidad.id,
        fase: target,
        subestado: 'Sin revisar',
      })
      toast.success(`${oportunidad.referencia} → ${OPPORTUNITY_STAGE_LABELS[target]}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo avanzar el Lead.')
    }
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Leads"
        subtitle="Registros persistentes del despacho con búsqueda y flujo de fases compartido."
        actions={
          <>
            <ViewSwitch
              value={modo}
              onChange={setModo}
              options={[
                { id: 'kanban', label: 'Kanban' },
                { id: 'lista', label: 'Lista' },
              ]}
            />
            <NuevaOportunidadBoton />
          </>
        }
      />
      <div className="border-border/80 mb-5 space-y-2 border-b pb-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:items-center">
          <label htmlFor="lead-search" className="relative min-w-0">
            <span className="sr-only">Buscar Leads</span>
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              id="lead-search"
              value={filters.query}
              onChange={(event) => setFilter('query', event.target.value)}
              placeholder="Buscar código, contacto o asunto…"
              className="border-border/80 bg-card focus-visible:bg-background h-9 !pl-10 shadow-none"
            />
          </label>
          <PopoverTrigger>
            <Button
              className="border-border/80 bg-background hover:bg-muted/60 h-9 gap-1.5 px-3 font-normal shadow-none"
              size="sm"
              variant="outline"
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
              className="border-border/80 w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-lg"
            >
              <div className="border-border flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Filtros de Leads</p>
                  <p className="text-muted-foreground text-xs">Acota el tablero comercial</p>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {activeFilters.length ? `${activeFilters.length} activos` : 'Sin filtros'}
                </span>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <FilterField label="Responsable">
                  <LeadFilter
                    label="Filtrar por responsable"
                    value={filters.responsableId}
                    onValueChange={(value) => setFilter('responsableId', value)}
                  >
                    <SelectItem id={ALL_LEAD_FILTER}>Todos los responsables</SelectItem>
                    <SelectItem id={UNASSIGNED_LEAD_FILTER}>Sin asignar</SelectItem>
                    {miembros.map((miembro) => (
                      <SelectItem key={miembro.id} id={miembro.id}>
                        {miembro.nombre}
                      </SelectItem>
                    ))}
                  </LeadFilter>
                </FilterField>
                <FilterField label="Fase">
                  <LeadFilter
                    label="Filtrar por fase"
                    value={filters.fase}
                    onValueChange={(value) => setFilter('fase', value)}
                  >
                    <SelectItem id={ALL_LEAD_FILTER}>Todas las fases</SelectItem>
                    {OPPORTUNITY_STAGES.map((fase) => (
                      <SelectItem key={fase} id={fase}>
                        {OPPORTUNITY_STAGE_LABELS[fase]}
                      </SelectItem>
                    ))}
                  </LeadFilter>
                </FilterField>
                <FilterField label="Estado operativo">
                  <LeadFilter
                    label="Filtrar por estado operativo"
                    value={filters.estadoOperativo}
                    onValueChange={(value) => setFilter('estadoOperativo', value)}
                  >
                    <SelectItem id={ALL_LEAD_FILTER}>Todos los estados operativos</SelectItem>
                    <SelectItem id={EMPTY_LEAD_FILTER}>Sin estado operativo</SelectItem>
                    {estadosOperativos.map((estado) => (
                      <SelectItem key={estado} id={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </LeadFilter>
                </FilterField>
                <FilterField label="Origen">
                  <LeadFilter
                    label="Filtrar por origen"
                    value={filters.origen}
                    onValueChange={(value) => setFilter('origen', value)}
                  >
                    <SelectItem id={ALL_LEAD_FILTER}>Todos los orígenes</SelectItem>
                    <SelectItem id={EMPTY_LEAD_FILTER}>Sin origen</SelectItem>
                    {origenes.map((origen) => (
                      <SelectItem key={origen} id={origen}>
                        {origen}
                      </SelectItem>
                    ))}
                  </LeadFilter>
                </FilterField>
                <FilterField label="Prioridad">
                  <LeadFilter
                    label="Filtrar por prioridad"
                    value={filters.prioridad}
                    onValueChange={(value) => setFilter('prioridad', value)}
                  >
                    <SelectItem id={ALL_LEAD_FILTER}>Todas las prioridades</SelectItem>
                    <SelectItem id="Alta">Alta</SelectItem>
                    <SelectItem id="Media">Media</SelectItem>
                    <SelectItem id="Baja">Baja</SelectItem>
                  </LeadFilter>
                </FilterField>
              </div>
              {activeFilters.length ? (
                <div className="border-border border-t px-4 py-2.5">
                  <Button
                    className="text-muted-foreground hover:text-foreground h-8 w-full"
                    size="sm"
                    variant="ghost"
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
          <p className="text-muted-foreground text-xs">
            {filtradas.length} {filtradas.length === 1 ? 'Lead' : 'Leads'}
            {modo === 'kanban'
              ? ' · Arrastra las tarjetas para cambiar de fase'
              : ' en la vista actual'}
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
                Limpiar todo
              </button>
            </>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="text-destructive mb-4 text-sm">No se han podido cargar los Leads.</p>
      ) : null}
      {modo === 'kanban' ? (
        <PipelineBoard
          oportunidades={filtradas}
          contactosPorId={contactosPorId}
          isPending={transition.isPending}
          onAdvance={advance}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Subestado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="w-44 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargando ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      Cargando Leads…
                    </TableCell>
                  </TableRow>
                ) : null}
                {filtradas.map((oportunidad) => (
                  <TableRow key={oportunidad.id}>
                    <TableCell className="font-medium">{oportunidad.referencia}</TableCell>
                    <TableCell>
                      {contactosPorId.get(oportunidad.contactoId) ?? 'Contacto eliminado'}
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate">
                      <Link
                        to="/oportunidades/$id"
                        params={{ id: oportunidad.id }}
                        className="hover:underline"
                      >
                        {oportunidad.titulo}
                      </Link>
                    </TableCell>
                    <TableCell>{NOMBRES_FASE[oportunidad.fase] ?? oportunidad.fase}</TableCell>
                    <TableCell>{oportunidad.subestado}</TableCell>
                    <TableCell>{oportunidad.origen || '—'}</TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat('es-ES').format(new Date(oportunidad.actualizada))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Link
                          to="/oportunidades/$id"
                          params={{ id: oportunidad.id }}
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'h-7 px-2 text-xs',
                          })}
                        >
                          Abrir
                        </Link>
                        {nextOpportunityStage(oportunidad.fase) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={transition.isPending}
                            onClick={() =>
                              void advance(
                                oportunidad,
                                nextOpportunityStage(oportunidad.fase) as OpportunityStage,
                              )
                            }
                          >
                            Avanzar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {!cargando && !filtradas.length ? (
        <p className="border-border text-muted-foreground mt-4 rounded-lg border border-dashed p-10 text-center text-sm">
          No hay Leads que cumplan estos criterios. Crea el primero para empezar el pipeline.
        </p>
      ) : null}
    </div>
  )
}

function LeadFilter({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(selected) => {
        if (typeof selected === 'string') onValueChange(selected)
      }}
    >
      <SelectTrigger
        aria-label={label}
        className="border-border/80 bg-muted/20 h-9 w-full shadow-none"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectList>{children}</SelectList>
      </SelectContent>
    </Select>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide">{label}</p>
      {children}
    </div>
  )
}

function uniqueNonEmptyValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((first, second) =>
    first.localeCompare(second, 'es'),
  )
}
