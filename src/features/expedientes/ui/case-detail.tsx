import { Link } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckSquare2,
  FileText,
  History,
  Layers3,
  MessageSquareText,
  Pencil,
  ShieldAlert,
  UsersRound,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { MiembroDespacho } from '@/features/crm'
import {
  caseAlerts,
  caseDependency,
  caseLastMovement,
  relativeDays,
} from '@/features/expedientes/application/case-control'
import type {
  ActuacionPersistida,
  EventoExpediente,
  ExpedientePersistido,
  LineaPersistida,
  ParticipantePersistido,
} from '@/features/expedientes/application/case-types'
import type { NotaRemota } from '@/features/notas'
import type { CrearTareaInput, TareaPersistida } from '@/features/tareas'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

type CaseDetailTab =
  | 'summary'
  | 'workstreams'
  | 'participants'
  | 'activities'
  | 'documents'
  | 'communications'
  | 'tasks'
  | 'deadlines'
  | 'history'

const TABS: ReadonlyArray<{ id: CaseDetailTab; label: string; Icon: typeof Activity }> = [
  { id: 'summary', label: 'Resumen', Icon: Activity },
  { id: 'workstreams', label: 'Líneas de trabajo', Icon: Layers3 },
  { id: 'participants', label: 'Intervinientes', Icon: UsersRound },
  { id: 'activities', label: 'Actuaciones', Icon: Activity },
  { id: 'documents', label: 'Documentos', Icon: FileText },
  { id: 'communications', label: 'Comunicaciones', Icon: MessageSquareText },
  { id: 'tasks', label: 'Tareas', Icon: CheckSquare2 },
  { id: 'deadlines', label: 'Fechas y plazos', Icon: CalendarClock },
  { id: 'history', label: 'Histórico', Icon: History },
]

