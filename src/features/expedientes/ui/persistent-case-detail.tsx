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
  UsersRound,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

import { SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { MiembroDespacho } from '@/features/crm'
import { caseAlerts, caseDependency, caseLastMovement, relativeDays } from '@/features/expedientes'
import type {
  ActuacionPersistida,
  EventoExpediente,
  ExpedientePersistido,
  LineaPersistida,
  ParticipantePersistido,
} from '@/features/expedientes/application/case-types'
import type { CrearTareaInput, TareaPersistida } from '@/features/tareas'
import type { CaseDocumentRow } from '@/shared/infrastructure/supabase'

type CaseDetailTab =
  | 'summary'
  | 'workstreams'
  | 'participants'
  | 'activities'
  | 'documents'
  | 'tasks'
  | 'deadlines'
  | 'history'

const TABS: ReadonlyArray<{ id: CaseDetailTab; label: string; Icon: typeof Activity }> = [
  { id: 'summary', label: 'Resumen', Icon: Activity },
  { id: 'workstreams', label: 'Líneas de trabajo', Icon: Layers3 },
  { id: 'participants', label: 'Intervinientes', Icon: UsersRound },
  { id: 'activities', label: 'Actuaciones', Icon: Activity },
  { id: 'documents', label: 'Documentos', Icon: FileText },
  { id: 'tasks', label: 'Tareas', Icon: CheckSquare2 },
  { id: 'deadlines', label: 'Fechas y plazos', Icon: CalendarClock },
  { id: 'history', label: 'Histórico', Icon: History },
]

export function PersistentCaseDetail({
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
    tasks: openTasks.length,
    deadlines: deadlines.length,
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-6">
      <Link to="/expedientes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <SectionHeader
        title={`${item.referencia} · ${item.titulo}`}
        subtitle={`${item.naturaleza} · ${item.area || 'Sin área'}`}
        actions={
          <>
            <Link
              to="/contactos/$id"
              params={{ id: item.contactoPrincipalId }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Contacto principal
            </Link>
            {item.oportunidadId ? (
              <Link
                to="/oportunidades/$id"
                params={{ id: item.oportunidadId }}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Lead de origen
              </Link>
            ) : null}
            <Link
              to="/documentos"
              search={{ case: item.id }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Documentos
            </Link>
          </>
        }
      />
      <Card className="border-primary/15 bg-muted/20">
        <CardContent className="grid gap-5 pt-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{item.fase}</Badge>
              <Badge variant="outline">{item.estadoGeneral}</Badge>
              <Badge variant="outline">{item.prioridad}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Situación operativa
              </p>
              <p className="mt-1 text-lg font-semibold">{caseDependency(item.estadoOperativo)}</p>
            </div>
            <p className="text-muted-foreground text-sm">
              Responsable: {memberNames.get(item.asignadoId ?? '') ?? 'Sin asignar'} · Último
              movimiento: {relativeDays(lastMovement)}
            </p>
          </div>
          <div className="border-primary/20 bg-background rounded-lg border p-4">
            <p className="text-sm font-semibold">¿Qué hay que hacer ahora?</p>
            <p className="mt-1 text-sm">{item.proximaAccion || 'Definir siguiente acción'}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              {openTasks.length
                ? `${openTasks.length} tarea${openTasks.length === 1 ? '' : 's'} abierta${openTasks.length === 1 ? '' : 's'} vinculada${openTasks.length === 1 ? '' : 's'}.`
                : 'Sin tarea abierta vinculada.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {alerts.length ? (
        <section aria-label="Alertas del expediente" className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert}
              className="border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
              {alert}
            </div>
          ))}
        </section>
      ) : null}

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
            editor={editor}
          />
        ) : null}
        {activeTab === 'workstreams' ? (
          <DetailSection
            title="Líneas de trabajo"
            subtitle="Objetivos y trabajo técnico activo del expediente."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {lineas.map((line) => (
                <WorkstreamCard
                  key={line.id}
                  line={line}
                  memberName={memberNames.get(line.asignadoId ?? '')}
                />
              ))}
            </div>
            {!lineas.length ? <EmptyState message="No hay líneas de trabajo activas." /> : null}
            {relatedForms.workstream}
          </DetailSection>
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
            {relatedForms.activity}
          </DetailSection>
        ) : null}
        {activeTab === 'documents' ? (
          <DocumentsSection documents={documentos} expedienteId={item.id} />
        ) : null}
        {activeTab === 'tasks' ? (
          <TasksSection
            tasks={caseTasks}
            expediente={item}
            pending={taskPending}
            onCreate={onCreateTask}
          />
        ) : null}
        {activeTab === 'deadlines' ? <DeadlinesSection tasks={deadlines} /> : null}
        {activeTab === 'history' ? <HistorySection events={eventos} /> : null}
      </section>
    </main>
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
  editor,
}: {
  expediente: ExpedientePersistido
  lastMovement: string
  memberName: string | undefined
  clienteNombre: string
  tareas: TareaPersistida[]
  actuaciones: ActuacionPersistida[]
  documentos: CaseDocumentRow[]
  editor: ReactNode
}) {
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
      {editor}
    </div>
  )
}

function DetailSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
      </header>
      {children}
    </div>
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
}: {
  tasks: TareaPersistida[]
  expediente: ExpedientePersistido
  pending: boolean
  onCreate: (input: CrearTareaInput) => Promise<unknown>
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
            />
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

function HistorySection({ events }: { events: EventoExpediente[] }) {
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
                  {formatDate(event.creadoEn, true)}
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
