import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, Circle, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PendingBadge } from "@/components/common";
import type { HistorialItem, Prioridad, Tono } from "@/data/crm";

export const toneClass: Record<Tono, string> = {
  neutro: "border-border bg-muted text-muted-foreground",
  exito: "border-success/40 bg-success/10 text-success",
  aviso: "border-warning/50 bg-warning/15 text-warning-foreground",
  riesgo: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-primary/30 bg-primary/10 text-primary",
};

export function ToneBadge({ tono, children }: { tono: Tono; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClass[tono],
      )}
    >
      {children}
    </span>
  );
}

const prioridadTono: Record<Prioridad, Tono> = { Alta: "riesgo", Media: "aviso", Baja: "neutro" };

export function PriorityBadge({ value }: { value: Prioridad }) {
  return <ToneBadge tono={prioridadTono[value]}>{value}</ToneBadge>;
}

export function AlertPills({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-xs text-muted-foreground">Sin alertas</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((a) => (
        <span
          key={a}
          className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="h-3 w-3" />
          {a}
        </span>
      ))}
    </span>
  );
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function EntityHeader({
  eyebrow,
  title,
  meta,
  alerts,
  actions,
  backTo,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  meta: { label: string; value: ReactNode }[];
  alerts?: string[];
  actions?: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backTo?: any;
  backLabel?: string;
}) {
  return (
    <div className="mb-5 rounded-lg border border-border bg-card p-4 sm:p-5">
      {backTo ? (
        <Link to={backTo} className="text-xs text-muted-foreground hover:text-foreground">
          ← {backLabel ?? "Volver"}
        </Link>
      ) : null}
      <div className="mt-1 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-1 font-serif text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {meta.map((m) => (
          <MetaItem key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
      {alerts ? (
        <div className="mt-3">
          <AlertPills items={alerts} />
        </div>
      ) : null}
    </div>
  );
}


export type KanbanColumn<T> = {
  id: string;
  nombre: string;
  tono: Tono;
  items: T[];
};

