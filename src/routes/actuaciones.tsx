import { Link, createFileRoute } from '@tanstack/react-router'

import { PendingPanel, SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveMembership, useAuthSession } from '@/features/auth'
import { useMiembrosDespacho } from '@/features/crm'
import { useActuacionesDespacho, useExpedientesPersistentes } from '@/features/expedientes'

export const Route = createFileRoute('/actuaciones')({ component: ActuacionesPage })

function ActuacionesPage() {
  const auth = useAuthSession()
  const membership = useActiveMembership(auth.user?.id)
  const firmId = membership.data?.firmId
  const activities = useActuacionesDespacho(firmId)
  const cases = useExpedientesPersistentes(firmId)
  const members = useMiembrosDespacho(firmId)

  if (auth.status === 'loading' || membership.isPending)
    return (
      <PendingPanel
        title="Cargando actuaciones"
        description="Consultando la actividad del despacho…"
      />
    )
  if (auth.status !== 'signed-in' || !firmId)
    return (
      <PendingPanel
        title="Actuaciones no disponibles"
        description="Necesitas una membresía activa."
      />
    )
  if (activities.isPending || cases.isPending || members.isPending)
    return <PendingPanel title="Cargando actuaciones" description="Leyendo registros guardados…" />
  if (activities.isError || cases.isError || members.isError)
    return (
      <PendingPanel
        title="No se pudieron cargar las actuaciones"
        description="Reintenta en unos instantes."
      />
    )

  const caseNames = new Map((cases.data ?? []).map((item) => [item.id, item]))
  const memberNames = new Map((members.data ?? []).map((item) => [item.id, item.nombre]))

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <SectionHeader
        title="Actuaciones"
        subtitle="Registro cronológico de la actividad profesional de todos los expedientes del despacho."
      />
      {!activities.data?.length ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Todavía no hay actuaciones registradas.
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {activities.data.map((activity) => {
            const caseItem = caseNames.get(activity.expedienteId)
            return (
              <li key={activity.id}>
                <Card>
                  <CardContent className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{activity.titulo}</h2>
                        <Badge variant="outline">{activity.estado}</Badge>
                        <Badge variant="secondary">{activity.tipo}</Badge>
                      </div>
                      {activity.descripcion ? (
                        <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
                          {activity.descripcion}
                        </p>
                      ) : null}
                      {activity.resultado ? (
                        <p className="mt-2 text-sm">
                          <strong>Resultado:</strong> {activity.resultado}
                        </p>
                      ) : null}
                      {activity.proximaAccion ? (
                        <p className="mt-1 text-sm">
                          <strong>Siguiente acción:</strong> {activity.proximaAccion}
                        </p>
                      ) : null}
                      <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span>
                          {new Intl.DateTimeFormat('es-ES', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(activity.ocurridaEn))}
                        </span>
                        <span>
                          {memberNames.get(activity.asignadoId ?? '') ?? 'Sin responsable'}
                        </span>
                        {activity.horas > 0 ? <span>{activity.horas} h</span> : null}
                        {activity.facturable ? <span>Facturable</span> : null}
                      </div>
                    </div>
                    {caseItem ? (
                      <Link
                        to="/expedientes/$id"
                        params={{ id: caseItem.id }}
                        className="text-primary text-sm hover:underline"
                      >
                        {caseItem.referencia} · {caseItem.titulo}
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}
