import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { SectionHeader } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { nombreContacto } from '@/data/crm'
import type { TareaOp } from '@/data/expedientes-model'
import {
  alertasDe,
  diasEnFase,
  fase as faseDef,
  FASES_ACTIVAS,
  HOY,
  parseFecha,
  type OportunidadCRM,
} from '@/data/pipeline'
import { BarList, FunnelChart, ToneBadge } from '@/features/crm'
import { useCrm } from '@/lib/crm-store'
import { useOps } from '@/lib/expedientes-store'

export const Route = createFileRoute('/crm')({
  head: () => ({
    meta: [
      { title: 'Cockpit CRM — LEX' },
      {
        name: 'description',
        content:
          'Panel de control comercial: entradas, citas, presupuestos, alertas, conversión y motivos de pérdida.',
      },
      { property: 'og:title', content: 'Cockpit CRM — LEX' },
      {
        property: 'og:description',
        content: 'Indicadores del embudo comercial del despacho patrimonial.',
      },
    ],
  }),
  component: CrmPage,
})

function Tarjeta({
  label,
  value,
  vista,
  tono = 'neutro',
  detalle,
}: {
  label: string
  value: number
  vista: string
  tono?: 'neutro' | 'info' | 'aviso' | 'riesgo' | 'exito'
  detalle?: string
}) {
  return (
    <Link
      to="/oportunidades"
      search={{ vista, abrir: '' }}
      className="border-border bg-card hover:border-primary/40 hover:bg-accent/40 rounded-lg border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
        <ToneBadge tono={tono}>{value}</ToneBadge>
      </div>
      <p className="text-foreground mt-2 font-serif text-2xl font-semibold">{value}</p>
      {detalle ? <p className="text-muted-foreground mt-1 text-xs">{detalle}</p> : null}
    </Link>
  )
}

