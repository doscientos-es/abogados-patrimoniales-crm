import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, CheckCircle2, HandCoins, Plus, UsersRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useContactos } from '@/features/contactos'
import { OPPORTUNITY_STAGE_LABELS, useOportunidades, type OportunidadResumen } from '@/features/crm'
import {
  useActuacionesRecientes,
  useExpedientesPersistentes,
  type ActuacionPersistida,
  type ExpedientePersistido,
} from '@/features/expedientes'
import { formatCurrency, useFacturas, type FacturaPersistida } from '@/features/facturacion'
import { useOnboardings, type OnboardingPersistido } from '@/features/onboarding'
import { useTareasPersistentes, type TareaPersistida } from '@/features/tareas'
import { isOverdue } from '@/shared/lib/time-status'

const openTask = (status: string) => !['Completada', 'Cancelada'].includes(status)
const PENDING_INVOICE_STATUSES = ['draft', 'cancelled', 'paid']
const UPCOMING_WINDOW_MS = 14 * 86_400_000
type DashboardRoute = '/tareas' | '/oportunidades' | '/expedientes' | '/facturacion' | '/onboarding'

type DashboardData = {
  tasks: TareaPersistida[]
  opportunities: OportunidadResumen[]
  cases: ExpedientePersistido[]
  invoices: FacturaPersistida[]
  onboardings: OnboardingPersistido[]
  activities: ActuacionPersistida[]
}

export function buildDashboardMetrics(
  { tasks, opportunities, cases, invoices, onboardings, activities }: DashboardData,
  now = Date.now(),
) {
  const openTasks = tasks.filter((task) => openTask(task.estado))
  const overdueTasks = openTasks.filter((task) => isOverdue(task.venceEn, now))
  const activeOpportunities = opportunities.filter((item) => !['won', 'lost'].includes(item.fase))
  const activeCases = cases.filter((item) => !item.fechaCierre)
  const pendingInvoices = invoices.filter(
    (item) => !PENDING_INVOICE_STATUSES.includes(item.estado) && item.importePendiente > 0,
  )
  const opportunityIdsWithTask = new Set(
    openTasks.map((task) => task.oportunidadId).filter((id): id is string => Boolean(id)),
  )
  const attentionOpportunities = [...activeOpportunities].sort((first, second) => {
    const scoreDifference =
      opportunityAttentionScore(first, opportunityIdsWithTask) -
      opportunityAttentionScore(second, opportunityIdsWithTask)
    return scoreDifference || dateTimestamp(first.actualizada) - dateTimestamp(second.actualizada)
  })

  return {
    openTasks,
    overdueTasks,
    immediateTasks: [...openTasks]
      .sort((first, second) => compareTasksByAttention(first, second, now))
      .slice(0, 6),
    todayEvents: openTasks.filter(
      (task) => task.tipo === 'Evento' && isSameCalendarDay(task.venceEn, now),
    ),
    upcomingEvents: openTasks.filter(
      (task) =>
        task.tipo === 'Evento' &&
        Boolean(task.venceEn) &&
        dateTimestamp(task.venceEn) >= now &&
        dateTimestamp(task.venceEn) <= now + UPCOMING_WINDOW_MS,
    ),
    criticalDeadlines: openTasks.filter(
      (task) => task.critico || (task.tipo === 'Plazo' && Boolean(task.venceEn)),
    ),
    newLeads: activeOpportunities.filter((item) => item.fase === 'entry'),
    leadsWithoutFollowUp: activeOpportunities.filter(
      (item) => !opportunityIdsWithTask.has(item.id),
    ),
    activeOpportunities,
    attentionOpportunities,
    activeCases,
    preparationQuotes: activeOpportunities.filter((item) => item.fase === 'quote'),
    validationQuotes: activeOpportunities.filter((item) => item.fase === 'validation'),
    sentQuotes: activeOpportunities.filter((item) => item.fase === 'engagement'),
    pendingProformas: onboardings.filter((item) => item.fase === 'proforma'),
    pendingInvoices,
    pendingAmount: pendingInvoices.reduce((total, item) => total + item.importePendiente, 0),
    casesWithOverdueTask: new Set(
      overdueTasks.map((task) => task.expedienteId).filter((id): id is string => Boolean(id)),
    ),
    activeQuoteOpportunities: activeOpportunities.filter((item) =>
      ['quote', 'validation', 'engagement'].includes(item.fase),
    ),
    recentActivities: [...activities].sort(
      (first, second) => dateTimestamp(second.ocurridaEn) - dateTimestamp(first.ocurridaEn),
    ),
  }
}

