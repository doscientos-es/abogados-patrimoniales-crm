import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleAlert,
  CircleCheck,
  Clock3,
  Euro,
  LineChart,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'

import { PendingPanel, SectionHeader } from '@/components/common'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useExpedientesPersistentes, type ExpedientePersistido } from '@/features/expedientes'
import { formatCurrency, useFacturas, type FacturaPersistida } from '@/features/facturacion'
import { useTareasPersistentes, type TareaPersistida } from '@/features/tareas'
import { isOverdue } from '@/shared/lib/time-status'

type InformesData = {
  cases: ExpedientePersistido[]
  invoices: FacturaPersistida[]
  tasks: TareaPersistida[]
}

type TrendPoint = { label: string; issued: number; collected: number }
type DistributionItem = { label: string; value: number; color: string }

const COLORS = ['#526e9e', '#65a4a6', '#d49354', '#9b799a', '#7c9b65']
const CLOSED_INVOICE_STATUSES = ['draft', 'cancelled']
const openTask = (status: TareaPersistida['estado']) =>
  !['Completada', 'Cancelada'].includes(status)
const asMonthKey = (value: string) => value.slice(0, 7)

export function buildInformesMetrics({ cases, invoices, tasks }: InformesData, now = new Date()) {
  const year = now.getFullYear()
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, now.getMonth() - (5 - index), 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
  const trend: TrendPoint[] = monthKeys.map((key) => {
    const [monthYearText, monthText] = key.split('-')
    const monthYear = Number(monthYearText)
    const month = Number(monthText)
    const label = new Intl.DateTimeFormat('es-ES', { month: 'short' })
      .format(new Date(monthYear, month - 1, 1))
      .replace('.', '')
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      issued: invoices
        .filter(
          (invoice) =>
            !CLOSED_INVOICE_STATUSES.includes(invoice.estado) &&
            asMonthKey(invoice.emision) === key,
        )
        .reduce((total, invoice) => total + invoice.importeTotal, 0),
      collected: invoices
        .flatMap((invoice) => invoice.cobros)
        .filter((payment) => asMonthKey(payment.fecha) === key)
        .reduce((total, payment) => total + payment.importe, 0),
    }
  })
  const activeCases = cases.filter((item) => !item.fechaCierre)
  const openTasks = tasks.filter((item) => openTask(item.estado))
  const overdueTasks = openTasks.filter((item) => isOverdue(item.venceEn, now.getTime()))
  const annualInvoices = invoices.filter(
    (item) => !CLOSED_INVOICE_STATUSES.includes(item.estado) && item.ejercicio === year,
  )
  const byArea = activeCases.reduce<Record<string, number>>((result, item) => {
    const area = item.area.trim() || 'Sin área'
    result[area] = (result[area] ?? 0) + 1
    return result
  }, {})
  const distribution: DistributionItem[] = Object.entries(byArea)
    .map(([label, value], index) => ({
      label,
      value,
      color: COLORS[index % COLORS.length] ?? COLORS[0] ?? '#526e9e',
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 5)
  const issued = annualInvoices.reduce((total, item) => total + item.importeTotal, 0)
  const collected = invoices
    .flatMap((item) => item.cobros)
    .filter((payment) => new Date(payment.fecha).getFullYear() === year)
    .reduce((total, payment) => total + payment.importe, 0)
  const pending = invoices.reduce((total, item) => total + item.importePendiente, 0)
  const completedTasks = tasks.filter((item) => item.estado === 'Completada').length
  const execution = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0

  return {
    year,
    activeCases,
    overdueTasks,
    issued,
    collected,
    pending,
    trend,
    distribution,
    openTasks,
    completedTasks,
    execution,
    overdueInvoices: invoices.filter((item) => item.estado === 'overdue'),
  }
}

export function InformesDashboard() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const casesQuery = useExpedientesPersistentes(firmId)
  const invoicesQuery = useFacturas(firmId)
  const tasksQuery = useTareasPersistentes(firmId)
  const [reportDate] = useState(() => new Date())

  if (session.status === 'loading' || membership.isPending)
    return (
      <PendingPanel title="Cargando informes" description="Preparando la visión del despacho…" />
    )
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel title="Informes no disponibles" description="Necesitas una membresía activa." />
    )
  if ([casesQuery, invoicesQuery, tasksQuery].some((query) => query.isPending))
    return (
      <PendingPanel title="Cargando informes" description="Agrupando los datos del despacho…" />
    )
  if ([casesQuery, invoicesQuery, tasksQuery].some((query) => query.isError))
    return (
      <PendingPanel
        title="No se pudieron cargar los informes"
        description="Reintenta en unos instantes."
      />
    )

  const metrics = buildInformesMetrics(
    {
      cases: casesQuery.data ?? [],
      invoices: invoicesQuery.data ?? [],
      tasks: tasksQuery.data ?? [],
    },
    reportDate,
  )

  return (
    <div className="mx-auto max-w-[1440px] pb-6">
      <SectionHeader
        title="Informes"
        subtitle="Una lectura clara del pulso económico, operativo y de cartera del despacho."
      />

      <section
        className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicadores principales"
      >
        <MetricTile
          icon={Euro}
          label="Facturado este año"
          value={formatCurrency(metrics.issued, 'EUR')}
          note="Importe emitido"
          tone="info"
        />
        <MetricTile
          icon={TrendingUp}
          label="Cobrado este año"
          value={formatCurrency(metrics.collected, 'EUR')}
          note="Cobros registrados"
          tone="success"
        />
        <MetricTile
          icon={BriefcaseBusiness}
          label="Expedientes activos"
          value={metrics.activeCases.length}
          note="Asuntos actualmente abiertos"
          tone="neutral"
        />
        <MetricTile
          icon={CircleAlert}
          label="Requiere atención"
          value={metrics.overdueTasks.length + metrics.overdueInvoices.length}
          note={`${metrics.overdueTasks.length} tareas y ${metrics.overdueInvoices.length} cobros vencidos`}
          tone="danger"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.9fr)]">
        <RevenueChart trend={metrics.trend} pending={metrics.pending} />
        <ExecutionCard
          completed={metrics.completedTasks}
          total={metrics.openTasks.length + metrics.completedTasks}
          execution={metrics.execution}
        />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <PortfolioCard items={metrics.distribution} total={metrics.activeCases.length} />
        <AttentionCard
          overdueTasks={metrics.overdueTasks.length}
          overdueInvoices={metrics.overdueInvoices.length}
          pending={metrics.pending}
        />
      </section>
    </div>
  )
}

