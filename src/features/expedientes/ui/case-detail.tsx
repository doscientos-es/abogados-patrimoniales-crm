import { Link } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckSquare2,
  ChevronDown,
  ChevronUp,
  FileText,
  Flag,
  History,
  ListChecks,
  Layers3,
  MessageSquareText,
  MoreHorizontal,
  Receipt,
  Pencil,
  Plus,
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
import { Textarea } from '@/components/ui/textarea'
import { TaskCreateDialog, type TaskLabelOption } from '@/components/tareas/task-create-dialog'
import type { MiembroDespacho } from '@/features/crm'
import {
  caseAlerts,
  caseDependency,
  caseLastMovement,
  casePhaseLabel,
  relativeDays,
} from '@/features/expedientes/application/case-control'
import type {
  ActuacionPersistida,
  EventoExpediente,
  ActualizarLineaInput,
  ExpedientePersistido,
  LineaPersistida,
  ParticipantePersistido,
  ActualizarVisibilidadActuacionInput,
} from '@/features/expedientes/application/case-types'
import type {
  RegistrarComunicacionExpedienteInput,
  RegistrarReporteClienteInput,
} from '@/features/expedientes/infrastructure/supabase-expedientes'
import type { FacturaPersistida } from '@/features/facturacion/application/factura-types'
import type { NotaRemota } from '@/features/notas'
import type { CrearTareaInput, TareaPersistida } from '@/features/tareas'
import type { CaseCommunicationRow, CaseDocumentRow, Json } from '@/shared/infrastructure/supabase'

import { WorkstreamDetailDialog, workstreamStatusLabel } from './workstream-detail-dialog'

export type CaseDetailTab =
  | 'summary'
  | 'workstreams'
  | 'participants'
  | 'activities'
  | 'documents'
  | 'economic'
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
  { id: 'economic', label: 'Económico', Icon: Receipt },
  { id: 'communications', label: 'Comunicaciones', Icon: MessageSquareText },
  { id: 'tasks', label: 'Tareas', Icon: CheckSquare2 },
  { id: 'deadlines', label: 'Fechas y plazos', Icon: CalendarClock },
  { id: 'history', label: 'Histórico', Icon: History },
]