export function PersistentDashboard() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasksQuery = useTareasPersistentes(firmId)
  const opportunitiesQuery = useOportunidades(firmId)
  const casesQuery = useExpedientesPersistentes(firmId)
  const invoicesQuery = useFacturas(firmId)
  const onboardingsQuery = useOnboardings(firmId)
  const contactsQuery = useContactos(firmId)
  const activitiesQuery = useActuacionesRecientes(firmId)
  const [dashboardTime] = useState(() => Date.now())

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando panel" description="Consultando el despacho activo…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel title="Panel no disponible" description="Necesitas una membresía activa." />
    )

  const queries = [
    tasksQuery,
    opportunitiesQuery,
    casesQuery,
    invoicesQuery,
    onboardingsQuery,
    contactsQuery,
    activitiesQuery,
  ]
  if (queries.some((query) => query.isPending))
    return <PendingPanel title="Cargando panel" description="Consultando datos compartidos…" />
  if (queries.some((query) => query.isError))
    return (
      <PendingPanel title="No se pudo cargar el panel" description="Reintenta en unos instantes." />
    )

  const dashboard = buildDashboardMetrics(
    {
      tasks: tasksQuery.data ?? [],
      opportunities: opportunitiesQuery.data ?? [],
      cases: casesQuery.data ?? [],
      invoices: invoicesQuery.data ?? [],
      onboardings: onboardingsQuery.data ?? [],
      activities: activitiesQuery.data ?? [],
    },
    dashboardTime,
  )
  const relatedRecords = new Map<string, string>([
    ...(casesQuery.data ?? []).map((item): [string, string] => [item.id, item.referencia]),
    ...(opportunitiesQuery.data ?? []).map((item): [string, string] => [item.id, item.referencia]),
  ])
  const contactNames = new Map<string, string>(
    (contactsQuery.data ?? []).map(
      (contact) =>
        [
          contact.id,
          contact.razonSocial || `${contact.nombre} ${contact.apellidos ?? ''}`.trim(),
        ] as [string, string],
    ),
  )

  const summary = dashboardSummary(dashboard)
  const risks = [
    {
      label: 'Tareas vencidas',
      value: dashboard.overdueTasks.length,
      detail: 'Requieren una acción inmediata.',
      to: '/tareas' as const,
    },
    {
      label: 'Fechas críticas',
      value: dashboard.criticalDeadlines.length,
      detail: 'Plazos o hitos que requieren revisión.',
      to: '/tareas' as const,
    },
    {
      label: 'Expedientes en riesgo',
      value: dashboard.casesWithOverdueTask.size,
      detail: 'Tienen al menos una tarea vencida.',
      to: '/expedientes' as const,
    },
  ].filter((risk) => risk.value > 0)

  return (
    <main className="mx-auto max-w-350 space-y-5">
      <SectionHeader
        title="Inicio"
        meta={formatLongDate(dashboardTime)}
        subtitle={summary}
        actions={
          <Link to="/tareas" className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Crear tarea
          </Link>
        }
      />
      <DashboardControl dashboard={dashboard} />
      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardCard
          className="lg:col-span-2"
          title="Prioridades de hoy"
          description="Tareas ordenadas por vencimiento y criticidad."
          empty="No hay tareas abiertas."
          action={<CardAction to="/tareas" label="Ver tareas" />}
        >
          {dashboard.immediateTasks.map((task) => (
            <Link
              key={task.id}
              to="/tareas"
              className="hover:bg-muted/50 focus-visible:ring-ring -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-md border-b px-2 py-3 transition-colors outline-none last:border-0 focus-visible:ring-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{task.titulo}</span>
                <span className="text-muted-foreground block text-xs">
                  {relatedRecords.get(task.expedienteId ?? task.oportunidadId ?? '') ??
                    'Sin vínculo'}{' '}
                  · {formatTaskDueDate(task)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline">{task.tipo}</Badge>
                {isOverdue(task.venceEn, dashboardTime) ? (
                  <Badge variant="destructive">Vencida</Badge>
                ) : task.critico ? (
                  <Badge variant="destructive">Crítica</Badge>
                ) : null}
              </span>
            </Link>
          ))}
        </DashboardCard>
        <DashboardCard
          title="Riesgos operativos"
          description="Aspectos que requieren revisión."
          empty=""
        >
          {risks.length ? (
            risks.map((risk) => (
              <Link
                key={risk.label}
                to={risk.to}
                className="hover:bg-muted/50 focus-visible:ring-ring -mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors outline-none focus-visible:ring-2"
              >
                <span className="bg-destructive/10 text-destructive flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
                  {risk.value}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{risk.label}</span>
                  <span className="text-muted-foreground block text-xs">{risk.detail}</span>
                </span>
                <ArrowRight
                  className="text-muted-foreground ml-auto h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              </Link>
            ))
          ) : (
            <div className="flex items-start gap-3 py-2">
              <CheckCircle2 className="text-success mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="text-muted-foreground text-sm">No hay riesgos operativos detectados.</p>
            </div>
          )}
        </DashboardCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title="Oportunidades que requieren avance"
          description="Primero las que no tienen seguimiento y las que están en fase de presupuesto."
          empty="No hay oportunidades que requieran seguimiento."
          action={<CardAction to="/oportunidades" label="Ver oportunidades" />}
        >
          {dashboard.attentionOpportunities.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              to="/oportunidades/$id"
              params={{ id: item.id }}
              className="hover:bg-muted/50 focus-visible:ring-ring -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-md border-b px-2 py-3 transition-colors outline-none last:border-0 focus-visible:ring-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {item.referencia} · {item.titulo}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {contactNames.get(item.contactoId) ?? 'Contacto no disponible'}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                <Badge variant="secondary">{OPPORTUNITY_STAGE_LABELS[item.fase]}</Badge>
                {!dashboard.leadsWithoutFollowUp.some((lead) => lead.id === item.id) ? null : (
                  <Badge variant="outline">Sin seguimiento</Badge>
                )}
              </span>
            </Link>
          ))}
        </DashboardCard>
        <DashboardCard
          title="Cobros pendientes"
          description="Facturas emitidas con saldo pendiente de cobro."
          empty="No hay cobros pendientes."
          action={<CardAction to="/facturacion" label="Ver facturación" />}
        >
          {dashboard.pendingInvoices.slice(0, 5).map((invoice) => (
            <Link
              key={invoice.id}
              to="/facturacion"
              className="hover:bg-muted/50 focus-visible:ring-ring -mx-2 flex items-center justify-between gap-3 rounded-md border-b px-2 py-3 transition-colors outline-none last:border-0 focus-visible:ring-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{invoice.referencia}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {invoice.cliente}
                </span>
              </span>
              <span className="text-warning-foreground shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(invoice.importePendiente, invoice.moneda)}
              </span>
            </Link>
          ))}
        </DashboardCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard
          title="Actividad reciente"
          description="Últimas actuaciones registradas en los expedientes."
          empty="Todavía no hay actuaciones registradas."
        >
          {dashboard.recentActivities.slice(0, 6).map((activity) => (
            <Link
              key={activity.id}
              to="/expedientes/$id"
              params={{ id: activity.expedienteId }}
              className="hover:bg-muted/50 focus-visible:ring-ring -mx-2 block rounded-md border-b px-2 py-3 transition-colors outline-none last:border-0 focus-visible:ring-2"
            >
              <p className="truncate text-sm font-medium">{activity.titulo}</p>
              <p className="text-muted-foreground text-xs">
                {formatActivityDate(activity.ocurridaEn)} ·{' '}
                {relatedRecords.get(activity.expedienteId) ?? 'Expediente no disponible'}
              </p>
            </Link>
          ))}
        </DashboardCard>
        <DashboardCard
          title="Presupuestos en curso"
          description="Oportunidades que ya han alcanzado la fase de presupuesto."
          empty="No hay presupuestos en curso."
        >
          {dashboard.activeQuoteOpportunities.slice(0, 6).map((item) => (
            <Link
              key={item.id}
              to="/oportunidades/$id"
              params={{ id: item.id }}
              className="hover:bg-muted/50 flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {item.referencia} · {item.titulo}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {contactNames.get(item.contactoId) ?? 'Contacto no disponible'}
                </span>
              </span>
              <Badge variant="secondary">{OPPORTUNITY_STAGE_LABELS[item.fase]}</Badge>
            </Link>
          ))}
        </DashboardCard>
      </div>
    </main>
  )
}