function media(nums: number[]) {
  if (!nums.length) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function CrmPage() {
  const oportunidades = useCrm((s) => s.oportunidades)
  const tareas = useCrm((s) => s.tareas)
  const tareasOps = useOps((s) => s.tareas)
  // SIGUIENTE ACCIÓN: tarea real marcada, una por Lead.
  const saPorLead = useMemo(() => {
    const m = new Map<string, TareaOp>()
    for (const t of tareasOps) {
      if (!t.esSiguienteAccion) continue
      if (t.estado === 'Completada' || t.estado === 'Cancelada') continue
      if (t.origen?.tipo === 'Oportunidad') m.set(t.origen.id, t)
    }
    return m
  }, [tareasOps])

  const activas = oportunidades.filter((o) => o.fase !== 'ganada' && o.fase !== 'cerrada')
  const nuevas = oportunidades.filter((o) => o.fase === 'entrada')
  const citas = oportunidades.filter((o) => o.citaCRM.estado === 'Programada')
  const presupuestos = oportunidades.filter((o) =>
    [
      'Solicitado',
      'En elaboración',
      'Pendiente de validación',
      'Requiere modificación',
      'Bloqueado',
    ].includes(o.presupuestoEspejo.estado),
  )
  const sinAccion = activas.filter((o) => !saPorLead.has(o.id))
  const estancadas = activas.filter((o) => diasEnFase(o) >= 14)
  const revisionIgor = activas.filter((o) => o.requiereRevisionIgor)
  const enValidacion = oportunidades.filter((o) => o.fase === 'validacion')
  const ganadas = oportunidades.filter((o) => o.fase === 'ganada')
  const cerradas = oportunidades.filter((o) => o.fase === 'cerrada')

  const conCita = oportunidades.filter((o) => o.citaCRM.estado === 'Celebrada')
  const conPresupuestoEnviado = oportunidades.filter(
    (o) =>
      ['Enviado'].includes(o.presupuestoEspejo.estado) ||
      o.fase === 'contratacion' ||
      o.fase === 'ganada',
  )
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

  const embudo = [
    { etapa: 'Entradas registradas', total: oportunidades.length },
    {
      etapa: 'Cualificadas',
      total: oportunidades.filter((o) => o.cualificacion.apta === true).length,
    },
    { etapa: 'Primera cita celebrada', total: conCita.length },
    { etapa: 'Presupuesto enviado', total: conPresupuestoEnviado.length },
    { etapa: 'En validación', total: enValidacion.length },
    { etapa: 'Aceptados', total: ganadas.length },
  ]

  const origenes = Object.entries(
    oportunidades.reduce<Record<string, number>>((acc, o) => {
      acc[o.origen] = (acc[o.origen] ?? 0) + 1
      return acc
    }, {}),
  ).map(([label, total]) => ({ label, total }))

  const motivos = Object.entries(
    cerradas.reduce<Record<string, number>>((acc, o) => {
      const m = o.cierre?.motivo ?? 'Sin clasificar'
      acc[m] = (acc[m] ?? 0) + 1
      return acc
    }, {}),
  ).map(([label, total]) => ({ label, total }))

  const tiempos = FASES_ACTIVAS.map((f) => ({
    label: f.nombre,
    total: media(oportunidades.filter((o) => o.fase === f.id).map((o) => diasEnFase(o))),
  }))

  const proximas = oportunidades
    .filter((o) => saPorLead.has(o.id))
    .sort((a, b) => {
      const da = parseFecha(saPorLead.get(a.id)!.vencimiento)?.getTime() ?? Infinity
      const db = parseFecha(saPorLead.get(b.id)!.vencimiento)?.getTime() ?? Infinity
      return da - db
    })
    .slice(0, 8)

  const vencidas = (o: OportunidadCRM) => {
    const d = parseFecha(saPorLead.get(o.id)?.vencimiento)
    return d ? d < HOY : false
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Cockpit CRM"
        subtitle="Estado del embudo comercial, alertas operativas e indicadores de conversión."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tarjeta label="Leads activos" value={activas.length} vista="activas" tono="info" />
        <Tarjeta label="Nuevas entradas" value={nuevas.length} vista="todas" tono="info" />
        <Tarjeta label="Primeras citas próximas" value={citas.length} vista="citas" tono="aviso" />
        <Tarjeta
          label="Presupuestos pendientes"
          value={presupuestos.length}
          vista="presupuestos"
          tono="aviso"
        />
        <Tarjeta
          label="Sin próxima acción"
          value={sinAccion.length}
          vista="sin-accion"
          tono="riesgo"
        />
        <Tarjeta
          label="Estancadas (14+ días)"
          value={estancadas.length}
          vista="estancadas"
          tono="riesgo"
        />
        <Tarjeta
          label="Pendientes de revisión interna"
          value={revisionIgor.length}
          vista="igor"
          tono="aviso"
        />
        <Tarjeta
          label="En validación de Igor"
          value={enValidacion.length}
          vista="validacion"
          tono="aviso"
        />
        <Tarjeta
          label="Aceptados del periodo"
          value={ganadas.length}
          vista="ganadas"
          tono="exito"
        />
        <Tarjeta
          label="Cerrados / perdidos"
          value={cerradas.length}
          vista="cerradas"
          tono="neutro"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Embudo comercial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelChart items={embudo} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Indicadores básicos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Conversión comercial</p>
              <p className="font-serif text-2xl font-semibold">
                {pct(ganadas.length, oportunidades.length)} %
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Conversión desde primera cita</p>
              <p className="font-serif text-2xl font-semibold">
                {pct(ganadas.length, conCita.length)} %
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Conversión de presupuestos</p>
              <p className="font-serif text-2xl font-semibold">
                {pct(ganadas.length, conPresupuestoEnviado.length)} %
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Descartes internos</p>
              <p className="font-serif text-2xl font-semibold">
                {cerradas.filter((o) => o.cierre?.tipo === 'Descartada por el despacho').length}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground mb-2 text-xs">Tiempo medio por fase (días)</p>
              <BarList items={tiempos} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Distribución por origen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={origenes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Motivos de cierre sin contratación
            </CardTitle>
          </CardHeader>
          <CardContent>
            {motivos.length ? (
              <BarList items={motivos} />
            ) : (
              <p className="text-muted-foreground text-sm">Todavía no hay cierres registrados.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Próximas acciones comprometidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {proximas.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {saPorLead.get(o.id)!.titulo}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {o.codigo} · {nombreContacto(o.contactoId)} · {faseDef(o.fase).nombre} ·{' '}
                      {saPorLead.get(o.id)!.responsable}
                    </p>
                  </div>
                  <ToneBadge tono={vencidas(o) ? 'riesgo' : 'neutro'}>
                    {saPorLead.get(o.id)!.vencimiento || 'Sin fecha'}
                  </ToneBadge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              Alertas abiertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {activas
                .filter((o) => alertasDe(o).length)
                .slice(0, 10)
                .map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-foreground min-w-0 truncate text-sm">
                      {o.codigo} — {o.titulo}
                    </span>
                    <span className="text-destructive text-xs">{alertasDe(o).join(' · ')}</span>
                  </li>
                ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-xs">
              {tareas.filter((t) => t.estado !== 'Completada' && t.estado !== 'Cancelada').length}{' '}
              tareas abiertas en el despacho.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
