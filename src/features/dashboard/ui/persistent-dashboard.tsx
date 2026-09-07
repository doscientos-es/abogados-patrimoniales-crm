import { Link } from '@tanstack/react-router'

import { PendingPanel, SectionHeader, StatTile } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { OPPORTUNITY_STAGE_LABELS, useOportunidades } from '@/features/crm'
import { useExpedientesPersistentes } from '@/features/expedientes'
import { formatCurrency, useFacturas } from '@/features/facturacion'
import { useTareasPersistentes } from '@/features/tareas'
import { isOverdue } from '@/shared/lib/time-status'

const openTask = (status: string) => !['Completada', 'Cancelada'].includes(status)

export function PersistentDashboard() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const tasksQuery = useTareasPersistentes(firmId)
  const opportunitiesQuery = useOportunidades(firmId)
  const casesQuery = useExpedientesPersistentes(firmId)
  const invoicesQuery = useFacturas(firmId)

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando panel" description="Consultando el despacho activo…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel title="Panel no disponible" description="Necesitas una membresía activa." />
    )

  const queries = [tasksQuery, opportunitiesQuery, casesQuery, invoicesQuery]
  if (queries.some((query) => query.isPending))
    return <PendingPanel title="Cargando panel" description="Consultando datos compartidos…" />
  if (queries.some((query) => query.isError))
    return (
      <PendingPanel title="No se pudo cargar el panel" description="Reintenta en unos instantes." />
    )

  const tasks = tasksQuery.data ?? []
  const opportunities = opportunitiesQuery.data ?? []
  const cases = casesQuery.data ?? []
  const invoices = invoicesQuery.data ?? []
  const pendingTasks = tasks.filter((task) => openTask(task.estado))
  const urgentTasks = pendingTasks
    .filter((task) => task.critico || isOverdue(task.venceEn))
    .sort((a, b) => (a.venceEn ?? '9999').localeCompare(b.venceEn ?? '9999'))
  const activeOpportunities = opportunities.filter((item) => !['won', 'lost'].includes(item.fase))
  const activeCases = cases.filter((item) => !item.fechaCierre)
  const pendingAmount = invoices
    .filter((item) => !['draft', 'cancelled', 'paid'].includes(item.estadoCodigo))
    .reduce((total, item) => total + item.importePendiente, 0)

  return (
    <main className="mx-auto max-w-[1400px] space-y-6">
      <SectionHeader
        title="Panel de inicio"
        subtitle="Datos actuales del despacho, obtenidos de la base de datos."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tareas abiertas" value={pendingTasks.length} tono="aviso" />
        <StatTile label="Leads activos" value={activeOpportunities.length} tono="info" />
        <StatTile label="Expedientes activos" value={activeCases.length} tono="exito" />
        <StatTile
          label="Pendiente de cobro"
          value={formatCurrency(pendingAmount, 'EUR')}
          tono={pendingAmount ? 'aviso' : 'neutro'}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard title="Trabajo urgente" empty="No hay tareas críticas ni vencidas.">
          {urgentTasks.slice(0, 6).map((task) => (
            <Link
              key={task.id}
              to="/tareas"
              className="flex justify-between gap-3 border-b py-3 last:border-0"
            >
              <span className="min-w-0 truncate text-sm font-medium">{task.titulo}</span>
              <Badge variant={isOverdue(task.venceEn) ? 'destructive' : 'secondary'}>
                {task.venceEn ? new Date(task.venceEn).toLocaleDateString('es-ES') : 'Crítica'}
              </Badge>
            </Link>
          ))}
        </DashboardCard>
        <DashboardCard title="Pipeline reciente" empty="No hay Leads activos.">
          {activeOpportunities.slice(0, 6).map((item) => (
            <Link
              key={item.id}
              to="/oportunidades/$id"
              params={{ id: item.id }}
              className="block border-b py-3 last:border-0"
            >
              <p className="truncate text-sm font-medium">
                {item.referencia} · {item.titulo}
              </p>
              <p className="text-muted-foreground text-xs">
                {OPPORTUNITY_STAGE_LABELS[item.fase]} · actualizado{' '}
                {new Date(item.actualizada).toLocaleDateString('es-ES')}
              </p>
            </Link>
          ))}
        </DashboardCard>
        <DashboardCard title="Expedientes recientes" empty="No hay expedientes activos.">
          {activeCases.slice(0, 6).map((item) => (
            <Link
              key={item.id}
              to="/expedientes/$id"
              params={{ id: item.id }}
              className="block border-b py-3 last:border-0"
            >
              <p className="truncate text-sm font-medium">
                {item.referencia} · {item.titulo}
              </p>
              <p className="text-muted-foreground text-xs">
                {item.fase} · {item.proximaAccion || 'Sin próxima acción'}
              </p>
            </Link>
          ))}
        </DashboardCard>
      </div>
    </main>
  )
}

function DashboardCard({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasChildren ? children : <p className="text-muted-foreground text-sm">{empty}</p>}
      </CardContent>
    </Card>
  )
}