function MetricTile({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Euro
  label: string
  value: string | number
  note: string
  tone: 'info' | 'success' | 'neutral' | 'danger'
}) {
  const tones = {
    info: 'text-primary',
    success: 'text-success',
    neutral: 'text-foreground',
    danger: 'text-destructive',
  }
  return (
    <article className="bg-card min-w-0 rounded-xl border p-4 shadow-sm">
      <div className={`mb-4 flex items-center gap-2 text-xs font-medium ${tones[tone]}`}>
        <Icon className="size-4" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="font-serif text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{note}</p>
    </article>
  )
}

function RevenueChart({ trend, pending }: { trend: TrendPoint[]; pending: number }) {
  const hasActivity = trend.some((item) => item.issued > 0 || item.collected > 0)
  const max = Math.max(...trend.flatMap((item) => [item.issued, item.collected]), 1)
  const points = (key: 'issued' | 'collected') =>
    trend
      .map(
        (item, index) =>
          `${(index / Math.max(trend.length - 1, 1)) * 100},${84 - (item[key] / max) * 68}`,
      )
      .join(' ')
  return (
    <section className="bg-card rounded-xl border p-5 shadow-sm" aria-labelledby="ritmo-economico">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ritmo-economico" className="text-sm font-semibold tracking-wide uppercase">
            Ritmo económico
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Facturación emitida frente a cobros de los últimos seis meses.
          </p>
        </div>
        <p className="text-muted-foreground shrink-0 text-xs">
          {pending ? `${formatCurrency(pending, 'EUR')} pendiente` : 'Sin saldos pendientes'}
        </p>
      </header>
      {hasActivity ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-4 text-xs">
            <Legend color="bg-primary" label="Emitido" />
            <Legend color="bg-success" label="Cobrado" />
          </div>
          <div className="from-secondary/55 h-52 bg-linear-to-b to-transparent px-3 py-3">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="h-full w-full overflow-visible"
              aria-label="Evolución económica de seis meses"
            >
              <defs>
                <linearGradient id="income-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity=".24" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`M 0,84 L ${points('issued')} L 100,84 Z`} fill="url(#income-fill)" />
              <polyline
                fill="none"
                points={points('issued')}
                stroke="var(--primary)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
              />
              <polyline
                fill="none"
                points={points('collected')}
                stroke="var(--success)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div className="text-muted-foreground mt-2 grid grid-cols-6 text-center text-[11px] font-medium">
            {trend.map((item) => (
              <span key={item.label}>{item.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={LineChart}
          title="Aún no hay movimiento económico"
          description="Cuando emitas facturas o registres cobros, verás aquí su evolución mensual."
        />
      )}
    </section>
  )
}

function ExecutionCard({
  completed,
  total,
  execution,
}: {
  completed: number
  total: number
  execution: number
}) {
  return (
    <section className="bg-card rounded-xl border p-5 shadow-sm" aria-labelledby="pulso-operativo">
      <header>
        <h2 id="pulso-operativo" className="text-sm font-semibold tracking-wide uppercase">
          Pulso operativo
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Nivel de cierre sobre la actividad registrada.
        </p>
      </header>
      {total ? (
        <div className="flex items-center gap-5">
          <div
            className="relative mt-5 grid size-28 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(var(--success) ${execution * 3.6}deg, var(--secondary) 0deg)`,
            }}
          >
            <div className="bg-background grid size-20 place-items-center rounded-full text-center">
              <strong className="font-serif text-2xl">{execution}%</strong>
              <span className="text-muted-foreground text-[10px]">ejecutado</span>
            </div>
          </div>
          <div className="mt-5">
            <p className="font-serif text-3xl font-semibold tabular-nums">
              {completed}
              <span className="text-muted-foreground text-base"> / {total}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-sm">tareas cerradas en el despacho</p>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={CircleCheck}
          title="Aún no hay actividad registrada"
          description="Al crear y completar tareas, podrás seguir el ritmo de ejecución del despacho."
        />
      )}
      {total ? (
        <div className="bg-muted/55 mt-6 rounded-lg px-3 py-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Siguiente objetivo</span>
            <span className="font-semibold">Convertir actividad en cierre</span>
          </div>
          <div className="bg-secondary mt-2 h-1.5 overflow-hidden rounded-full">
            <div className="bg-success h-full rounded-full" style={{ width: `${execution}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function PortfolioCard({ items, total }: { items: DistributionItem[]; total: number }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <section className="bg-card rounded-xl border p-5 shadow-sm" aria-labelledby="cartera-area">
      <header>
        <h2 id="cartera-area" className="text-sm font-semibold tracking-wide uppercase">
          Cartera por área
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Cómo se reparte el trabajo activo del despacho.
        </p>
      </header>
      <div className="mt-5 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex justify-between gap-3 text-xs">
                <span className="truncate font-medium">{item.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.value} asunto{item.value === 1 ? '' : 's'}
                </span>
              </div>
              <div className="bg-secondary h-2 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={BriefcaseBusiness}
            title="Aún no hay expedientes activos"
            description="La distribución por áreas aparecerá al abrir el primer expediente."
          />
        )}
        <p className="bg-muted/55 text-muted-foreground mt-5 rounded-lg px-3 py-2.5 text-xs">
          <strong className="text-foreground">{total}</strong> expedientes activos en cartera
        </p>
      </div>
    </section>
  )
}

function AttentionCard({
  overdueTasks,
  overdueInvoices,
  pending,
}: {
  overdueTasks: number
  overdueInvoices: number
  pending: number
}) {
  const items = [
    { label: 'Tareas vencidas', value: overdueTasks, href: '/tareas' as const, icon: Clock3 },
    { label: 'Cobros vencidos', value: overdueInvoices, href: '/facturacion' as const, icon: Euro },
  ]
  const hasAttention = overdueTasks > 0 || overdueInvoices > 0 || pending > 0
  return (
    <section className="bg-card rounded-xl border p-5 shadow-sm" aria-labelledby="bandeja-atencion">
      <header>
        <h2 id="bandeja-atencion" className="text-sm font-semibold tracking-wide uppercase">
          Bandeja de atención
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">Señales que conviene resolver primero.</p>
      </header>
      {hasAttention ? (
        <div className="mt-5 space-y-2">
          {items.map(({ label, value, href, icon: Icon }) => (
            <Link
              key={label}
              to={href}
              className="group hover:bg-secondary/80 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors"
            >
              <span className="text-destructive grid size-8 place-items-center">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-muted-foreground text-xs">
                  {value ? 'Revisar y desbloquear' : 'Todo bajo control'}
                </span>
              </span>
              <span className="font-serif text-xl font-semibold tabular-nums">{value}</span>
              <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          ))}
          <div className="bg-warning/10 text-warning-foreground mt-4 rounded-lg px-3 py-2.5 text-xs">
            <strong className="block text-sm">{formatCurrency(pending, 'EUR')} por cobrar</strong>
            <span className="mt-0.5 block opacity-80">
              Importe pendiente de todas las facturas activas.
            </span>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={CircleCheck}
          title="Todo está al día"
          description="No hay tareas vencidas, cobros pendientes ni avisos que requieran atención."
        />
      )}
    </section>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`size-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  )
}
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Euro
  title: string
  description: string
}) {
  return (
    <div
      className="text-muted-foreground flex min-h-40 flex-col items-center justify-center py-6 text-center"
      role="status"
    >
      <Icon className="mb-3 size-5 opacity-60" aria-hidden="true" />
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm">{description}</p>
    </div>
  )
}