export function CaseDetail({
  expediente: item,
  lineas,
  actuaciones,
  participantes,
  eventos,
  documentos,
  tareas,
  miembros,
  clienteNombre,
  taskPending,
  onCreateTask,
  editor,
  relatedForms,
  notas = [],
  taskTitleTemplates = [],
}: {
  expediente: ExpedientePersistido
  lineas: LineaPersistida[]
  actuaciones: ActuacionPersistida[]
  participantes: ParticipantePersistido[]
  eventos: EventoExpediente[]
  documentos: CaseDocumentRow[]
  tareas: TareaPersistida[]
  miembros: MiembroDespacho[]
  clienteNombre: string
  taskPending: boolean
  onCreateTask: (input: CrearTareaInput) => Promise<unknown>
  editor: ReactNode
  relatedForms: { participant: ReactNode; workstream: ReactNode; activity: ReactNode }
  notas?: NotaRemota[]
  taskTitleTemplates?: string[]
}) {
  const [activeTab, setActiveTab] = useState<CaseDetailTab>('summary')
  const memberNames = new Map(miembros.map((member) => [member.id, member.nombre]))
  const caseTasks = tareas.filter((task) => task.expedienteId === item.id)
  const openTasks = caseTasks.filter((task) => !['Completada', 'Cancelada'].includes(task.estado))
  const deadlines = caseTasks.filter((task) => task.tipo === 'Plazo' || task.venceEn)
  const alerts = caseAlerts(item, tareas, actuaciones)
  const lastMovement = caseLastMovement(item, actuaciones)
  const countForTab: Partial<Record<CaseDetailTab, number>> = {
    workstreams: lineas.length,
    participants: participantes.length,
    activities: actuaciones.length,
    documents: documentos.length,
    communications: notas.filter((note) => note.scope === 'case' && note.case_id === item.id)
      .length,
    tasks: openTasks.length,
    deadlines: deadlines.length,
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-6">
      <Link to="/expedientes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <CaseHeader
        expediente={item}
        memberName={memberNames.get(item.asignadoId ?? '')}
        lastMovement={lastMovement}
        openTaskCount={openTasks.length}
        alerts={alerts}
        editor={editor}
        activityForm={relatedForms.activity}
        notas={notas}
      />

      <div
        className="border-border/80 flex max-w-full gap-1 overflow-x-auto border-b px-2"
        role="tablist"
      >
        {TABS.map(({ id, label, Icon }) => {
          const count = countForTab[id]
          const selected = activeTab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`case-detail-tab-${id}`}
              aria-controls={`case-detail-panel-${id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${selected ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {count !== undefined ? <span className="text-xs tabular-nums">{count}</span> : null}
            </button>
          )
        })}
      </div>

      <section
        id={`case-detail-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`case-detail-tab-${activeTab}`}
      >
        {activeTab === 'summary' ? (
          <CaseSummary
            expediente={item}
            lastMovement={lastMovement}
            memberName={memberNames.get(item.asignadoId ?? '')}
            clienteNombre={clienteNombre}
            tareas={openTasks}
            actuaciones={actuaciones}
            documentos={documentos}
          />
        ) : null}
        {activeTab === 'workstreams' ? (
          <WorkstreamsSection
            lineas={lineas}
            miembros={miembros}
            expedienteReferencia={item.referencia}
            createForm={relatedForms.workstream}
          />
        ) : null}
        {activeTab === 'participants' ? (
          <DetailSection
            title="Intervinientes"
            subtitle="Personas y entidades vinculadas a este expediente."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {participantes.map((participant) => (
                <ParticipantCard key={participant.id} participant={participant} />
              ))}
            </div>
            {!participantes.length ? (
              <EmptyState message="No hay intervinientes registrados." />
            ) : null}
            {relatedForms.participant}
          </DetailSection>
        ) : null}
        {activeTab === 'activities' ? (
          <DetailSection
            title="Actuaciones"
            subtitle="Registro cronológico de la actividad profesional realizada."
          >
            <div className="space-y-3">
              {actuaciones.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  memberName={memberNames.get(activity.asignadoId ?? '')}
                />
              ))}
            </div>
            {!actuaciones.length ? <EmptyState message="No hay actuaciones registradas." /> : null}
          </DetailSection>
        ) : null}
        {activeTab === 'documents' ? (
          <DocumentsSection documents={documentos} expedienteId={item.id} />
        ) : null}
        {activeTab === 'communications' ? (
          <CaseCommunications
            notes={notas.filter((note) => note.scope === 'case' && note.case_id === item.id)}
          />
        ) : null}
        {activeTab === 'tasks' ? (
          <TasksSection
            tasks={caseTasks}
            expediente={item}
            pending={taskPending}
            onCreate={onCreateTask}
            titleTemplates={taskTitleTemplates}
          />
        ) : null}
        {activeTab === 'deadlines' ? <DeadlinesSection tasks={deadlines} /> : null}
        {activeTab === 'history' ? (
          <HistorySection events={eventos} memberNames={memberNames} />
        ) : null}
      </section>
    </main>
  )
}