type MetricTone = 'neutro' | 'exito' | 'aviso' | 'riesgo' | 'info'

type ControlMetric = {
  label: string
  value: number
  to: DashboardRoute
  tone: MetricTone
}

function DashboardControl({ dashboard }: { dashboard: ReturnType<typeof buildDashboardMetrics> }) {
  const groups: Array<{ title: string; icon: typeof CalendarDays; metrics: ControlMetric[] }> = [
    {
      title: 'Trabajo diario',
      icon: CalendarDays,
      metrics: [
        {
          label: 'Tareas pendientes',
          value: dashboard.openTasks.length,
          to: '/tareas',
          tone: 'aviso',
        },
        {
          label: 'Tareas vencidas',
          value: dashboard.overdueTasks.length,
          to: '/tareas',
          tone: 'riesgo',
        },
        {
          label: 'Actuaciones de hoy',
          value: dashboard.todayEvents.length,
          to: '/tareas',
          tone: 'info',
        },
        {
          label: 'Próximas citas',
          value: dashboard.upcomingEvents.length,
          to: '/tareas',
          tone: 'neutro',
        },
      ],
    },
    {
      title: 'Captación',
      icon: UsersRound,
      metrics: [
        {
          label: 'Fechas críticas',
          value: dashboard.criticalDeadlines.length,
          to: '/tareas',
          tone: 'riesgo',
        },
        {
          label: 'Leads nuevos',
          value: dashboard.newLeads.length,
          to: '/oportunidades',
          tone: 'info',
        },
        {
          label: 'Sin seguimiento',
          value: dashboard.leadsWithoutFollowUp.length,
          to: '/oportunidades',
          tone: 'aviso',
        },
        {
          label: 'Expedientes activos',
          value: dashboard.activeCases.length,
          to: '/expedientes',
          tone: 'exito',
        },
      ],
    },
    {
      title: 'Onboarding y cobros',
      icon: HandCoins,
      metrics: [
        {
          label: 'Pendientes de elaboración',
          value: dashboard.preparationQuotes.length,
          to: '/oportunidades',
          tone: 'aviso',
        },
        {
          label: 'Pendientes de validación',
          value: dashboard.validationQuotes.length,
          to: '/oportunidades',
          tone: 'riesgo',
        },
        {
          label: 'Enviados sin respuesta',
          value: dashboard.sentQuotes.length,
          to: '/oportunidades',
          tone: 'info',
        },
        {
          label: 'Proformas pendientes',
          value: dashboard.pendingProformas.length,
          to: '/onboarding',
          tone: 'aviso',
        },
        {
          label: 'Expedientes con actuación vencida',
          value: dashboard.casesWithOverdueTask.size,
          to: '/expedientes',
          tone: 'riesgo',
        },
      ],
    },
  ]

  return (
    <section aria-label="Centro de control operativo" className="border-b pb-4">
      <div className="mb-3">
        <h2 className="font-serif text-lg">Resumen</h2>
      </div>
      <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {groups.map((group) => (
          <MetricGroup key={group.title} {...group} />
        ))}
      </div>
    </section>
  )
}