export function CaseDetail({
  activeTab: activeTabProp,
  onSelectTab,
  expediente: item,
  lineas,
  actuaciones,
  participantes,
  eventos,
  comunicaciones,
  documentos,
  facturas = [],
  tareas,
  miembros,
  clienteNombre,
  taskPending,
  onCreateTask,
  onSetNextAction,
  onUpdateWorkstream,
  canManageNextAction,
  nextActionPending,
  communicationPending = false,
  onCreateCommunication = async () => undefined,
  activityVisibilityPending = false,
  onUpdateActivityVisibility = async () => undefined,
  reportPending = false,
  onRegisterClientReport = async () => undefined,
  workstreamPending = false,
  onReorderWorkstreams = async () => undefined,
  reorderPending = false,
  editor,
  relatedForms,
  notas = [],
  taskTitleTemplates = [],
  firmId,
  taskLabels = [],
  tasksPanel,
  onOpenTask,
  currentUserId,
  onAcknowledgeNote,
}: {
  currentUserId?: string | undefined
  onAcknowledgeNote?: ((noteId: string) => Promise<unknown>) | undefined
  onOpenTask?: ((taskId: string) => void) | undefined
  firmId?: string | undefined
  taskLabels?: TaskLabelOption[]
  tasksPanel?: ReactNode
  expediente: ExpedientePersistido
  activeTab?: CaseDetailTab
  onSelectTab?: (tab: CaseDetailTab) => void
  lineas: LineaPersistida[]
  actuaciones: ActuacionPersistida[]
  participantes: ParticipantePersistido[]
  eventos: EventoExpediente[]
  comunicaciones?: CaseCommunicationRow[]
  documentos: CaseDocumentRow[]
  facturas?: FacturaPersistida[]
  tareas: TareaPersistida[]
  miembros: MiembroDespacho[]
  clienteNombre: string
  taskPending: boolean
  onCreateTask: (input: CrearTareaInput) => Promise<unknown>
  onSetNextAction: (task: TareaPersistida, enabled: boolean) => Promise<unknown>
  onUpdateWorkstream: (input: ActualizarLineaInput) => Promise<unknown>
  workstreamPending?: boolean
  onReorderWorkstreams?: (ids: string[]) => Promise<unknown>
  reorderPending?: boolean
  canManageNextAction: (task: TareaPersistida) => boolean
  nextActionPending: boolean
  communicationPending?: boolean
  onCreateCommunication?: (input: RegistrarComunicacionExpedienteInput) => Promise<unknown>
  activityVisibilityPending?: boolean
  onUpdateActivityVisibility?: (input: ActualizarVisibilidadActuacionInput) => Promise<unknown>
  reportPending?: boolean
  onRegisterClientReport?: (input: RegistrarReporteClienteInput) => Promise<unknown>
  editor: ReactNode
  relatedForms: { participant: ReactNode; workstream: ReactNode }
  notas?: NotaRemota[]
  taskTitleTemplates?: string[]
}) {
  const [localTab, setLocalTab] = useState<CaseDetailTab>('summary')
  const activeTab = activeTabProp ?? localTab
  comunicaciones = comunicaciones ?? []
  const memberNames = new Map(miembros.map((member) => [member.id, member.nombre]))
  const caseTasks = tareas.filter((task) => task.expedienteId === item.id)
  const openTasks = caseTasks.filter((task) => !['Completada', 'Cancelada'].includes(task.estado))
  const deadlines = caseTasks.filter((task) => task.tipo === 'Plazo' || task.venceEn)
  const alerts = caseAlerts(item, tareas, actuaciones)
  const lastMovement = caseLastMovement(item, actuaciones)
  const principalRegistrado = participantes.some(
    (participant) => participant.contactoId === item.contactoPrincipalId,
  )
  const countForTab: Partial<Record<CaseDetailTab, number>> = {
    workstreams: lineas.length,
    participants: participantes.length + (principalRegistrado ? 0 : 1),
    activities: actuaciones.length,
    documents: documentos.length,
    economic: facturas.length,
    communications:
      comunicaciones.length +
      notas.filter((note) => note.scope === 'case' && note.case_id === item.id).length,
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
        lastMovement={lastMovement}
        alerts={alerts}
        editor={editor}
        notas={notas}
        currentUserId={currentUserId}
        onAcknowledgeNote={onAcknowledgeNote}
        hasActivities={actuaciones.some((activity) => activity.expedienteId === item.id)}
      />

      <div
        className="border-border/80 flex max-w-full gap-0.5 overflow-x-auto border-b"
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
              onClick={() => {
                setLocalTab(id)
                onSelectTab?.(id)
              }}
              className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${selected ? 'border-primary text-foreground' : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent'}`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
              {count !== undefined ? (
                <span
                  className={`rounded-full px-1.5 text-[11px] leading-4 tabular-nums ${selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  {count}
                </span>
              ) : null}
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
            onOpenTask={onOpenTask}
          />
        ) : null}
        {activeTab === 'workstreams' ? (
          <WorkstreamsSection
            lineas={lineas}
            actuaciones={actuaciones}
            documentos={documentos}
            eventos={eventos}
            tasks={caseTasks}
            miembros={miembros}
            expedienteReferencia={item.referencia}
            expedienteId={item.id}
            pending={taskPending}
            updatePending={workstreamPending}
            onCreateTask={onCreateTask}
            onSetNextAction={onSetNextAction}
            onUpdateWorkstream={onUpdateWorkstream}
            onReorder={onReorderWorkstreams}
            reorderPending={reorderPending}
            canManageNextAction={canManageNextAction}
            nextActionPending={nextActionPending}
            createForm={relatedForms.workstream}
            firmId={firmId}
            taskLabels={taskLabels}
            onOpenTask={onOpenTask}
          />
        ) : null}
        {activeTab === 'participants' ? (
          <DetailSection
            title="Intervinientes"
            subtitle="Personas y entidades vinculadas a este expediente."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {!principalRegistrado ? (
                <ParticipantCard
                  isPrincipal
                  participant={{
                    id: `principal-${item.contactoPrincipalId}`,
                    expedienteId: item.id,
                    contactoId: item.contactoPrincipalId,
                    nombre: clienteNombre,
                    rol: 'Contacto principal',
                    confidencialidad: 'Normal',
                  }}
                />
              ) : null}
              {[...participantes]
                .sort(
                  (a, b) =>
                    Number(b.contactoId === item.contactoPrincipalId) -
                    Number(a.contactoId === item.contactoPrincipalId),
                )
                .map((participant) => (
                  <ParticipantCard
                    key={participant.id}
                    participant={participant}
                    isPrincipal={participant.contactoId === item.contactoPrincipalId}
                  />
                ))}
            </div>
            {relatedForms.participant}
          </DetailSection>
        ) : null}
        {activeTab === 'activities' ? (
          <DetailSection
            title="Actuaciones"
            subtitle="Tareas completadas marcadas como actuación o hito histórico."
          >
            <div className="space-y-3">
              {actuaciones.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  memberName={memberNames.get(activity.asignadoId ?? '')}
                  visibilityPending={activityVisibilityPending}
                  onToggleVisibility={() =>
                    onUpdateActivityVisibility({
                      actuacionId: activity.id,
                      expedienteId: item.id,
                      versionEsperada: activity.version,
                      visibleCliente: !activity.visibleCliente,
                    })
                  }
                />
              ))}
            </div>
            {!actuaciones.length ? <EmptyState message="No hay actuaciones registradas." /> : null}
          </DetailSection>
        ) : null}
        {activeTab === 'documents' ? (
          <DocumentsSection documents={documentos} expedienteId={item.id} />
        ) : null}
        {activeTab === 'economic' ? <EconomicSection invoices={facturas} /> : null}
        {activeTab === 'communications' ? (
          <CaseCommunications
            expedienteId={item.id}
            contactId={item.contactoPrincipalId}
            comunicaciones={comunicaciones}
            actuaciones={actuaciones.filter((activity) => activity.expedienteId === item.id)}
            notes={notas.filter((note) => note.scope === 'case' && note.case_id === item.id)}
            pending={communicationPending}
            onCreateCommunication={onCreateCommunication}
            reportPending={reportPending}
            onRegisterClientReport={onRegisterClientReport}
          />
        ) : null}
        {activeTab === 'tasks' ? (
          tasksPanel ?? <TasksSection
            firmId={firmId}
            tasks={caseTasks}
            expediente={item}
            miembros={miembros}
            labels={taskLabels}
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
  lastMovement,
  alerts,
  editor,
  notas,
  hasActivities,
  currentUserId,
  onAcknowledgeNote,
}: {
  expediente: ExpedientePersistido
  lastMovement: string
  alerts: string[]
  editor: ReactNode
  notas: NotaRemota[]
  hasActivities: boolean
  currentUserId?: string | undefined
  onAcknowledgeNote?: ((noteId: string) => Promise<unknown>) | undefined
}) {
  const caseNotes = notas.filter(
    (note) => note.scope === 'case' && note.case_id === expediente.id && note.status === 'active',
  )
  return (
    <>
      <header className="border-border/80 space-y-3 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-lg font-bold tracking-tight text-balance sm:text-xl">
              {expediente.referencia} · {expediente.titulo}
            </h1>
            <p className="text-muted-foreground text-sm">
              {expediente.naturaleza} · {expediente.area || 'Sin área'} ·{' '}
              {expediente.tipoAsunto || 'Sin tipo de asunto'}
            </p>
            <p className="text-muted-foreground text-xs">
              {hasActivities
                ? `Última actuación ${relativeDays(lastMovement)}`
                : `Expediente abierto ${relativeDays(expediente.fechaApertura)} · sin actuaciones aún`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{casePhaseLabel(expediente.fase)}</Badge>
              <Badge variant={expediente.prioridad === 'Alta' ? 'destructive' : 'outline'}>
                Prioridad {expediente.prioridad.toLowerCase()}
              </Badge>
              <Badge variant="outline">{caseDependency(expediente.estadoOperativo)}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <CaseEditDialog editor={editor} />
          </div>
        </div>
        {alerts.length ? (
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {alerts.map((alert) => (
              <span key={alert} className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {alert}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <CaseNotes
        notes={caseNotes}
        currentUserId={currentUserId}
        onAcknowledge={onAcknowledgeNote}
      />
    </>
  )
}

function CaseNotes({
  notes,
  currentUserId,
  onAcknowledge,
}: {
  notes: NotaRemota[]
  currentUserId?: string | undefined
  onAcknowledge?: ((noteId: string) => Promise<unknown>) | undefined
}) {
  const [collapsed, setCollapsed] = useState(false)
  if (!notes.length) return null
  const hasCritical = notes.some((note) => note.critical)
  const pendingAck = notes.filter(
    (note) =>
      note.requires_acknowledgement &&
      Boolean(currentUserId) &&
      !note.acknowledgedUserIds.includes(currentUserId ?? ''),
  ).length
  const sorted = [...notes].sort((a, b) => Number(b.critical) - Number(a.critical))
  return (
    <section
      aria-label="Notas internas del expediente"
      className={`rounded-lg border p-3 ${hasCritical ? 'border-destructive/50' : 'border-border'}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert
            className={`h-4 w-4 ${hasCritical ? 'text-destructive' : 'text-muted-foreground'}`}
            aria-hidden="true"
          />
          Notas internas del expediente a tener en cuenta ({notes.length})
          {pendingAck ? (
            <Badge variant="destructive">
              {pendingAck} pendiente{pendingAck === 1 ? '' : 's'} de confirmar
            </Badge>
          ) : null}
        </h2>
        <div className="flex items-center gap-1">
          <Link to="/notas" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Abrir notas
          </Link>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            {collapsed ? 'Mostrar' : 'Minimizar'}
          </Button>
        </div>
      </header>
      {collapsed ? null : (
        <div className="mt-4 flex flex-wrap gap-4">
          {sorted.map((note) => {
            const needsAck =
              note.requires_acknowledgement &&
              Boolean(currentUserId) &&
              !note.acknowledgedUserIds.includes(currentUserId ?? '')
            return (
              <article
                key={note.id}
                className={`nota-tono-expediente w-full max-w-sm rounded-sm border px-3 py-2.5 shadow-md ${note.critical
                  ? 'nota-sticker nota-sticker-critica'
                  : note.highlighted
                    ? 'nota-sticker nota-sticker-destacada'
                    : ''
                  }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide uppercase">
                      {note.critical
                        ? 'Nota del expediente · advertencia crítica'
                        : 'Nota del expediente'}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{note.title || 'Nota interna'}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {note.requires_acknowledgement ? (
                      <Badge variant="outline" className="border-current/40 text-inherit">
                        Requiere confirmación
                      </Badge>
                    ) : null}
                    {note.critical ? <Badge variant="destructive">Crítica</Badge> : null}
                  </div>
                </div>
                <p className="mt-1.5 text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="mt-2 text-xs opacity-70">
                  {note.actorNames[note.created_by ?? ''] ?? 'Sistema'} ·{' '}
                  {formatDate(note.created_at, true)}
                </p>
                {needsAck && onAcknowledge ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 border-current/40 bg-white/60 text-xs text-inherit"
                    onClick={() =>
                      void onAcknowledge(note.id).catch(() =>
                        toast.error('No se pudo confirmar la lectura.'),
                      )
                    }
                  >
                    Confirmar lectura
                  </Button>
                ) : note.requires_acknowledgement ? (
                  <p className="mt-2 text-xs font-medium">Lectura confirmada</p>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function CaseCommunications({
  expedienteId,
  contactId,
  comunicaciones,
  actuaciones,
  notes,
  pending,
  onCreateCommunication,
  reportPending,
  onRegisterClientReport,
}: {
  expedienteId: string
  contactId: string
  comunicaciones: CaseCommunicationRow[]
  actuaciones: ActuacionPersistida[]
  notes: NotaRemota[]
  pending: boolean
  onCreateCommunication: (input: RegistrarComunicacionExpedienteInput) => Promise<unknown>
  reportPending: boolean
  onRegisterClientReport: (input: RegistrarReporteClienteInput) => Promise<unknown>
}) {
  const submitCommunication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await onCreateCommunication({
        contact_id: contactId,
        direction: String(form.get('direction')) === 'inbound' ? 'inbound' : 'outbound',
        communication_type: String(form.get('communicationType') || 'message'),
        channel: String(form.get('channel') || 'email'),
        subject: String(form.get('subject') || ''),
        content: String(form.get('content') || ''),
        occurred_at: new Date(
          String(form.get('occurredAt') || new Date().toISOString()),
        ).toISOString(),
      })
      formElement.reset()
      toast.success('Comunicación guardada en el expediente.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la comunicación.')
    }
  }
  const submitClientReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const activityIds = form
      .getAll('reportedActivity')
      .map((value) => {
        const activity = actuaciones.find((item) => item.id === value)
        return activity ? { id: activity.id, version: activity.version } : null
      })
      .filter((item): item is { id: string; version: number } => item !== null)
    try {
      await onRegisterClientReport({
        contactId,
        subject: String(form.get('reportSubject') || ''),
        content: String(form.get('reportContent') || ''),
        channel: String(form.get('reportChannel') || 'email'),
        activityIds,
      })
      formElement.reset()
      toast.success('Actualización al cliente registrada junto con las actuaciones seleccionadas.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar la actualización.')
    }
  }

  return (
    <DetailSection
      title="Comunicaciones"
      subtitle="Registra comunicaciones y actualizaciones al cliente junto con las actuaciones que cubren."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar comunicación</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void submitCommunication(event)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs">
                  <span>Dirección</span>
                  <select
                    name="direction"
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  >
                    <option value="outbound">Enviada</option>
                    <option value="inbound">Recibida</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-xs">
                  <span>Canal</span>
                  <select
                    name="channel"
                    className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Teléfono</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="meeting">Reunión</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
              </div>
              <Input name="subject" placeholder="Asunto" maxLength={300} />
              <Textarea
                name="content"
                required
                rows={3}
                maxLength={20000}
                placeholder="Resumen o contenido de la comunicación"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? 'Guardando…' : 'Guardar comunicación'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar actualización al cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void submitClientReport(event)}>
              <Input
                name="reportSubject"
                required
                maxLength={300}
                placeholder="Asunto de la actualización"
              />
              <Textarea
                name="reportContent"
                required
                rows={3}
                maxLength={20000}
                placeholder="Resumen que se ha comunicado al cliente"
              />
              <label className="space-y-1.5 text-xs">
                <span>Canal de envío</span>
                <select
                  name="reportChannel"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                >
                  <option value="email">Email</option>
                  <option value="phone">Teléfono</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="in_person">Presencial</option>
                  <option value="video">Videollamada</option>
                </select>
              </label>
              {actuaciones.some(
                (activity) => activity.visibleCliente && !activity.clienteInformado,
              ) ? (
                <fieldset className="space-y-1.5">
                  <legend className="text-muted-foreground text-xs">
                    Actuaciones visibles aún no comunicadas
                  </legend>
                  <div className="max-h-28 space-y-1 overflow-y-auto">
                    {actuaciones
                      .filter((activity) => activity.visibleCliente && !activity.clienteInformado)
                      .map((activity) => (
                        <label key={activity.id} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" name="reportedActivity" value={activity.id} />
                          {activity.titulo}
                        </label>
                      ))}
                  </div>
                </fieldset>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Marca actuaciones como visibles al cliente para poder vincularlas a la
                  actualización.
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="outline" disabled={reportPending}>
                  {reportPending ? 'Guardando…' : 'Registrar actualización'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de comunicaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comunicaciones.map((communication) => (
            <article key={communication.id} className="border-border rounded-lg border p-3">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-sm font-medium">
                  {communication.subject || 'Comunicación'} ·{' '}
                  {communication.direction === 'outbound' ? 'Enviada' : 'Recibida'}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(communication.occurred_at, true)} · {communication.channel}
                </span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{communication.content}</p>
            </article>
          ))}
          {!comunicaciones.length ? (
            <EmptyState message="Todavía no hay comunicaciones registradas." />
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas internas del expediente</CardTitle>
        </CardHeader>
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
      <Link to="/comunicaciones" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Abrir bandeja de comunicaciones
      </Link>
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
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto p-0 sm:max-h-[calc(100svh-4rem)] sm:max-w-[min(50vw,72rem)]">
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
  onOpenTask,
}: {
  expediente: ExpedientePersistido
  lastMovement: string
  memberName: string | undefined
  clienteNombre: string
  tareas: TareaPersistida[]
  actuaciones: ActuacionPersistida[]
  documentos: CaseDocumentRow[]
  onOpenTask?: ((taskId: string) => void) | undefined
}) {
  const commercialIntake = asRecord(asRecord(expediente.detalles)['commercialIntake'])
  const initialDocuments = Array.isArray(commercialIntake['documentosIniciales'])
    ? commercialIntake['documentosIniciales']
      .map((item) => (item && typeof item === 'object' && 'nombre' in item ? item.nombre : null))
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
  const nextAction = tareas.find((task) => task.esSiguienteAccion) ?? null
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
        <Card className={nextAction ? undefined : 'border-rose-300 bg-rose-50'}>
          <CardHeader>
            <CardTitle
              className={`flex items-center gap-1.5 text-base ${nextAction ? '' : 'text-rose-700'}`}
            >
              {nextAction ? null : <AlertTriangle className="size-4" aria-hidden="true" />}
              Próxima acción
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">
            {nextAction ? (
              <TaskOpenLink
                task={nextAction}
                onOpenTask={onOpenTask}
                className="hover:text-primary underline-offset-4 hover:underline"
              />
            ) : (
              <span role="alert" className="text-rose-700">
                Sin siguiente acción: el expediente está parado
              </span>
            )}
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
            <QuickRow
              label="En espera"
              value={tareas.filter((task) => task.estado === 'En espera').length}
            />
            <QuickRow label="Bloqueadas" value={tareas.filter((task) => task.bloqueada).length} />
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

function lineDetails(line: LineaPersistida): Record<string, Json> {
  const value = line.details
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {}
}

function isLineArchived(line: LineaPersistida) {
  return lineDetails(line)['archivada'] === true
}

function detailString(details: Record<string, Json>, key: string) {
  const value = details[key]
  return typeof value === 'string' ? value.trim() : ''
}

const LINE_STATUS_STYLE: Record<string, { accent: string; badge: string }> = {
  pending: { accent: 'bg-slate-400', badge: 'border-slate-300 bg-slate-100 text-slate-700' },
  in_analysis: { accent: 'bg-violet-500', badge: 'border-violet-300 bg-violet-50 text-violet-700' },
  in_progress: { accent: 'bg-blue-500', badge: 'border-blue-300 bg-blue-50 text-blue-700' },
  on_hold: { accent: 'bg-amber-500', badge: 'border-amber-300 bg-amber-50 text-amber-700' },
  resolved: { accent: 'bg-emerald-500', badge: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  closed: { accent: 'bg-emerald-700', badge: 'border-emerald-400 bg-emerald-100 text-emerald-800' },
  discarded: { accent: 'bg-zinc-300', badge: 'border-zinc-300 bg-zinc-100 text-zinc-500' },
}
const LINE_STATUS_FALLBACK = LINE_STATUS_STYLE['pending']!

const LINE_PRIORITY_STYLE: Record<string, string> = {
  Alta: 'border-rose-300 bg-rose-50 text-rose-700',
  Media: 'border-amber-300 bg-amber-50 text-amber-700',
  Baja: 'border-sky-300 bg-sky-50 text-sky-700',
}

function initials(name: string | undefined) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

function LineChip({
  className,
  icon: Icon,
  children,
}: {
  className?: string | undefined
  icon?: typeof Flag
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${className ?? 'text-muted-foreground bg-muted/40'}`}
    >
      {Icon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

function LineDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value || '—'}</dd>
    </div>
  )
}

type LineAction = { label: string; disabled?: boolean; onSelect: () => void }

function LineActionsMenu({ label, actions }: { label: string; actions: LineAction[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Acciones de la línea ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="bg-popover text-popover-foreground absolute right-0 z-50 mt-1 w-52 rounded-md border p-1 shadow-md"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                className="hover:bg-accent focus-visible:bg-accent w-full rounded-sm px-2 py-1.5 text-left text-sm outline-none disabled:pointer-events-none disabled:opacity-50"
                onClick={() => {
                  setOpen(false)
                  action.onSelect()
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
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
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        {actions ? <div className="ml-auto flex flex-wrap justify-end gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}

type WorkstreamOrder = 'manual' | 'title' | 'target'

function WorkstreamsSection({
  lineas,
  actuaciones,
  documentos,
  eventos,
  tasks,
  miembros,
  expedienteReferencia,
  expedienteId,
  pending,
  updatePending,
  onCreateTask,
  onSetNextAction,
  onUpdateWorkstream,
  onReorder,
  reorderPending,
  canManageNextAction,
  nextActionPending,
  createForm,
  firmId,
  taskLabels,
  onOpenTask,
}: {
  onReorder: (ids: string[]) => Promise<unknown>
  reorderPending: boolean
  firmId?: string | undefined
  taskLabels: TaskLabelOption[]
  onOpenTask?: ((taskId: string) => void) | undefined
  lineas: LineaPersistida[]
  actuaciones: ActuacionPersistida[]
  documentos: CaseDocumentRow[]
  eventos: EventoExpediente[]
  tasks: TareaPersistida[]
  miembros: MiembroDespacho[]
  expedienteReferencia: string
  expedienteId: string
  pending: boolean
  updatePending: boolean
  onCreateTask: (input: CrearTareaInput) => Promise<unknown>
  onSetNextAction: (task: TareaPersistida, enabled: boolean) => Promise<unknown>
  onUpdateWorkstream: (input: ActualizarLineaInput) => Promise<unknown>
  canManageNextAction: (task: TareaPersistida) => boolean
  nextActionPending: boolean
  createForm: ReactNode
}) {
  const [status, setStatus] = useState('all')
  const [assignee, setAssignee] = useState('all')
  const [priority, setPriority] = useState('all')
  const [order, setOrder] = useState<WorkstreamOrder>('manual')
  const [showArchived, setShowArchived] = useState(false)
  const archivedCount = lineas.filter(isLineArchived).length
  const statuses = [...new Set(lineas.map((line) => line.estado).filter(Boolean))]
  const manualOrder = [...lineas].sort((first, second) => first.orden - second.orden)
  const visible = manualOrder
    .filter((line) => showArchived || !isLineArchived(line))
    .filter((line) => status === 'all' || line.estado === status)
    .filter((line) => assignee === 'all' || line.asignadoId === assignee)
    .filter((line) => priority === 'all' || line.prioridad === priority)
    .sort((first, second) => {
      if (order === 'title') return first.titulo.localeCompare(second.titulo, 'es')
      if (order === 'target')
        return dateValue(first.fechaObjetivo) - dateValue(second.fechaObjetivo)
      return first.orden - second.orden
    })
  const memberNames = new Map(miembros.map((member) => [member.id, member.nombre]))
  const hasActiveFilters = [status, assignee, priority].some(
    (value) => value !== 'all',
  )
  const resetFilters = () => {
    setStatus('all')
    setAssignee('all')
    setPriority('all')
  }
  const canReorder = order === 'manual' && !reorderPending
  const moveLine = async (line: LineaPersistida, direction: -1 | 1) => {
    const position = visible.findIndex((candidate) => candidate.id === line.id)
    const neighbour = visible[position + direction]
    if (!neighbour) return
    const ids = manualOrder.map((candidate) => candidate.id)
    const from = ids.indexOf(line.id)
    const to = ids.indexOf(neighbour.id)
      ;[ids[from], ids[to]] = [ids[to]!, ids[from]!]
    try {
      await onReorder(ids)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el orden.')
    }
  }

  return (
    <DetailSection
      title={`Líneas de trabajo · ${lineas.length} en el expediente`}
      subtitle="Frentes autónomos con objetivo, responsable y resultado propios."
      actions={<>{createForm}</>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">Filtros</span>
        <WorkstreamSelect ariaLabel="Estado de línea" value={status} onChange={setStatus}>
          <option value="all">Todos los estados</option>
          {statuses.map((option) => (
            <option key={option} value={option}>
              {workstreamStatusLabel(option)}
            </option>
          ))}
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
          ariaLabel="Orden de líneas"
          value={order}
          onChange={(value) => setOrder(value as WorkstreamOrder)}
        >
          <option value="manual">Orden manual</option>
          <option value="title">Título</option>
          <option value="target">Fecha objetivo</option>
        </WorkstreamSelect>
        {archivedCount ? (
          <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Mostrar archivadas ({archivedCount})
          </label>
        ) : null}
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            Restablecer filtros
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((line, index) => (
          <WorkstreamCard
            key={line.id}
            line={line}
            canMoveUp={canReorder && index > 0}
            canMoveDown={canReorder && index < visible.length - 1}
            onMove={(direction) => moveLine(line, direction)}
            lineas={lineas}
            actuaciones={actuaciones}
            documentos={documentos}
            eventos={eventos}
            tasks={tasks.filter((task) => task.lineaId === line.id)}
            miembros={miembros}
            expedienteId={expedienteId}
            pending={pending}
            updatePending={updatePending}
            onUpdateWorkstream={onUpdateWorkstream}
            onCreateTask={onCreateTask}
            onSetNextAction={onSetNextAction}
            canManageNextAction={canManageNextAction}
            nextActionPending={nextActionPending}
            memberName={memberNames.get(line.asignadoId ?? '')}
            firmId={firmId}
            taskLabels={taskLabels}
            onOpenTask={onOpenTask}
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
    <label className="sm:flex-none">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs sm:w-auto"
      >
        {children}
      </select>
    </label>
  )
}

function WorkstreamCard({
  line,
  lineas,
  actuaciones,
  documentos,
  eventos,
  tasks,
  miembros,
  expedienteId,
  pending,
  updatePending,
  onUpdateWorkstream,
  onCreateTask,
  onSetNextAction,
  canManageNextAction,
  nextActionPending,
  memberName,
  firmId,
  taskLabels,
  onOpenTask,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (direction: -1 | 1) => Promise<unknown>
  firmId?: string | undefined
  taskLabels: TaskLabelOption[]
  onOpenTask?: ((taskId: string) => void) | undefined
  line: LineaPersistida
  lineas: LineaPersistida[]
  actuaciones: ActuacionPersistida[]
  documentos: CaseDocumentRow[]
  eventos: EventoExpediente[]
  tasks: TareaPersistida[]
  miembros: MiembroDespacho[]
  expedienteId: string
  pending: boolean
  updatePending: boolean
  onUpdateWorkstream: (input: ActualizarLineaInput) => Promise<unknown>
  onCreateTask: (input: CrearTareaInput) => Promise<unknown>
  onSetNextAction: (task: TareaPersistida, enabled: boolean) => Promise<unknown>
  canManageNextAction: (task: TareaPersistida) => boolean
  nextActionPending: boolean
  memberName: string | undefined
}) {
  const nextAction = tasks.find((task) => task.esSiguienteAccion) ?? null
  const [expanded, setExpanded] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const archived = isLineArchived(line)
  const closedStatus = ['resolved', 'closed', 'discarded'].includes(line.estado)
  const statusStyle = LINE_STATUS_STYLE[line.estado] ?? LINE_STATUS_FALLBACK
  const doneTasks = tasks.filter((task) => ['Completada', 'Cancelada'].includes(task.estado)).length
  const overdue =
    !closedStatus &&
    Boolean(line.fechaObjetivo) &&
    line.fechaObjetivo! < new Date().toISOString().slice(0, 10)
  const details = lineDetails(line)
  const collaborators = Array.isArray(details['colaboradores'])
    ? details['colaboradores']
      .map((id) => miembros.find((member) => member.id === id)?.nombre)
      .filter(Boolean)
      .join(', ')
    : ''

  const patchLine = async (
    patch: Partial<ActualizarLineaInput>,
    detailsPatch: Record<string, Json> | null,
    message: string,
  ) => {
    try {
      await onUpdateWorkstream({
        id: line.id,
        expedienteId: line.expedienteId,
        versionEsperada: line.version,
        parentId: line.parentId,
        titulo: line.titulo,
        tipo: line.tipo,
        descripcion: line.descripcion,
        estado: line.estado,
        prioridad: line.prioridad,
        asignadoId: line.asignadoId,
        fechaInicio: line.fechaInicio,
        fechaObjetivo: line.fechaObjetivo,
        fechaResolucion: line.fechaResolucion,
        fechaCierre: line.fechaCierre,
        ...patch,
        details: { ...details, ...detailsPatch },
      })
      toast.success(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la línea.')
    }
  }
  const markResolved = () => {
    const today = new Date().toISOString().slice(0, 10)
    const resolvedOn = line.fechaResolucion ?? (line.fechaInicio && line.fechaInicio > today ? line.fechaInicio : today)
    return patchLine(
      { estado: 'resolved', fechaResolucion: resolvedOn },
      null,
      'Línea marcada como resuelta.',
    )
  }
  const toggleArchived = () =>
    patchLine(
      {},
      { archivada: !archived },
      archived ? 'Línea restaurada.' : 'Línea archivada.',
    )

  const updateNextAction = async (task: TareaPersistida) => {
    const enabled = !task.esSiguienteAccion
    try {
      await onSetNextAction(task, enabled)
      toast.success(enabled ? 'Siguiente acción actualizada.' : 'Siguiente acción retirada.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo actualizar la siguiente acción.',
      )
    }
  }

  return (
    <Card
      className={`relative overflow-hidden transition-shadow hover:shadow-md ${archived ? 'opacity-60' : ''}`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${statusStyle.accent}`}
        aria-hidden="true"
      />
      <CardContent className="space-y-3 pt-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base leading-tight font-semibold">{line.titulo}</p>
              <LineChip className={statusStyle.badge}>{workstreamStatusLabel(line.estado)}</LineChip>
              {archived ? <LineChip>Archivada</LineChip> : null}
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {line.descripcion || line.tipo || 'Sin descripción'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Contraer' : 'Ver detalles'}
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </Button>
            <LineActionsMenu
              label={line.titulo}
              actions={[
                { label: 'Abrir y editar', onSelect: () => setDetailOpen(true) },
                { label: 'Subir orden', disabled: !canMoveUp, onSelect: () => void onMove(-1) },
                { label: 'Bajar orden', disabled: !canMoveDown, onSelect: () => void onMove(1) },
                { label: 'Crear tarea vinculada', onSelect: () => setTaskOpen(true) },
                {
                  label: 'Marcar resuelta',
                  disabled: closedStatus || updatePending,
                  onSelect: () => void markResolved(),
                },
                {
                  label: archived ? 'Restaurar' : 'Archivar',
                  disabled: updatePending,
                  onSelect: () => void toggleArchived(),
                },
              ]}
            />
            <TaskCreateDialog
              firmId={firmId}
              expedienteId={expedienteId}
              lineaId={line.id}
              title="Nueva tarea para la línea"
              contextLabel={`«${line.titulo}»`}
              defaultAssigneeId={line.asignadoId}
              members={miembros.map((member) => ({ id: member.id, nombre: member.nombre }))}
              labels={taskLabels}
              pending={pending}
              successMessage="Tarea vinculada a la línea de trabajo."
              onCreate={onCreateTask}
              open={taskOpen}
              onOpenChange={setTaskOpen}
            />
            <WorkstreamDetailDialog
              open={detailOpen}
              onOpenChange={setDetailOpen}
              line={line}
              lineas={lineas}
              miembros={miembros}
              tareas={tasks}
              actuaciones={actuaciones}
              documentos={documentos}
              eventos={eventos}
              memberNames={new Map(miembros.map((member) => [member.id, member.nombre]))}
              pending={updatePending}
              onSave={onUpdateWorkstream}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LineChip>
            <span
              className="bg-primary/10 text-primary flex size-4 items-center justify-center rounded-full text-[9px] font-semibold"
              aria-hidden="true"
            >
              {initials(memberName)}
            </span>
            Responsable: {memberName ?? 'Sin asignar'}
          </LineChip>
          <LineChip
            icon={CalendarClock}
            className={
              overdue
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'text-muted-foreground bg-muted/40'
            }
          >
            Objetivo: {formatDate(line.fechaObjetivo)}
            {overdue ? ' · vencida' : ''}
          </LineChip>
          <LineChip
            icon={Flag}
            className={LINE_PRIORITY_STYLE[line.prioridad] ?? 'text-muted-foreground bg-muted/40'}
          >
            Prioridad: {line.prioridad}
          </LineChip>
          <LineChip icon={ListChecks}>
            {doneTasks}/{tasks.length} tareas
          </LineChip>
        </div>
        {tasks.length ? (
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={`Progreso de tareas de ${line.titulo}`}
            aria-valuemin={0}
            aria-valuemax={tasks.length}
            aria-valuenow={doneTasks}
          >
            <div
              className={`h-full rounded-full ${statusStyle.accent}`}
              style={{ width: `${(doneTasks / tasks.length) * 100}%` }}
            />
          </div>
        ) : null}
        {expanded ? (
          <dl className="bg-muted/30 space-y-1.5 rounded-md border border-dashed p-3 text-xs">
            <LineDetail label="Objetivo" value={detailString(details, 'objetivo')} />
            <LineDetail
              label="Se dará por cumplida cuando"
              value={detailString(details, 'criterioFinalizacion') || detailString(details, 'indicador')}
            />
            <LineDetail label="Último avance" value={detailString(details, 'ultimoAvance')} />
            <LineDetail label="Bloqueo" value={detailString(details, 'bloqueo')} />
            <LineDetail label="Colaboradores" value={collaborators} />
            <LineDetail
              label="Fechas"
              value={`Apertura ${formatDate(line.fechaInicio)} · Objetivo ${formatDate(line.fechaObjetivo)}`}
            />
          </dl>
        ) : null}
        <div
          role={!nextAction && !closedStatus ? 'alert' : undefined}
          className={`rounded-md border px-3 py-2 ${!nextAction && !closedStatus
            ? 'border-rose-300 bg-rose-50 text-rose-800'
            : 'border-primary/20 bg-primary/5'
            }`}
        >
          <p
            className={`flex items-center gap-1 text-xs font-semibold ${!nextAction && !closedStatus ? 'text-rose-700' : 'text-primary'
              }`}
          >
            {!nextAction && !closedStatus ? (
              <AlertTriangle className="size-3.5" aria-hidden="true" />
            ) : null}
            Siguiente acción
          </p>
          {nextAction ? (
            <TaskOpenLink
              task={nextAction}
              onOpenTask={onOpenTask}
              ariaLabel={`Abrir siguiente acción: ${nextAction.titulo}`}
              className="mt-1 inline-block text-left text-sm font-medium underline-offset-4 hover:underline"
            />
          ) : (
            <p
              className={`mt-1 text-sm ${closedStatus ? 'text-muted-foreground' : 'font-medium text-rose-700'}`}
            >
              Sin siguiente acción definida para esta línea.
            </p>
          )}
        </div>
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Tareas de esta línea · {tasks.length}</p>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <TaskOpenLink
                  task={task}
                  onOpenTask={onOpenTask}
                  className="truncate text-left underline-offset-4 hover:underline"
                />
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {task.estado} · {task.prioridad}
                  {task.venceEn ? ` · ${formatDate(task.venceEn)}` : ''}
                  {task.esSiguienteAccion ? ' · Siguiente acción' : ''}
                </p>
              </div>
              {!['Completada', 'Cancelada'].includes(task.estado) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={nextActionPending || !canManageNextAction(task)}
                  aria-label={`${task.esSiguienteAccion ? 'Quitar' : 'Marcar'} siguiente acción: ${task.titulo}`}
                  onClick={() => void updateNextAction(task)}
                >
                  {task.esSiguienteAccion ? 'Quitar siguiente acción' : 'Marcar siguiente acción'}
                </Button>
              ) : null}
            </div>
          ))}
          {!tasks.length ? (
            <p className="text-muted-foreground text-xs">Todavía no hay tareas en esta línea.</p>
          ) : null}
          <CaseTaskCreateDialog
            firmId={firmId}
            expedienteId={expedienteId}
            lineaId={line.id}
            asignadoId={line.asignadoId}
            members={miembros.map((member) => ({ id: member.id, nombre: member.nombre }))}
            labels={taskLabels}
            pending={pending}
            onCreate={onCreateTask}
            triggerLabel="Añadir tarea"
            dialogTitle="Nueva tarea para la línea"
            contextLabel={`«${line.titulo}»`}
            titleAriaLabel={`Nueva tarea para ${line.titulo}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function TaskOpenLink({
  task,
  onOpenTask,
  ariaLabel,
  className,
}: {
  task: TareaPersistida
  onOpenTask?: ((taskId: string) => void) | undefined
  ariaLabel?: string
  className: string
}) {
  if (onOpenTask) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onOpenTask(task.id)}
        className={className}
      >
        {task.titulo}
      </button>
    )
  }
  return (
    <Link
      to="/tareas/$taskId"
      params={{ taskId: task.id }}
      aria-label={ariaLabel}
      className={className}
    >
      {task.titulo}
    </Link>
  )
}

function ParticipantCard({
  participant,
  isPrincipal = false,
}: {
  participant: ParticipantePersistido
  isPrincipal?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div>
          <p className="font-medium">{participant.nombre}</p>
          <p className="text-muted-foreground mt-1 text-sm">{participant.rol}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {isPrincipal ? <Badge>Contacto principal</Badge> : null}
          <Badge variant="outline">{participant.confidencialidad}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityCard({
  activity,
  memberName,
  visibilityPending,
  onToggleVisibility,
}: {
  activity: ActuacionPersistida
  memberName: string | undefined
  visibilityPending: boolean
  onToggleVisibility: () => void
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{activity.titulo}</p>
            {activity.descripcion ? (
              <p className="text-muted-foreground mt-1 text-sm">{activity.descripcion}</p>
            ) : null}
          </div>
          <span className="text-muted-foreground text-xs">
            {formatDate(activity.ocurridaEn, true)}
          </span>
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Badge variant={activity.relevancia === 'milestone' ? 'default' : 'secondary'}>
            {activity.tipo}
          </Badge>
          <span>Responsable: {memberName ?? 'Sin asignar'}</span>
        </div>
        {activity.resultado ? (
          <p className="border-primary/15 bg-muted/30 rounded-md border px-3 py-2 text-sm">
            Resultado: {activity.resultado}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={visibilityPending}
            onClick={onToggleVisibility}
          >
            {activity.visibleCliente ? 'Dejar como interna' : 'Marcar visible al cliente'}
          </Button>
        </div>
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

function EconomicSection({ invoices }: { invoices: FacturaPersistida[] }) {
  const issuedInvoices = invoices.filter((invoice) => invoice.estado !== 'draft')
  const total = issuedInvoices.reduce((sum, invoice) => sum + invoice.importeTotal, 0)
  const collected = issuedInvoices.reduce((sum, invoice) => sum + invoice.importeCobrado, 0)
  const pending = issuedInvoices.reduce((sum, invoice) => sum + invoice.importePendiente, 0)
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
  return (
    <DetailSection
      title="Situación económica"
      subtitle="Facturas y cobros vinculados a este expediente."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Facturado" amount={money(total, invoices[0]?.moneda ?? 'EUR')} />
        <Metric label="Cobrado" amount={money(collected, invoices[0]?.moneda ?? 'EUR')} />
        <Metric label="Pendiente" amount={money(pending, invoices[0]?.moneda ?? 'EUR')} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Facturas del expediente</CardTitle>
          <Link to="/facturacion" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Abrir facturación
          </Link>
        </CardHeader>
        <CardContent className="divide-border divide-y pt-0">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {invoice.referencia} · {invoice.concepto}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {invoice.cliente} · Emitida {invoice.emision}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={invoice.estado === 'paid' ? 'default' : 'secondary'}>
                  {invoiceStatus(invoice.estado)}
                </Badge>
                <span className="text-right text-sm font-medium tabular-nums">
                  {money(invoice.importeTotal, invoice.moneda)}
                  <span className="text-muted-foreground block text-xs font-normal">
                    Pendiente {money(invoice.importePendiente, invoice.moneda)}
                  </span>
                </span>
              </div>
            </div>
          ))}
          {!invoices.length ? (
            <EmptyState message="Todavía no hay facturas vinculadas a este expediente." />
          ) : null}
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function Metric({ label, amount }: { label: string; amount: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{amount}</p>
      </CardContent>
    </Card>
  )
}

function invoiceStatus(status: FacturaPersistida['estado']) {
  const labels: Record<FacturaPersistida['estado'], string> = {
    draft: 'Borrador',
    issued: 'Emitida',
    partially_paid: 'Pago parcial',
    paid: 'Pagada',
    overdue: 'Vencida',
    cancelled: 'Anulada',
    written_off: 'Incobrable',
  }
  return labels[status]
}

function TasksSection({
  firmId,
  tasks,
  expediente,
  miembros,
  labels,
  pending,
  onCreate,
  titleTemplates,
}: {
  firmId?: string | undefined
  tasks: TareaPersistida[]
  expediente: ExpedientePersistido
  miembros: MiembroDespacho[]
  labels: TaskLabelOption[]
  pending: boolean
  onCreate: (input: CrearTareaInput) => Promise<unknown>
  titleTemplates: string[]
}) {
  return (
    <DetailSection
      title="Tareas"
      subtitle="Trabajo pendiente y completado vinculado a este expediente."
      actions={
        <CaseTaskCreateDialog
          firmId={firmId}
          expedienteId={expediente.id}
          asignadoId={expediente.asignadoId}
          pending={pending}
          onCreate={onCreate}
          titleTemplates={titleTemplates}
          labels={labels}
          triggerLabel="Añadir tarea"
          dialogTitle="Nueva tarea para el expediente"
          contextLabel={`el expediente ${expediente.referencia}`}
          titleAriaLabel="Título de tarea"
          members={miembros.map((member) => ({ id: member.id, nombre: member.nombre }))}
        />
      }
    >
      <Card>
        <CardContent className="divide-y pt-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {!tasks.length ? <EmptyState message="No hay tareas registradas." /> : null}
        </CardContent>
      </Card>
    </DetailSection>
  )
}

function CaseTaskCreateDialog({
  firmId,
  expedienteId,
  lineaId,
  asignadoId,
  pending,
  onCreate,
  titleTemplates = [],
  labels = [],
  triggerLabel,
  dialogTitle,
  contextLabel,
  titleAriaLabel,
  members,
}: {
  firmId?: string | undefined
  expedienteId: string
  lineaId?: string
  asignadoId: string | null
  pending: boolean
  onCreate: (input: CrearTareaInput) => Promise<unknown>
  titleTemplates?: string[]
  labels?: TaskLabelOption[]
  triggerLabel: string
  dialogTitle: string
  contextLabel: string
  titleAriaLabel: string
  members: Array<{ id: string; nombre: string }>
}) {
  return (
    <TaskCreateDialog
      firmId={firmId}
      expedienteId={expedienteId}
      lineaId={lineaId ?? null}
      title={dialogTitle}
      contextLabel={contextLabel}
      defaultAssigneeId={asignadoId}
      members={members}
      labels={labels}
      titleTemplates={titleTemplates}
      titleAriaLabel={titleAriaLabel}
      pending={pending}
      successMessage={
        lineaId ? 'Tarea vinculada a la línea de trabajo.' : 'Tarea vinculada al expediente.'
      }
      onCreate={onCreate}
      trigger={
        <Button type="button" size="sm">
          <Plus className="size-4" aria-hidden="true" /> {triggerLabel}
        </Button>
      }
    />
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
