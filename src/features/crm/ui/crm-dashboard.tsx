import { Link } from '@tanstack/react-router'
import { ArrowRight, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import {
  OPPORTUNITY_STAGE_LABELS,
  useMiembrosDespacho,
  useOportunidades,
  type OportunidadResumen,
} from '@/features/crm'
import { useTareasPersistentes, type TareaPersistida } from '@/features/tareas'
import type { OpportunityStage } from '@/shared/infrastructure/supabase'
import { isOlderThan, isOverdue } from '@/shared/lib/time-status'

const DAY_MS = 86_400_000
const STALE_AFTER_MS = 14 * DAY_MS
const ACTIVE_STAGES = [
  'entry',
  'qualification',
  'first_meeting',
  'quote',
  'validation',
  'engagement',
] as const
const STAGE_RANK: Record<OpportunityStage, number> = {
  entry: 0,
  qualification: 1,
  first_meeting: 2,
  quote: 3,
  validation: 4,
  engagement: 5,
  won: 6,
  lost: -1,
}

type CrmDashboardData = { opportunities: OportunidadResumen[]; tasks: TareaPersistida[] }
type ChartItem = { label: string; value: number; detail?: string }
type AlertItem = { opportunity: OportunidadResumen; messages: string[]; severity: number }

export function buildCrmMetrics({ opportunities, tasks }: CrmDashboardData, now = Date.now()) {
  const openTasks = tasks.filter((task) => !['Completada', 'Cancelada'].includes(task.estado))
  const activeOpportunities = opportunities.filter((item) => !['won', 'lost'].includes(item.fase))
  const wonOpportunities = opportunities.filter((item) => item.fase === 'won')
  const lostOpportunities = opportunities.filter((item) => item.fase === 'lost')
  const tasksByOpportunity = groupTasksByOpportunity(openTasks)
  const staleOpportunities = activeOpportunities.filter((item) =>
    isOlderThan(item.actualizada, STALE_AFTER_MS, now),
  )
  const withoutAction = activeOpportunities.filter((item) => !tasksByOpportunity.has(item.id))
  const pendingReview = activeOpportunities.filter((item) => isPendingReview(item.subestado))
  const opportunitiesWithUpcomingMeeting = activeOpportunities.filter((item) =>
    (tasksByOpportunity.get(item.id) ?? []).some(
      (task) => task.tipo === 'Evento' && isUpcoming(task.venceEn, now),
    ),
  )
  const reachedStage = (stage: OpportunityStage) =>
    opportunities.filter((item) => STAGE_RANK[item.fase] >= STAGE_RANK[stage]).length
  const funnel: ChartItem[] = [
    { label: 'Entradas registradas', value: opportunities.length },
    { label: 'Cualificación alcanzada', value: reachedStage('qualification') },
    { label: 'Primera cita alcanzada', value: reachedStage('first_meeting') },
    { label: 'Solicitud de presupuesto', value: reachedStage('quote') },
    { label: 'En validación', value: reachedStage('validation') },
    { label: 'Aceptados', value: wonOpportunities.length },
  ]
  const phaseAge = ACTIVE_STAGES.map((stage) => {
    const items = activeOpportunities.filter((item) => item.fase === stage)
    return {
      label: OPPORTUNITY_STAGE_LABELS[stage],
      value: average(items.map((item) => daysSince(item.actualizada, now))),
      detail: `${items.length} ${items.length === 1 ? 'Lead' : 'Leads'}`,
    }
  }).filter((item) => item.value || item.detail !== '0 Leads')
  const sources = countBy(activeOpportunities, (item) => item.origen.trim() || 'Sin origen')
  const priorities = ['Alta', 'Media', 'Baja'].map((priority) => ({
    label: priority,
    value: activeOpportunities.filter((item) => item.prioridad === priority).length,
  }))
  const nextActions = [...openTasks]
    .filter((task) => task.oportunidadId)
    .sort((first, second) => dueTimestamp(first.venceEn) - dueTimestamp(second.venceEn))
    .slice(0, 8)
  const alerts = activeOpportunities
    .map((opportunity): AlertItem | null => {
      const linkedTasks = tasksByOpportunity.get(opportunity.id) ?? []
      const messages = [
        ...(linkedTasks.length ? [] : ['Sin próxima acción']),
        ...(isOlderThan(opportunity.actualizada, STALE_AFTER_MS, now)
          ? [`Sin actualizar ${daysSince(opportunity.actualizada, now)} días`]
          : []),
        ...(linkedTasks.some((task) => isOverdue(task.venceEn, now)) ? ['Acción vencida'] : []),
        ...(linkedTasks.some((task) => task.critico) ? ['Tarea crítica'] : []),
        ...(isPendingReview(opportunity.subestado) ? ['Pendiente de revisión'] : []),
      ]
      return messages.length ? { opportunity, messages, severity: alertSeverity(messages) } : null
    })
    .filter((item): item is AlertItem => Boolean(item))
    .sort((first, second) => second.severity - first.severity)

  const reachedFirstMeeting = reachedStage('first_meeting')
  const reachedQuote = reachedStage('quote')
  return {
    openTasks,
    activeOpportunities,
    wonOpportunities,
    lostOpportunities,
    withoutAction,
    staleOpportunities,
    pendingReview,
    opportunitiesWithUpcomingMeeting,
    pendingQuotes: activeOpportunities.filter((item) =>
      ['quote', 'validation'].includes(item.fase),
    ),
    validationOpportunities: activeOpportunities.filter((item) => item.fase === 'validation'),
    funnel,
    phaseAge,
    sources,
    priorities,
    nextActions,
    alerts,
    conversion: percentage(wonOpportunities.length, opportunities.length),
    meetingConversion: percentage(wonOpportunities.length, reachedFirstMeeting),
    quoteConversion: percentage(wonOpportunities.length, reachedQuote),
    overdueActions: openTasks.filter(
      (task) => Boolean(task.oportunidadId) && isOverdue(task.venceEn, now),
    ),
  }
}

export function CrmDashboard() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const opportunitiesQuery = useOportunidades(firmId)
  const tasksQuery = useTareasPersistentes(firmId)
  const contactsQuery = useContactos(firmId)
  const membersQuery = useMiembrosDespacho(firmId)
  const [dashboardTime] = useState(() => Date.now())

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando CRM" description="Consultando el despacho activo…" />
  if (session.status !== 'signed-in' || !firmId)
    return <PendingPanel title="CRM no disponible" description="Necesitas una membresía activa." />

  const queries = [opportunitiesQuery, tasksQuery, contactsQuery, membersQuery]
  if (queries.some((query) => query.isPending))
    return <PendingPanel title="Cargando CRM" description="Consultando Leads y tareas…" />
  if (queries.some((query) => query.isError))
    return (
      <PendingPanel title="No se pudo cargar el CRM" description="Reintenta en unos instantes." />
    )

  const metrics = buildCrmMetrics(
    { opportunities: opportunitiesQuery.data ?? [], tasks: tasksQuery.data ?? [] },
    dashboardTime,
  )
  const contactsById = new Map<string, string>(
    (contactsQuery.data ?? []).map(
      (contact) =>
        [
          contact.id,
          contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim(),
        ] as [string, string],
    ),
  )
  const membersById = new Map<string, string>(
    (membersQuery.data ?? []).map((member): [string, string] => [member.id, member.nombre]),
  )
  const opportunitiesById = new Map<string, OportunidadResumen>(
    (opportunitiesQuery.data ?? []).map((item): [string, OportunidadResumen] => [item.id, item]),
  )

  return (
    <main className="mx-auto max-w-350 space-y-6">
      <SectionHeader
        title="Cockpit CRM"
        subtitle="Estado actual del embudo comercial, alertas operativas e indicadores de conversión."
        actions={
          <Link
            to="/oportunidades/nueva"
            className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo Lead
          </Link>
        }
      />

      <section
        aria-label="Indicadores operativos del CRM"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <CrmMetric label="Leads activos" value={metrics.activeOpportunities.length} tone="info" />
        <CrmMetric
          label="Nuevas entradas"
          value={metrics.activeOpportunities.filter((item) => item.fase === 'entry').length}
          tone="info"
        />
        <CrmMetric
          label="Primeras citas próximas"
          value={metrics.opportunitiesWithUpcomingMeeting.length}
          tone="info"
        />
        <CrmMetric
          label="Presupuestos pendientes"
          value={metrics.pendingQuotes.length}
          tone="aviso"
        />
        <CrmMetric label="Sin próxima acción" value={metrics.withoutAction.length} tone="riesgo" />
        <CrmMetric
          label="Estancados (14+ días)"
          value={metrics.staleOpportunities.length}
          tone="aviso"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Embudo comercial"
          description="Leads que se encuentran o han avanzado por cada fase. Los cerrados no se reconstruyen como historial."
        >
          <HorizontalBars items={metrics.funnel} unit="Leads" showPercentage />
        </ChartCard>
        <ChartCard
          title="Indicadores básicos"
          description="Conversión sobre los registros persistentes del despacho."
        >
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Kpi label="Conversión comercial" value={`${metrics.conversion} %`} tone="exito" />
            <Kpi
              label="Conversión desde primera cita"
              value={`${metrics.meetingConversion} %`}
              tone="info"
            />
            <Kpi
              label="Conversión de presupuestos"
              value={`${metrics.quoteConversion} %`}
              tone="info"
            />
            <Kpi label="Acciones vencidas" value={metrics.overdueActions.length} tone="riesgo" />
          </div>
          <div className="mt-5">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Días desde la última actualización
            </p>
            <HorizontalBars items={metrics.phaseAge} unit="días" compact />
          </div>
        </ChartCard>
        <ChartCard
          title="Distribución por origen"
          description="Leads activos agrupados por su canal de entrada."
        >
          <HorizontalBars items={metrics.sources} unit="Leads" />
        </ChartCard>
        <ChartCard
          title="Prioridad comercial"
          description="Carga activa según la prioridad asignada al Lead."
        >
          <HorizontalBars items={metrics.priorities} unit="Leads" />
        </ChartCard>
        <DashboardCard
          className="lg:col-span-2"
          title="Próximas acciones asignadas"
          empty="No hay tareas abiertas vinculadas a Leads."
        >
          {metrics.nextActions.map((task) => {
            const opportunity = opportunitiesById.get(task.oportunidadId ?? '')
            if (!opportunity) return null
            return (
              <Link
                key={task.id}
                to="/oportunidades/$id"
                params={{ id: opportunity.id }}
                className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{task.titulo}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {opportunity.referencia} ·{' '}
                    {contactsById.get(opportunity.contactoId) ?? 'Contacto no disponible'} ·{' '}
                    {OPPORTUNITY_STAGE_LABELS[opportunity.fase]} ·{' '}
                    {membersById.get(task.asignadoId ?? '') ?? 'Sin responsable'}
                  </span>
                </span>
                <Badge
                  variant={isOverdue(task.venceEn, dashboardTime) ? 'destructive' : 'secondary'}
                >
                  {formatDueDate(task.venceEn)}
                </Badge>
              </Link>
            )
          })}
        </DashboardCard>
        <DashboardCard
          className="lg:col-span-2"
          title="Alertas abiertas"
          empty="No hay alertas operativas abiertas."
        >
          {metrics.alerts.slice(0, 10).map(({ opportunity, messages, severity }) => (
            <Link
              key={opportunity.id}
              to="/oportunidades/$id"
              params={{ id: opportunity.id }}
              className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
            >
              <span className="min-w-0 truncate text-sm font-medium">
                {opportunity.referencia} · {opportunity.titulo}
              </span>
              <span className="flex flex-wrap gap-1">
                {messages.map((message) => (
                  <AlertBadge key={message} message={message} severity={severity} />
                ))}
              </span>
            </Link>
          ))}
          <p className="text-muted-foreground pt-3 text-xs">
            {metrics.openTasks.length} tareas abiertas en el despacho.
          </p>
        </DashboardCard>
      </div>
    </main>
  )
}

