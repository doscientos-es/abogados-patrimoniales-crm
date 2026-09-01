import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { SectionHeader } from "@/components/common";
import { AlertPills, PriorityBadge, ToneBadge, TimelineFeed, QuickTaskDialog } from "@/components/crm/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACTIVIDADES,
  EXPEDIENTES,
  OPORTUNIDADES,
  PRESUPUESTOS,
  TAREAS,
  etapaOportunidad,
  faseDePresupuesto,
  fasePresupuesto,
  nombreContacto,
} from "@/data/crm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Panel de inicio — LEX" },
      {
        name: "description",
        content:
          "Panel general del despacho: tareas, actuaciones, oportunidades, presupuestos y expedientes en un vistazo.",
      },
      { property: "og:title", content: "Panel de inicio — LEX" },
      {
        property: "og:description",
        content: "Visión diaria del despacho patrimonial: tareas, citas, presupuestos y expedientes.",
      },
    ],
  }),
  component: InicioPage,
});

function Tarjeta({
  label,
  value,
  hint,
  tono = "neutro",
  to,
  search,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tono?: "neutro" | "exito" | "aviso" | "riesgo" | "info";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search?: any;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <ToneBadge tono={tono}>{value}</ToneBadge>
      </div>
      <p className="mt-3 font-serif text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {hint ?? "Ver listado"}
        <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
    </Link>
  );
}

function InicioPage() {
  const tareasPendientes = TAREAS.filter((t) => t.estado !== "Completada");
  const tareasVencidas = TAREAS.filter((t) => t.vencida);
  const hoy = ACTIVIDADES.filter((a) => a.fecha === "05/08/2026");
  const citas = ACTIVIDADES.filter((a) => a.estado === "Programada" && /cita|reunión/i.test(a.tipo));
  const criticas = EXPEDIENTES.flatMap((e) => e.fechasCriticas);
  const nuevas = OPORTUNIDADES.filter((o) => o.etapa === "nuevo");
  const sinSeguimiento = OPORTUNIDADES.filter((o) => o.alertas.some((a) => /sin (respuesta|actividad|cualificar)/i.test(a)));
  const porElaborar = PRESUPUESTOS.filter((p) => ["solicitado", "asignado", "elaboracion", "pendiente-info", "devuelto"].includes(p.estado));
  const porValidar = PRESUPUESTOS.filter((p) => p.estado === "pendiente-validacion");
  const enviados = PRESUPUESTOS.filter((p) => ["enviado", "pendiente-respuesta", "modificacion"].includes(p.estado));
  const proformas = PRESUPUESTOS.filter((p) => ["proforma-pendiente", "proforma-enviada", "pago-parcial"].includes(p.estado));
  const activos = EXPEDIENTES.filter((e) => !["aftercare"].includes(e.fase));
  const vencidos = EXPEDIENTES.filter((e) => e.alertas.some((a) => /vencid/i.test(a)));

  const actividadReciente = [...OPORTUNIDADES, ...EXPEDIENTES]
    .flatMap((x) => x.historial)
    .slice(-8)
    .reverse();

  return (
    <div className="mx-auto max-w-[1400px]">
      <SectionHeader
        title="Panel de inicio"
        subtitle="Situación del despacho a 5 de agosto de 2026. Todos los datos son de demostración."
        actions={<QuickTaskDialog />}
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Trabajo del día
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta label="Tareas pendientes" value={tareasPendientes.length} tono="aviso" to="/tareas" />
        <Tarjeta label="Tareas vencidas" value={tareasVencidas.length} tono="riesgo" to="/tareas" />
        <Tarjeta label="Actuaciones de hoy" value={hoy.length} tono="info" to="/actuaciones" />
        <Tarjeta label="Próximas citas" value={citas.length} tono="info" to="/calendario" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Captación
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta label="Fechas críticas" value={criticas.length} tono="riesgo" to="/calendario" />
        <Tarjeta label="Leads nuevos" value={nuevas.length} tono="info" to="/oportunidades" search={{ vista: "todas", abrir: "" }} />
        <Tarjeta label="Sin seguimiento" value={sinSeguimiento.length} tono="aviso" to="/oportunidades" search={{ vista: "sin-accion", abrir: "" }} />
        <Tarjeta label="Expedientes activos" value={activos.length} tono="exito" to="/expedientes" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Onboarding y cobros
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tarjeta label="Pendientes de elaboración" value={porElaborar.length} tono="aviso" to="/oportunidades" search={{ vista: "presupuestos", abrir: "" }} />
        <Tarjeta label="Pendientes de validación" value={porValidar.length} tono="aviso" to="/oportunidades" search={{ vista: "validacion", abrir: "" }} />
        <Tarjeta label="Enviados sin respuesta" value={enviados.length} tono="info" to="/oportunidades" search={{ vista: "todas", abrir: "" }} />
        <Tarjeta label="Proformas pendientes" value={proformas.length} tono="aviso" to="/onboarding" />
        <Tarjeta label="Expedientes con actuación vencida" value={vencidos.length} tono="riesgo" to="/expedientes" search={{ filtro: "vencidos" }} />
      </div>


      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tareas y plazos inmediatos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {TAREAS.filter((t) => t.estado !== "Completada")
                .slice(0, 6)
                .map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{t.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.responsable} · {t.relacion?.label ?? "Sin vínculo"} ·{" "}
                        {t.limite ? `Límite ${t.limite}` : "Sin fecha"}
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
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline destacado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {OPORTUNIDADES.filter((o) => !["cerrada", "convertida"].includes(o.etapa))
              .slice(0, 5)
              .map((o) => (
                <Link
                  key={o.id}
                  to="/oportunidades"
                  search={{ vista: "todas", abrir: o.id }}
                  className="block rounded-md border border-border p-3 hover:bg-accent/50"
                >
                  <p className="truncate text-sm font-medium text-foreground">{o.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">{nombreContacto(o.contactoId)}</p>
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
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Actuación reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimelineFeed items={actividadReciente} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Presupuestos en curso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PRESUPUESTOS.filter((p) => !["pagado", "rechazado", "caducado", "cancelado"].includes(p.estado))
              .slice(0, 6)
              .map((p) => (
                <Link
                  key={p.id}
                  to="/presupuestos/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {p.codigo} · {p.titulo}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
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
  );
}
