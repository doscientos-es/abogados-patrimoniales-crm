import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { SectionHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ACTIVIDADES,
  etapaOportunidad,
  EXPEDIENTES,
  faseDePresupuesto,
  fasePresupuesto,
  nombreContacto,
  OPORTUNIDADES,
  PRESUPUESTOS,
  TAREAS,
} from '@/data/crm'
import { AlertPills, PriorityBadge, QuickTaskDialog, TimelineFeed, ToneBadge } from '@/features/crm'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Panel de inicio — LEX' },
      {
        name: 'description',
        content:
          'Panel general del despacho: tareas, actuaciones, oportunidades, presupuestos y expedientes en un vistazo.',
      },
      { property: 'og:title', content: 'Panel de inicio — LEX' },
      {
        property: 'og:description',
        content:
          'Visión diaria del despacho patrimonial: tareas, citas, presupuestos y expedientes.',
      },
    ],
  }),
  component: InicioPage,
})

function Tarjeta({
  label,
  value,
  tono = 'neutro',
  to,
  search,
}: {
  label: string
  value: number | string
  hint?: string
  tono?: 'neutro' | 'exito' | 'aviso' | 'riesgo' | 'info'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search?: any
}) {
  return (
    <Link
      to={to}
      search={search}
      className="group hover:bg-accent/50 flex min-h-10 items-center gap-3 py-2 transition-colors first:pt-0 last:pb-0"
    >
      <span className="text-foreground min-w-0 text-sm leading-snug">{label}</span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <ToneBadge tono={tono}>{value}</ToneBadge>
        <ArrowRight className="text-muted-foreground h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      <span className="sr-only">Ver listado de {label}</span>
    </Link>
  )
}

function MetricGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-card rounded-lg border px-4 py-3" aria-label={title}>
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h2>
      <div className="divide-border/60 mt-2 divide-y">{children}</div>
    </section>
  )
}