function CaseHeader({
  expediente,
  memberName,
  lastMovement,
  openTaskCount,
  alerts,
  editor,
  activityForm,
  notas,
}: {
  expediente: ExpedientePersistido
  memberName: string | undefined
  lastMovement: string
  openTaskCount: number
  alerts: string[]
  editor: ReactNode
  activityForm: ReactNode
  notas: NotaRemota[]
}) {
  const caseNotes = notas.filter(
    (note) => note.scope === 'case' && note.case_id === expediente.id && note.status === 'active',
  )
  return (
    <>
      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h1 className="text-lg font-bold tracking-tight text-balance sm:text-xl">
                {expediente.referencia} · {expediente.titulo}
              </h1>
              <p className="text-muted-foreground text-sm">
                {expediente.naturaleza} · {expediente.area || 'Sin área'} ·{' '}
                {expediente.tipoAsunto || 'Sin tipo de asunto'}
              </p>
              <p className="text-muted-foreground text-xs">
                {alerts.some((alert) => alert.startsWith('Sin actuaciones'))
                  ? 'Situación: no consta ninguna actuación registrada'
                  : `Situación: última actuación ${relativeDays(lastMovement)}`}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="secondary">CASEWORK</Badge>
                <Badge variant="outline">{expediente.naturaleza}</Badge>
                <Badge variant={expediente.prioridad === 'Alta' ? 'destructive' : 'outline'}>
                  {expediente.prioridad}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="outline" className="h-9 max-w-56 truncate px-3 font-normal">
                {expediente.fase}
              </Badge>
              <Badge variant="outline" className="h-9 px-3 font-normal">
                {caseDependency(expediente.estadoOperativo)}
              </Badge>
              <CaseEditDialog editor={editor} />
              {activityForm}
            </div>
          </div>
          <div className="bg-muted/35 space-y-2 rounded-md border p-3 text-xs sm:p-4">
            <p className="text-foreground">
              Fase operativa: <strong>{expediente.fase}</strong> · Estado:{' '}
              <strong>{expediente.estadoGeneral}</strong> · Depende de:{' '}
              <strong>{caseDependency(expediente.estadoOperativo)}</strong>
            </p>
            <p className="text-muted-foreground">
              Responsable:{' '}
              <strong className="text-foreground">{memberName ?? 'Sin asignar'}</strong> · Último
              movimiento: <strong className="text-foreground">{relativeDays(lastMovement)}</strong>
            </p>
            <p className="text-muted-foreground">
              Próxima acción:{' '}
              <strong className="text-foreground">
                {expediente.proximaAccion || 'Sin siguiente acción definida'}
              </strong>
            </p>
            <div className="border-destructive/35 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="text-destructive mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <strong className="text-destructive block text-[11px] uppercase">
                    {expediente.proximaAccion ? 'Siguiente acción' : 'Sin siguiente acción'}
                  </strong>
                  <span className="text-muted-foreground">
                    {openTaskCount
                      ? `${openTaskCount} tarea${openTaskCount === 1 ? '' : 's'} abierta${openTaskCount === 1 ? '' : 's'} vinculada${openTaskCount === 1 ? '' : 's'}.`
                      : '¿Qué hay que hacer ahora para que este asunto avance?'}
                  </span>
                </span>
              </div>
              <CaseEditDialog editor={editor} compact />
            </div>
          </div>
          {alerts.length ? (
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs">
              {alerts.map((alert) => (
                <span key={alert} className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {alert}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <CaseNotes notes={caseNotes} />
    </>
  )
}

function CaseNotes({ notes }: { notes: NotaRemota[] }) {
  if (!notes.length) return null
  return (
    <section
      aria-label="Notas internas del expediente"
      className="border-destructive/35 rounded-lg border p-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="text-destructive h-4 w-4" aria-hidden="true" />
          Notas internas del expediente a tener en cuenta ({notes.length})
        </h2>
        <Link to="/notas" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Abrir notas
        </Link>
      </header>
      <div className="mt-3 space-y-2">
        {notes.map((note) => (
          <article
            key={note.id}
            className="border-primary/30 bg-primary/5 rounded-md border px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-primary text-[11px] font-semibold tracking-wide uppercase">
                  {note.critical
                    ? 'Nota del expediente · advertencia crítica'
                    : 'Nota del expediente'}
                </p>
                <p className="mt-1 text-sm font-semibold">{note.title || 'Nota interna'}</p>
              </div>
              <div className="flex gap-1.5">
                {note.requires_acknowledgement ? (
                  <Badge variant="outline">Requiere confirmación</Badge>
                ) : null}
                {note.critical ? <Badge variant="destructive">Crítica</Badge> : null}
              </div>
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-wrap">{note.content}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              {note.actorNames[note.created_by ?? ''] ?? 'Sistema'} ·{' '}
              {formatDate(note.created_at, true)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function CaseCommunications({ notes }: { notes: NotaRemota[] }) {
  return (
    <DetailSection
      title="Comunicaciones"
      subtitle="Conversaciones y notas internas vinculadas a este expediente."
    >
      <div className="flex justify-end">
        <Link to="/comunicaciones" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Abrir bandeja de conversaciones
        </Link>
      </div>
      <Card>
        <CardContent className="space-y-3 pt-5">
          {notes.map((note) => (
            <article key={note.id} className="bg-muted/30 rounded-xl border p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-sm font-semibold">
                  {note.actorNames[note.created_by ?? ''] ?? 'Miembro del despacho'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(note.created_at, true)}
                </span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{note.content}</p>
              {note.requires_acknowledgement ? (
                <Badge className="mt-2" variant="outline">
                  Requiere confirmación de lectura
                </Badge>
              ) : null}
            </article>
          ))}
          {!notes.length ? (
            <EmptyState message="Este expediente todavía no tiene comunicaciones internas." />
          ) : null}
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function CaseEditDialog({ editor, compact = false }: { editor: ReactNode; compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={compact ? 'default' : 'outline'}
          size={compact ? 'sm' : 'default'}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {compact ? 'Definir siguiente acción' : 'Editar expediente'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-4xl overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)]">
        <DialogHeader>
          <div className="bg-muted/45 border-b px-6 py-5">
            <DialogTitle>Editar expediente</DialogTitle>
            <DialogDescription className="mt-1.5 max-w-2xl">
              Actualiza la clasificación, el punto de trabajo y el responsable sin perder el
              contexto operativo del asunto.
            </DialogDescription>
          </div>
        </DialogHeader>
        {editor}
      </DialogContent>
    </Dialog>
  )
}

function CaseSummary({
  expediente,
  lastMovement,
  memberName,
  clienteNombre,
  tareas,
  actuaciones,
  documentos,
}: {
  expediente: ExpedientePersistido
  lastMovement: string
  memberName: string | undefined
  clienteNombre: string
  tareas: TareaPersistida[]
  actuaciones: ActuacionPersistida[]
  documentos: CaseDocumentRow[]
}) {
  const commercialIntake = asRecord(asRecord(expediente.detalles)['commercialIntake'])
  const initialDocuments = Array.isArray(commercialIntake['documentosIniciales'])
    ? commercialIntake['documentosIniciales']
      .map((item) => (item && typeof item === 'object' && 'nombre' in item ? item.nombre : null))
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Dónde estamos</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-6">
            {expediente.dondeEstamos ||
              'Actualiza la situación y el siguiente paso para orientar al equipo.'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próxima acción</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {expediente.proximaAccion || 'Sin acción principal'}
          </CardContent>
        </Card>
        {initialDocuments.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentación declarada en el Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                {initialDocuments.map((document) => (
                  <li key={document}>{document}</li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-xs">
                Estos elementos son una declaración inicial; los archivos se incorporan desde el
                gestor documental para mantener control de versiones y permisos.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del expediente</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Summary label="Cliente" value={clienteNombre} />
              <Summary label="Área" value={expediente.area || 'Sin área'} />
              <Summary label="Tipo de asunto" value={expediente.tipoAsunto || 'Sin definir'} />
              <Summary label="Naturaleza" value={expediente.naturaleza} />
              <Summary label="Apertura" value={formatDate(expediente.fechaApertura)} />
              <Summary label="Último movimiento" value={formatDate(lastMovement)} />
              <Summary label="Responsable" value={memberName ?? 'Sin asignar'} />
              <Summary label="Estado" value={expediente.estadoGeneral} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visión rápida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <QuickRow label="Tareas abiertas" value={tareas.length} />
            <QuickRow label="Últimas actuaciones" value={actuaciones.length} />
            <QuickRow label="Documentos vigentes" value={documentos.length} />
            <QuickRow label="Próximo vencimiento" value={nextDueLabel(tareas)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function DetailSection({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}

type WorkstreamSituation = 'all' | 'with-target' | 'without-target'
type WorkstreamOrder = 'manual' | 'title' | 'target'
type WorkstreamAdditionalFilter = 'all' | 'root' | 'nested'

function WorkstreamsSection({
  lineas,
  miembros,
  expedienteReferencia,
  createForm,
}: {
  lineas: LineaPersistida[]
  miembros: MiembroDespacho[]
  expedienteReferencia: string
  createForm: ReactNode
}) {
  const [status, setStatus] = useState('all')
  const [situation, setSituation] = useState<WorkstreamSituation>('all')
  const [assignee, setAssignee] = useState('all')
  const [priority, setPriority] = useState('all')
  const [additionalFilter, setAdditionalFilter] = useState<WorkstreamAdditionalFilter>('all')
  const [order, setOrder] = useState<WorkstreamOrder>('manual')
  const statuses = [...new Set(lineas.map((line) => line.estado).filter(Boolean))]
  const visible = lineas
    .filter((line) => status === 'all' || line.estado === status)
    .filter(
      (line) =>
        situation === 'all' || (situation === 'with-target') === Boolean(line.fechaObjetivo),
    )
    .filter((line) => assignee === 'all' || line.asignadoId === assignee)
    .filter((line) => priority === 'all' || line.prioridad === priority)
    .filter(
      (line) =>
        additionalFilter === 'all' ||
        (additionalFilter === 'root' ? !line.parentId : Boolean(line.parentId)),
    )
    .sort((first, second) => {
      if (order === 'title') return first.titulo.localeCompare(second.titulo, 'es')
      if (order === 'target')
        return dateValue(first.fechaObjetivo) - dateValue(second.fechaObjetivo)
      return first.orden - second.orden
    })
  const memberNames = new Map(miembros.map((member) => [member.id, member.nombre]))
  const hasActiveFilters = [status, situation, assignee, priority, additionalFilter].some(
    (value) => value !== 'all',
  )
  const resetFilters = () => {
    setStatus('all')
    setSituation('all')
    setAssignee('all')
    setPriority('all')
    setAdditionalFilter('all')
  }

  return (
    <DetailSection
      title={`Líneas de trabajo · ${lineas.length} en el expediente`}
      subtitle="Frentes autónomos del expediente: cada uno con objetivo propio, responsable, seguimiento y resultado verificable. Agrupan y relacionan el trabajo, sin sustituir a fases, actuaciones ni tareas."
      actions={<>{createForm}</>}
    >
      <div className="border-border/80 bg-muted/20 flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <span className="text-muted-foreground px-1 text-xs font-medium">Filtros</span>
        <WorkstreamSelect ariaLabel="Estado de línea" value={status} onChange={setStatus}>
          <option value="all">Todos los estados</option>
          {statuses.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </WorkstreamSelect>
        <WorkstreamSelect
          ariaLabel="Situación de línea"
          value={situation}
          onChange={(value) => setSituation(value as WorkstreamSituation)}
        >
          <option value="all">Toda situación</option>
          <option value="with-target">Con fecha objetivo</option>
          <option value="without-target">Sin fecha objetivo</option>
        </WorkstreamSelect>
        <WorkstreamSelect ariaLabel="Responsable de línea" value={assignee} onChange={setAssignee}>
          <option value="all">Todos los responsables</option>
          <option value="">Sin asignar</option>
          {miembros.map((member) => (
            <option key={member.id} value={member.id}>
              {member.nombre}
            </option>
          ))}
        </WorkstreamSelect>
        <WorkstreamSelect ariaLabel="Prioridad de línea" value={priority} onChange={setPriority}>
          <option value="all">Toda prioridad</option>
          <option>Alta</option>
          <option>Media</option>
          <option>Baja</option>
        </WorkstreamSelect>
        <WorkstreamSelect
          ariaLabel="Filtro adicional de línea"
          value={additionalFilter}
          onChange={(value) => setAdditionalFilter(value as WorkstreamAdditionalFilter)}
        >
          <option value="all">Sin filtro adicional</option>
          <option value="root">Líneas principales</option>
          <option value="nested">Sublíneas</option>
        </WorkstreamSelect>
        <WorkstreamSelect
          ariaLabel="Orden de líneas"
          value={order}
          onChange={(value) => setOrder(value as WorkstreamOrder)}
        >
          <option value="manual">Orden manual</option>
          <option value="title">Título</option>
          <option value="target">Fecha objetivo</option>
        </WorkstreamSelect>
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            Restablecer filtros
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((line) => (
          <WorkstreamCard
            key={line.id}
            line={line}
            memberName={memberNames.get(line.asignadoId ?? '')}
          />
        ))}
      </div>
      {!visible.length ? (
        <EmptyState message="Ninguna línea coincide con los filtros aplicados." />
      ) : null}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Documentos pendientes de asignación</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0 text-sm">
          <p className="text-muted-foreground">
            Puedes asignarlos a este expediente ({expedienteReferencia}) o a cualquier otro.
          </p>
          <Link to="/documentos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Gestionar documentos
          </Link>
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function WorkstreamSelect({
  ariaLabel,
  value,
  onChange,
  children,
}: {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="min-w-40 flex-1 sm:flex-none">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm sm:w-auto"
      >
        {children}
      </select>
    </label>
  )
}

function WorkstreamCard({
  line,
  memberName,
}: {
  line: LineaPersistida
  memberName: string | undefined
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{line.titulo}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {line.descripcion || line.tipo || 'Sin descripción'}
            </p>
          </div>
          <Badge variant="outline">{line.estado}</Badge>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>Responsable: {memberName ?? 'Sin asignar'}</span>
          <span>Objetivo: {formatDate(line.fechaObjetivo)}</span>
          <span>Prioridad: {line.prioridad}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ParticipantCard({ participant }: { participant: ParticipantePersistido }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div>
          <p className="font-medium">{participant.nombre}</p>
          <p className="text-muted-foreground mt-1 text-sm">{participant.rol}</p>
        </div>
        <Badge variant="outline">{participant.confidencialidad}</Badge>
      </CardContent>
    </Card>
  )
}

function ActivityCard({
  activity,
  memberName,
}: {
  activity: ActuacionPersistida
  memberName: string | undefined
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{activity.titulo}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {activity.descripcion || activity.tipo}
            </p>
          </div>
          <span className="text-muted-foreground text-xs">
            {formatDate(activity.ocurridaEn, true)}
          </span>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>{activity.tipo}</span>
          <span>Responsable: {memberName ?? 'Sin asignar'}</span>
          {activity.horas ? (
            <span>
              {activity.horas} h{activity.facturable ? ' facturables' : ''}
            </span>
          ) : null}
        </div>
        {activity.resultado ? (
          <p className="border-primary/15 bg-muted/30 rounded-md border px-3 py-2 text-sm">
            Resultado: {activity.resultado}
          </p>
        ) : null}
        {activity.proximaAccion ? (
          <p className="text-sm">
            Siguiente paso: <span className="font-medium">{activity.proximaAccion}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function DocumentsSection({
  documents,
  expedienteId,
}: {
  documents: CaseDocumentRow[]
  expedienteId: string
}) {
  return (
    <DetailSection title="Documentos" subtitle="Versiones vigentes incorporadas a este expediente.">
      <div className="flex justify-end">
        <Link
          to="/documentos"
          search={{ case: expedienteId }}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Abrir gestor documental
        </Link>
      </div>
      <Card>
        <CardContent className="divide-y pt-2">
          {documents.map((document) => (
            <div key={document.id} className="flex items-center gap-3 py-3">
              <FileText className="text-muted-foreground h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{document.original_name}</p>
                <p className="text-muted-foreground text-xs">
                  {document.category} · v{document.version} ·{' '}
                  {formatDate(document.updated_at, true)}
                </p>
              </div>
              <Badge variant="outline">{document.confidentiality}</Badge>
            </div>
          ))}
          {!documents.length ? <EmptyState message="No hay documentos incorporados." /> : null}
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function TasksSection({
  tasks,
  expediente,
  pending,
  onCreate,
  titleTemplates,
}: {
  tasks: TareaPersistida[]
  expediente: ExpedientePersistido
  pending: boolean
  onCreate: (input: CrearTareaInput) => Promise<unknown>
  titleTemplates: string[]
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await onCreate({
        expedienteId: expediente.id,
        oportunidadId: null,
        tipo: 'Tarea',
        titulo: text(data, 'title'),
        descripcion: '',
        prioridad: 'Media',
        venceEn: dateTime(text(data, 'due')),
        recordarEn: null,
        clasePlazo: null,
        critico: false,
        asignadoId: expediente.asignadoId,
      })
      form.reset()
      toast.success('Tarea vinculada al expediente.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la tarea.')
    }
  }
  return (
    <DetailSection
      title="Tareas"
      subtitle="Trabajo pendiente y completado vinculado a este expediente."
    >
      <Card>
        <CardContent className="divide-y pt-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {!tasks.length ? <EmptyState message="No hay tareas registradas." /> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Añadir tarea</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
            onSubmit={(event) => void submit(event)}
          >
            <Input
              name="title"
              aria-label="Título de tarea"
              placeholder="Qué hay que hacer"
              required
              maxLength={240}
              list="case-task-title-templates"
            />
            <datalist id="case-task-title-templates">
              {titleTemplates.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </datalist>
            <Input name="due" aria-label="Fecha prevista" type="date" />
            <Button type="submit" disabled={pending}>
              Añadir tarea
            </Button>
          </form>
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function DeadlinesSection({ tasks }: { tasks: TareaPersistida[] }) {
  const ordered = [...tasks].sort(
    (first, second) => dateValue(first.venceEn) - dateValue(second.venceEn),
  )
  return (
    <DetailSection
      title="Fechas y plazos"
      subtitle="Compromisos temporales y plazos profesionales del expediente."
    >
      <Card>
        <CardContent className="divide-y pt-2">
          {ordered.map((task) => (
            <TaskRow key={task.id} task={task} showValidation />
          ))}
          {!ordered.length ? <EmptyState message="No hay fechas ni plazos registrados." /> : null}
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function TaskRow({
  task,
  showValidation = false,
}: {
  task: TareaPersistida
  showValidation?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <CalendarClock className="text-muted-foreground h-4 w-4" />
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium">{task.titulo}</p>
        <p className="text-muted-foreground text-xs">
          {task.tipo} · {task.estado}
          {task.venceEn ? ` · ${formatDate(task.venceEn, true)}` : ''}
        </p>
      </div>
      <Badge variant="outline">{task.prioridad}</Badge>
      {showValidation && task.tipo === 'Plazo' ? (
        <Badge variant="secondary">{task.validacion}</Badge>
      ) : null}
    </div>
  )
}

function HistorySection({
  events,
  memberNames,
}: {
  events: EventoExpediente[]
  memberNames: Map<string, string>
}) {
  return (
    <DetailSection
      title="Histórico"
      subtitle="Trazabilidad de los cambios realizados en el expediente."
    >
      <Card>
        <CardContent className="space-y-3 pt-5">
          {events.map((event) => (
            <article key={event.id} className="border-l-primary/40 border-l-2 pl-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">
                  {event.entidad} · {event.accion}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(event.creadoEn, true)} · Por{' '}
                  {event.actorId
                    ? (memberNames.get(event.actorId) ?? 'Usuario del despacho')
                    : 'Sistema'}
                </span>
              </div>
              {event.campos.length ? (
                <p className="text-muted-foreground mt-1 text-xs">{event.campos.join(', ')}</p>
              ) : null}
            </article>
          ))}
          {!events.length ? <EmptyState message="No hay eventos registrados." /> : null}
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  )
}

function QuickRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-muted-foreground py-4 text-sm">{message}</p>
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(
      'es-ES',
      includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' },
    )
}
function dateValue(value: string | null) {
  const timestamp = value ? Date.parse(value) : Number.POSITIVE_INFINITY
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}
function nextDueLabel(tasks: TareaPersistida[]) {
  const task = [...tasks]
    .filter((item) => item.venceEn)
    .sort((first, second) => dateValue(first.venceEn) - dateValue(second.venceEn))[0]
  return task?.venceEn ? formatDate(task.venceEn, true) : 'Sin fecha'
}
function dateTime(value: string) {
  return value ? `${value}T09:00:00` : null
}
function text(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}
