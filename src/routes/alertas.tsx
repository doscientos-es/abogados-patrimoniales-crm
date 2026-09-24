import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { PendingPanel, SectionHeader, StatTile } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useActuacionesDespacho, useExpedientesPersistentes } from '@/features/expedientes'
import { buildGlobalCaseAlerts } from '@/features/expedientes/application/global-alerts'
import { useTareasPersistentes } from '@/features/tareas'

export const Route = createFileRoute('/alertas')({ component: AlertasPage })

function AlertasPage() {
  const session = useAuthSession()
  const membership = useActiveMembership(session.user?.id)
  const firmId = membership.data?.firmId
  const cases = useExpedientesPersistentes(firmId)
  const tasks = useTareasPersistentes(firmId)
  const activities = useActuacionesDespacho(firmId)
  const [level, setLevel] = useState<'all' | 'critical' | 'warning'>('all')
  const allAlerts = useMemo(
    () => buildGlobalCaseAlerts(cases.data ?? [], tasks.data ?? [], activities.data ?? []),
    [activities.data, cases.data, tasks.data],
  )

  if (session.status === 'loading' || membership.isPending)
    return <PendingPanel title="Cargando alertas" description="Consultando el despacho…" />
  if (session.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel title="Alertas no disponibles" description="Necesitas una membresía activa." />
    )
  if (cases.isPending || tasks.isPending || activities.isPending)
    return <PendingPanel title="Cargando alertas" description="Revisando tareas y expedientes…" />
  if (cases.isError || tasks.isError || activities.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar las alertas"
        description="Reintenta en unos instantes."
      />
    )

  const alerts = allAlerts.filter((item) => level === 'all' || item.level === level)
  const affectedCases = new Set(allAlerts.map((item) => item.caseId)).size
  const criticalCount = allAlerts.filter((item) => item.level === 'critical').length

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <SectionHeader
        title="Alertas y control"
        subtitle="Señales del trabajo guardado que requieren revisión profesional. Las alertas no validan plazos ni sustituyen el criterio del equipo."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Alertas activas" value={allAlerts.length} />
        <StatTile label="Críticas" value={criticalCount} tono="riesgo" />
        <StatTile label="Expedientes afectados" value={affectedCases} />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar alertas">
        {(
          [
            ['all', 'Todas'],
            ['critical', 'Críticas'],
            ['warning', 'Avisos'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={level === value ? 'secondary' : 'ghost'}
            aria-pressed={level === value}
            onClick={() => setLevel(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {alerts.length ? (
        <div className="space-y-4">
          {Array.from(new Set(alerts.map((item) => item.caseId))).map((caseId) => {
            const caseAlerts = alerts.filter((item) => item.caseId === caseId)
            const first = caseAlerts[0]
            if (!first) return null
            return (
              <Card key={caseId}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{first.caseTitle}</h2>
                      <p className="text-muted-foreground text-xs">{first.caseReference}</p>
                    </div>
                    <Link
                      to="/expedientes/$id"
                      params={{ id: caseId }}
                      className="text-primary text-sm hover:underline"
                    >
                      Abrir expediente
                    </Link>
                  </div>
                  <ul className="divide-y">
                    {caseAlerts.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-2 py-2.5 text-sm"
                      >
                        <Badge variant={item.level === 'critical' ? 'destructive' : 'secondary'}>
                          {item.level === 'critical' ? 'Crítica' : 'Aviso'}
                        </Badge>
                        <span>{item.message}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No hay alertas{' '}
            {level === 'all' ? 'activas' : level === 'critical' ? 'críticas' : 'de aviso'}.
          </CardContent>
        </Card>
      )}
    </main>
  )
}