function InicioPage() {
  const tareasPendientes = TAREAS.filter((t) => t.estado !== 'Completada')
  const tareasVencidas = TAREAS.filter((t) => t.vencida)
  const hoy = ACTIVIDADES.filter((a) => a.fecha === '05/08/2026')
  const citas = ACTIVIDADES.filter((a) => a.estado === 'Programada' && /cita|reunión/i.test(a.tipo))
  const criticas = EXPEDIENTES.flatMap((e) => e.fechasCriticas)
  const nuevas = OPORTUNIDADES.filter((o) => o.etapa === 'nuevo')
  const sinSeguimiento = OPORTUNIDADES.filter((o) =>
    o.alertas.some((a) => /sin (respuesta|actividad|cualificar)/i.test(a)),
  )
  const porElaborar = PRESUPUESTOS.filter((p) =>
    ['solicitado', 'asignado', 'elaboracion', 'pendiente-info', 'devuelto'].includes(p.estado),
  )
  const porValidar = PRESUPUESTOS.filter((p) => p.estado === 'pendiente-validacion')
  const enviados = PRESUPUESTOS.filter((p) =>
    ['enviado', 'pendiente-respuesta', 'modificacion'].includes(p.estado),
  )
  const proformas = PRESUPUESTOS.filter((p) =>
    ['proforma-pendiente', 'proforma-enviada', 'pago-parcial'].includes(p.estado),
  )
  const activos = EXPEDIENTES.filter((e) => !['aftercare'].includes(e.fase))
  const vencidos = EXPEDIENTES.filter((e) => e.alertas.some((a) => /vencid/i.test(a)))

  const actividadReciente = [...OPORTUNIDADES, ...EXPEDIENTES]
    .flatMap((x) => x.historial)
    .slice(-8)
    .reverse()

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Panel de inicio"
        subtitle="Visión diaria de prioridades, plazos y oportunidades del despacho."
        actions={<QuickTaskDialog />}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricGroup title="Trabajo del día">
          <Tarjeta
            label="Tareas pendientes"
            value={tareasPendientes.length}
            tono="aviso"
            to="/tareas"
          />
          <Tarjeta
            label="Tareas vencidas"
            value={tareasVencidas.length}
            tono="riesgo"
            to="/tareas"
          />
          <Tarjeta label="Actuaciones de hoy" value={hoy.length} tono="info" to="/actuaciones" />
          <Tarjeta label="Próximas citas" value={citas.length} tono="info" to="/calendario" />
        </MetricGroup>

        <MetricGroup title="Captación">
          <Tarjeta label="Fechas críticas" value={criticas.length} tono="riesgo" to="/calendario" />
          <Tarjeta
            label="Leads nuevos"
            value={nuevas.length}
            tono="info"
            to="/oportunidades"
            search={{ vista: 'todas', abrir: '' }}
          />
          <Tarjeta
            label="Sin seguimiento"
            value={sinSeguimiento.length}
            tono="aviso"
            to="/oportunidades"
            search={{ vista: 'sin-accion', abrir: '' }}
          />
          <Tarjeta
            label="Expedientes activos"
            value={activos.length}
            tono="exito"
            to="/expedientes"
          />
        </MetricGroup>

        <MetricGroup title="Onboarding y cobros">
          <Tarjeta
            label="Pendientes de elaboración"
            value={porElaborar.length}
            tono="aviso"
            to="/oportunidades"
            search={{ vista: 'presupuestos', abrir: '' }}
          />
          <Tarjeta
            label="Pendientes de validación"
            value={porValidar.length}
            tono="aviso"
            to="/oportunidades"
            search={{ vista: 'validacion', abrir: '' }}
          />
          <Tarjeta
            label="Enviados sin respuesta"
            value={enviados.length}
            tono="info"
            to="/oportunidades"
            search={{ vista: 'todas', abrir: '' }}
          />
          <Tarjeta
            label="Proformas pendientes"
            value={proformas.length}
            tono="aviso"
            to="/onboarding"
          />
          <Tarjeta
            label="Expedientes con actuación vencida"
            value={vencidos.length}
            tono="riesgo"
            to="/expedientes"
            search={{ filtro: 'vencidos' }}
          />
        </MetricGroup>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Tareas y plazos inmediatos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-border divide-y">
              {TAREAS.filter((t) => t.estado !== 'Completada')
                .slice(0, 6)
                .map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-medium">{t.titulo}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.responsable} · {t.relacion?.label ?? 'Sin vínculo'} ·{' '}
                        {t.limite ? `Límite ${t.limite}` : 'Sin fecha'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge value={t.prioridad} />
                      {t.vencida ? <ToneBadge tono="riesgo">Vencida</ToneBadge> : null}
                    </div>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Pipeline destacado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {OPORTUNIDADES.filter((o) => !['cerrada', 'convertida'].includes(o.etapa))
              .slice(0, 5)
              .map((o) => (
                <Link
                  key={o.id}
                  to="/oportunidades"
                  search={{ vista: 'todas', abrir: o.id }}
                  className="border-border hover:bg-accent/50 block rounded-md border p-3"
                >
                  <p className="text-foreground truncate text-sm font-medium">{o.titulo}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {nombreContacto(o.contactoId)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ToneBadge tono={etapaOportunidad(o.etapa).tono}>
                      {etapaOportunidad(o.etapa).nombre}
                    </ToneBadge>
                    <AlertPills items={o.alertas} />
                  </div>
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Actuación reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimelineFeed items={actividadReciente} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Presupuestos en curso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PRESUPUESTOS.filter(
              (p) => !['pagado', 'rechazado', 'caducado', 'cancelado'].includes(p.estado),
            )
              .slice(0, 6)
              .map((p) => (
                <Link
                  key={p.id}
                  to="/presupuestos/$id"
                  params={{ id: p.id }}
                  className="border-border hover:bg-accent/50 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="text-foreground block truncate text-sm font-medium">
                      {p.codigo} · {p.titulo}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {nombreContacto(p.contactoId)} · {p.total}
                    </span>
                  </span>
                  <ToneBadge tono={fasePresupuesto(faseDePresupuesto(p)).tono}>
                    {fasePresupuesto(faseDePresupuesto(p)).nombre}
                  </ToneBadge>
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
