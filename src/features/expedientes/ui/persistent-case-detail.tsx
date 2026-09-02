import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { SectionHeader } from '@/components/common'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  ActuacionPersistida,
  EventoExpediente,
  ExpedientePersistido,
  LineaPersistida,
  ParticipantePersistido,
} from '@/features/expedientes/application/case-types'

export function PersistentCaseDetail({
  expediente: item,
  lineas,
  actuaciones,
  participantes,
  eventos,
  editor,
  relatedForms,
}: {
  expediente: ExpedientePersistido
  lineas: LineaPersistida[]
  actuaciones: ActuacionPersistida[]
  participantes: ParticipantePersistido[]
  eventos: EventoExpediente[]
  editor: ReactNode
  relatedForms: ReactNode
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <Link to="/expedientes" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>
      <SectionHeader
        title={`${item.referencia} · ${item.titulo}`}
        subtitle={`${item.naturaleza} · ${item.area || 'Sin área'}`}
      />
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Fase" value={item.fase} />
          <Summary label="Estado" value={item.estadoGeneral} />
          <Summary label="Situación" value={item.estadoOperativo} />
          <Summary label="Prioridad" value={item.prioridad} />
          <Summary label="Apertura" value={item.fechaApertura} />
          <Summary label="Próxima acción" value={item.proximaAccion || 'Sin definir'} />
          <div className="sm:col-span-2">
            <Summary label="Dónde estamos" value={item.dondeEstamos || 'Sin actualizar'} />
          </div>
        </CardContent>
      </Card>
      {editor}
      {relatedForms}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Líneas de trabajo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lineas.map((line) => (
              <article key={line.id} className="rounded-md border p-3">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{line.titulo}</p>
                  <Badge variant="outline">{line.estado}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {line.descripcion || line.tipo || 'Sin descripción'}
                </p>
              </article>
            ))}
            {!lineas.length ? (
              <p className="text-muted-foreground text-sm">Sin líneas de trabajo.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actuaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actuaciones.map((activity) => (
              <article key={activity.id} className="rounded-md border p-3">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{activity.titulo}</p>
                  <span className="text-muted-foreground text-xs">
                    {new Date(activity.ocurridaEn).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {activity.descripcion || activity.tipo}
                </p>
              </article>
            ))}
            {!actuaciones.length ? (
              <p className="text-muted-foreground text-sm">Sin actuaciones registradas.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {participantes.map((participant) => (
              <article
                key={participant.id}
                className="flex justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{participant.nombre}</p>
                  <p className="text-muted-foreground text-sm">{participant.rol}</p>
                </div>
                <Badge variant="outline">{participant.confidencialidad}</Badge>
              </article>
            ))}
            {!participantes.length ? (
              <p className="text-muted-foreground text-sm">Sin participantes.</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trazabilidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eventos.map((event) => (
              <article key={event.id} className="rounded-md border p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {event.entidad} · {event.accion}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(event.creadoEn).toLocaleString('es-ES')}
                  </span>
                </div>
                {event.campos.length ? (
                  <p className="text-muted-foreground mt-1 text-xs">{event.campos.join(', ')}</p>
                ) : null}
              </article>
            ))}
            {!eventos.length ? <p className="text-muted-foreground text-sm">Sin eventos.</p> : null}
          </CardContent>
        </Card>
      </div>
    </main>
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
