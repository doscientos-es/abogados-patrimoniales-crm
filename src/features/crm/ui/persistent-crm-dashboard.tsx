import { Link } from '@tanstack/react-router'

import { PendingPanel, SectionHeader, StatTile } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useOportunidades } from '@/features/crm'
import { useTareasPersistentes } from '@/features/tareas'

import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES } from '../application'

const STALLED_BEFORE = Date.now() - 14 * 86_400_000

export function PersistentCrmDashboard() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const opportunitiesQuery = useOportunidades(firmId)
  const tasksQuery = useTareasPersistentes(firmId)

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando CRM" description="Consultando el despacho activo…" />
  if (session.status !== 'signed-in' || !firmId)
    return <PendingPanel title="CRM no disponible" description="Necesitas una membresía activa." />
  if (opportunitiesQuery.isPending || tasksQuery.isPending)
    return <PendingPanel title="Cargando CRM" description="Consultando Leads y tareas…" />
  if (opportunitiesQuery.isError || tasksQuery.isError)
    return (
      <PendingPanel title="No se pudo cargar el CRM" description="Reintenta en unos instantes." />
    )

  const opportunities = opportunitiesQuery.data ?? []
  const openTasks = (tasksQuery.data ?? []).filter(
    (task) => !['Completada', 'Cancelada'].includes(task.estado),
  )
  const opportunitiesWithTask = new Set(openTasks.map((task) => task.oportunidadId).filter(Boolean))
  const active = opportunities.filter((item) => !['won', 'lost'].includes(item.fase))
  const withoutAction = active.filter((item) => !opportunitiesWithTask.has(item.id))
  const stalled = active.filter((item) => new Date(item.actualizada).getTime() <= STALLED_BEFORE)
  const won = opportunities.filter((item) => item.fase === 'won')
  const conversion = opportunities.length
    ? Math.round((won.length / opportunities.length) * 100)
    : 0
  const sources = Object.entries(
    opportunities.reduce<Record<string, number>>((totals, item) => {
      const source = item.origen.trim() || 'Sin origen'
      totals[source] = (totals[source] ?? 0) + 1
      return totals
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <main className="mx-auto max-w-[1400px] space-y-6">
      <SectionHeader
        title="Cockpit CRM"
        subtitle="Indicadores calculados sobre Leads y tareas persistentes."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Leads activos" value={active.length} tono="info" />
        <StatTile
          label="Sin próxima acción"
          value={withoutAction.length}
          tono={withoutAction.length ? 'riesgo' : 'neutro'}
        />
        <StatTile
          label="Estancados 14+ días"
          value={stalled.length}
          tono={stalled.length ? 'aviso' : 'neutro'}
        />
        <StatTile label="Aceptados" value={won.length} tono="exito" />
        <StatTile label="Conversión total" value={`${conversion} %`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Embudo comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {OPPORTUNITY_STAGES.map((stage) => (
              <div
                key={stage}
                className="flex items-center justify-between border-b py-2 last:border-0"
              >
                <span className="text-sm">{OPPORTUNITY_STAGE_LABELS[stage]}</span>
                <span className="font-semibold tabular-nums">
                  {opportunities.filter((item) => item.fase === stage).length}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución por origen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sources.map(([source, count]) => (
              <div key={source} className="flex justify-between border-b py-2 last:border-0">
                <span className="text-sm">{source}</span>
                <span className="font-semibold tabular-nums">{count}</span>
              </div>
            ))}
            {!sources.length ? (
              <p className="text-muted-foreground text-sm">Todavía no hay Leads.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {withoutAction.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads sin próxima acción</CardTitle>
          </CardHeader>
          <CardContent>
            {withoutAction.slice(0, 10).map((item) => (
              <Link
                key={item.id}
                to="/oportunidades/$id"
                params={{ id: item.id }}
                className="block border-b py-3 text-sm last:border-0 hover:underline"
              >
                {item.referencia} · {item.titulo}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </main>
  )
}