function MetricGroup({
  title,
  icon: Icon,
  metrics,
}: {
  title: string
  icon: typeof CalendarDays
  metrics: ControlMetric[]
}) {
  return (
    <div className="py-4 lg:px-5 lg:first:pl-0 lg:last:pr-0">
      <div className="text-muted-foreground mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
      </div>
      <div className="divide-y" role="list">
        {metrics.map((metric) => (
          <CompactMetric key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  )
}

function CompactMetric({ label, value, tone, to }: ControlMetric) {
  const valueClass = {
    neutro: 'text-foreground',
    exito: 'text-success',
    aviso: 'text-warning-foreground',
    riesgo: 'text-destructive',
    info: 'text-primary',
  }[tone]
  return (
    <Link
      to={to}
      role="listitem"
      className="hover:bg-muted/50 focus-visible:ring-ring group -mx-1 flex min-w-0 items-center gap-2 rounded-sm px-1 py-2 transition-colors outline-none focus-visible:ring-2"
    >
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-medium">
        {label}
      </span>
      <span className={`font-serif text-lg font-semibold tabular-nums ${valueClass}`}>{value}</span>
      <ArrowRight
        className="text-muted-foreground h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      />
      <span className="sr-only">Ver listado de {label}</span>
    </Link>
  )
}

function CardAction({ to, label }: { to: DashboardRoute; label: string }) {
  return (
    <Link
      to={to}
      className="text-primary hover:text-primary/80 focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-xs font-medium outline-none focus-visible:ring-2"
    >
      {label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  )
}

function DashboardCard({
  title,
  description,
  empty,
  children,
  className,
  action,
}: {
  title: string
  description?: string
  empty: string
  children: ReactNode
  className?: string
  action?: ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description ? <p className="text-muted-foreground mt-1 text-xs">{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {hasChildren ? children : <p className="text-muted-foreground text-sm">{empty}</p>}
      </CardContent>
    </Card>
  )
}

function metricHint(value: number, singular: string, plural: string) {
  if (value === 0) return 'Sin incidencias'
  return `${value} ${value === 1 ? singular : plural}`
}

function dashboardSummary(dashboard: ReturnType<typeof buildDashboardMetrics>) {
  if (dashboard.overdueTasks.length > 0)
    return metricHint(dashboard.overdueTasks.length, 'tarea vencida', 'tareas vencidas')
  if (dashboard.criticalDeadlines.length > 0)
    return metricHint(dashboard.criticalDeadlines.length, 'fecha crítica', 'fechas críticas')
  if (dashboard.leadsWithoutFollowUp.length > 0)
    return metricHint(
      dashboard.leadsWithoutFollowUp.length,
      'oportunidad sin seguimiento',
      'oportunidades sin seguimiento',
    )
  return 'Sin incidencias prioritarias'
}

function taskAttentionScore(task: TareaPersistida, now: number) {
  if (isOverdue(task.venceEn, now)) return 0
  if (task.critico) return 1
  if (isSameCalendarDay(task.venceEn, now)) return 2
  if (task.venceEn) return 3
  return 4
}

function compareTasksByAttention(first: TareaPersistida, second: TareaPersistida, now: number) {
  const scoreDifference = taskAttentionScore(first, now) - taskAttentionScore(second, now)
  return scoreDifference || compareByDueDate(first, second)
}

function opportunityAttentionScore(
  opportunity: OportunidadResumen,
  opportunityIdsWithTask: Set<string>,
) {
  if (!opportunityIdsWithTask.has(opportunity.id)) return 0
  if (opportunity.fase === 'validation') return 1
  if (opportunity.fase === 'engagement') return 2
  if (opportunity.fase === 'quote') return 3
  if (opportunity.fase === 'entry') return 4
  return 5
}

function dateTimestamp(value: string | null) {
  const timestamp = value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

function compareByDueDate(first: TareaPersistida, second: TareaPersistida) {
  return dateTimestamp(first.venceEn) - dateTimestamp(second.venceEn)
}

function isSameCalendarDay(value: string | null, now: number) {
  if (!value) return false
  const date = new Date(value)
  const reference = new Date(now)
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  )
}

function formatLongDate(value: number) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function formatTaskDueDate(task: TareaPersistida) {
  if (!task.venceEn) return 'Sin fecha'
  const prefix = task.tipo === 'Plazo' ? 'Límite' : 'Fecha'
  return `${prefix} ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(task.venceEn),
  )}`
}