function CrmMetric({ label, value, tone }: { label: string; value: number; tone: MetricTone }) {
  const toneClass = metricToneClass[tone]
  return (
    <Link
      to="/oportunidades"
      search={{ vista: 'todas', abrir: '' }}
      className="group bg-card hover:border-primary/40 hover:bg-muted/50 flex min-h-20 items-center justify-between gap-3 rounded-lg border px-3.5 py-3 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${toneClass}`}
        >
          {value}
        </span>
      </div>
      <ArrowRight
        className="text-muted-foreground group-hover:text-primary h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="space-y-1.5 px-5 pt-5 pb-3">
        <CardTitle className="text-sm font-semibold tracking-wide uppercase">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  )
}

function HorizontalBars({
  items,
  unit,
  compact = false,
  showPercentage = false,
}: {
  items: ChartItem[]
  unit: string
  compact?: boolean
  showPercentage?: boolean
}) {
  const max = Math.max(...items.map((item) => item.value), 1)
  if (!items.length)
    return <p className="text-muted-foreground text-sm">Todavía no hay datos para mostrar.</p>
  return (
    <ul className={compact ? 'space-y-2.5' : 'space-y-3'} aria-label={`Gráfico de barras: ${unit}`}>
      {items.map((item) => {
        const width = max ? Math.max((item.value / max) * 100, item.value ? 8 : 0) : 0
        return (
          <li
            key={item.label}
            className="grid grid-cols-[minmax(7rem,1.1fr)_minmax(6rem,2fr)_auto] items-center gap-x-3"
            title={`${item.label}: ${item.value} ${unit}`}
          >
            <span className="min-w-0 truncate text-xs font-medium">{item.label}</span>
            <progress className="sr-only" aria-label={item.label} value={item.value} max={max}>
              {item.value} {unit}
            </progress>
            <div
              className={`bg-muted overflow-hidden rounded-full ${compact ? 'h-1.5' : 'h-2.5'}`}
              aria-hidden="true"
            >
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-muted-foreground flex shrink-0 items-baseline gap-1 text-xs tabular-nums">
              <span className="text-foreground font-medium">{item.value}</span>
              <span className="hidden sm:inline">{unit}</span>
              {showPercentage ? <span>· {percentage(item.value, max)} %</span> : null}
              {item.detail ? <span>· {item.detail}</span> : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone: MetricTone }) {
  return (
    <div className="border-border/70 border-l-2 pl-3 first:border-l-0 first:pl-0 sm:nth-[2n+1]:border-l-0 sm:nth-[2n+1]:pl-0">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className={`mt-1 font-serif text-3xl font-semibold tabular-nums ${kpiToneClass[tone]}`}>
        {value}
      </p>
    </div>
  )
}

function AlertBadge({ message, severity }: { message: string; severity: number }) {
  return (
    <Badge variant={severity >= 3 ? 'destructive' : severity === 2 ? 'secondary' : 'outline'}>
      {message}
    </Badge>
  )
}

function DashboardCard({
  title,
  empty,
  children,
  className,
}: {
  title: string
  empty: string
  children: ReactNode
  className?: string
}) {
  const hasChildren = Array.isArray(children)
    ? children.filter(Boolean).length > 0
    : Boolean(children)
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasChildren ? children : <p className="text-muted-foreground text-sm">{empty}</p>}
      </CardContent>
    </Card>
  )
}

type MetricTone = 'neutro' | 'exito' | 'aviso' | 'riesgo' | 'info'

const metricToneClass: Record<MetricTone, string> = {
  neutro: 'bg-muted text-foreground',
  exito: 'bg-success/15 text-success-foreground',
  aviso: 'bg-warning/15 text-warning-foreground',
  riesgo: 'bg-destructive/10 text-destructive',
  info: 'bg-primary/10 text-primary',
}
const kpiToneClass: Record<MetricTone, string> = {
  neutro: 'text-foreground',
  exito: 'text-success',
  aviso: 'text-warning-foreground',
  riesgo: 'text-destructive',
  info: 'text-primary',
}
function groupTasksByOpportunity(tasks: TareaPersistida[]) {
  const grouped = new Map<string, TareaPersistida[]>()
  for (const task of tasks) {
    if (!task.oportunidadId) continue
    grouped.set(task.oportunidadId, [...(grouped.get(task.oportunidadId) ?? []), task])
  }
  return grouped
}

function countBy(
  items: OportunidadResumen[],
  key: (item: OportunidadResumen) => string,
): ChartItem[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const label = key(item)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort(
      (first, second) =>
        second.value - first.value || first.label.localeCompare(second.label, 'es'),
    )
}

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0
}

function daysSince(value: string, now: number) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / DAY_MS)) : 0
}

function dueTimestamp(value: string | null) {
  const timestamp = value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

function isUpcoming(value: string | null, now: number) {
  const timestamp = dueTimestamp(value)
  return timestamp >= now && timestamp <= now + 30 * DAY_MS
}

function isPendingReview(substate: string) {
  return /sin revisar|pendiente.*revisi[oó]n/i.test(substate)
}

function alertSeverity(messages: string[]) {
  if (messages.some((message) => /vencida|crítica/i.test(message))) return 3
  if (messages.some((message) => /actualizar/i.test(message))) return 2
  return 1
}

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0
}

function formatDueDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(
    new Date(value),
  )
}