export function KanbanBoard<T>({
  columns,
  renderCard,
}: {
  columns: KanbanColumn<T>[];
  renderCard: (item: T) => ReactNode;
}) {
  return (
    <div className="-mx-1 overflow-x-auto pb-3">
      <div className="flex min-w-max gap-3 px-1">
        {columns.map((col) => (
          <section key={col.id} className="w-72 shrink-0 rounded-lg border border-border/70 bg-muted/70 p-2">
            <header className="mb-2 flex items-center justify-between gap-2 px-1 py-1">
              <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground">
                {col.nombre}
              </span>
              <ToneBadge tono={col.tono}>{col.items.length}</ToneBadge>
            </header>
            <div className="space-y-2">
              {col.items.length ? (
                col.items.map((item, i) => <div key={i}>{renderCard(item)}</div>)
              ) : (
                <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Sin registros
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}


export function FunnelChart({ items }: { items: { etapa: string; total: number }[] }) {
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <div className="space-y-2">
      {items.map((i, idx) => (
        <div key={i.etapa} className="flex items-center gap-3">
          <span className="w-52 shrink-0 truncate text-sm text-muted-foreground">{i.etapa}</span>
          <div className="h-7 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className="flex h-full items-center justify-end rounded-md bg-primary/85 px-2 text-xs font-semibold text-primary-foreground"
              style={{ width: `${Math.max((i.total / max) * 100, 8)}%` }}
            >
              {i.total}
            </div>
          </div>
          <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
            {idx === 0 ? "—" : `${Math.round((i.total / (items[0]?.total || 1)) * 100)} %`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BarList({ items }: { items: { label: string; total: number }[] }) {
  const max = Math.max(...items.map((i) => i.total), 1);
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-3">
          <span className="w-44 shrink-0 truncate text-sm text-foreground">{i.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-chart-2" style={{ width: `${(i.total / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{i.total}</span>
        </li>
      ))}
    </ul>
  );
}

export function TimelineFeed({ items }: { items: HistorialItem[] }) {
  if (!items.length)
    return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>;
  return (
    <ol className="relative ml-2 border-l border-border pl-6">
      {items.map((it, i) => (
        <li key={i} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[1.9rem] top-1 flex h-3 w-3 items-center justify-center">
            <Circle className="h-3 w-3 fill-primary text-primary" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{it.tipo}</span>
            <span className="text-xs text-muted-foreground">
              {it.fecha} · {it.usuario}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{it.descripcion}</p>
          {it.resultado || it.proxima || it.relacionado ? (
            <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {it.relacionado ? <span>Relacionado: {it.relacionado}</span> : null}
              {it.resultado ? <span>Resultado: {it.resultado}</span> : null}
              {it.proxima ? <span>Próxima actuación: {it.proxima}</span> : null}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function RelationList({
  title,
  items,
  empty = "Sin elementos relacionados.",
}: {
  title: string;
  items: { label: string; sub?: string | undefined; badge?: ReactNode; to?: unknown; params?: unknown }[];
  empty?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="divide-y divide-border">
            {items.map((it, i) => {
              const body = (
                <span className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {it.label}
                    </span>
                    {it.sub ? (
                      <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>
                    ) : null}
                  </span>
                  {it.badge}
                </span>
              );
              return (
                <li key={i}>
                  {it.to ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <Link to={it.to as any} params={it.params as any} className="block hover:bg-accent/60">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ViewSwitch({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function MockDialog({
  trigger,
  title,
  description,
  children,
  confirmLabel = "Guardar",
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  confirmLabel?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        <DialogFooter className="mt-2 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <PendingBadge label="Guardado pendiente de desarrollo" />
          <Button disabled>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuickTaskDialog({ trigger }: { trigger?: ReactNode }) {
  return (
    <MockDialog
      trigger={
        trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Crear tarea
          </Button>
        )
      }
      title="Nueva tarea"
      description="Puede vincularse a un contacto, oportunidad, presupuesto, expediente, documento, comunicación, factura, actividad o evento."
      confirmLabel="Crear tarea"
    >
      <div className="sm:col-span-2">
        <Field label="Título">
          <Input placeholder="Título de la tarea" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Descripción">
          <Textarea rows={3} placeholder="Descripción de la tarea" />
        </Field>
      </div>
      <Field label="Responsable">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ib">Igor Belmonte</SelectItem>
            <SelectItem value="at">Ana Torregrosa</SelectItem>
            <SelectItem value="lf">Luis Ferrán</SelectItem>
            <SelectItem value="ms">Marta Solé</SelectItem>
            <SelectItem value="nc">Nuria Casals</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Colaboradores">
        <Input placeholder="Añadir colaboradores" />
      </Field>
      <Field label="Fecha de inicio">
        <Input placeholder="dd/mm/aaaa" />
      </Field>
      <Field label="Fecha límite">
        <Input placeholder="dd/mm/aaaa" />
      </Field>
      <Field label="Prioridad">
        <Select defaultValue="media">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Estado">
        <Select defaultValue="pendiente">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="curso">En curso</SelectItem>
            <SelectItem value="revision">En revisión</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Elemento relacionado">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Contacto, oportunidad, expediente…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contacto">Contacto</SelectItem>
            <SelectItem value="oportunidad">Oportunidad</SelectItem>
            <SelectItem value="presupuesto">Presupuesto</SelectItem>
            <SelectItem value="expediente">Expediente</SelectItem>
            <SelectItem value="documento">Documento</SelectItem>
            <SelectItem value="comunicacion">Comunicación</SelectItem>
            <SelectItem value="factura">Factura</SelectItem>
            <SelectItem value="actividad">Actividad</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Archivos">
        <Input type="file" disabled />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Lista de comprobación">
          <Textarea rows={2} placeholder="Un punto por línea" />
        </Field>
      </div>
    </MockDialog>
  );
}

export function GoogleCalendarNote() {
  return (
    <p className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <CalendarClock className="h-4 w-4 shrink-0" />
      Preparado para sincronizar con Google Calendar en una fase posterior. Los eventos mostrados son
      ficticios.
    </p>
  );
}
