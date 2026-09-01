import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Check, Circle, Construction } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Prioridad } from "@/data/mock";

export function SectionHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 grid gap-4 border-b border-border pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="min-w-0 truncate font-serif text-xl font-semibold uppercase tracking-wide text-foreground sm:text-2xl">
            {title}
          </h1>
          {meta ? (
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

const statTono: Record<string, string> = {
  neutro: "text-foreground",
  info: "text-primary",
  exito: "text-success",
  aviso: "text-warning-foreground",
  riesgo: "text-destructive",
};

/** Indicador numérico homogéneo para todas las pantallas. */
export function StatTile({
  label,
  value,
  hint,
  tono = "neutro",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tono?: "neutro" | "info" | "exito" | "aviso" | "riesgo";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1.5 font-serif text-2xl font-semibold tabular-nums", statTono[tono])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}


export function PendingBadge({ label = "Pendiente de desarrollo" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-warning/60 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-foreground">
      <Construction className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function PendingPanel({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3 flex justify-center">
        <PendingBadge />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  to,
  params,
}: {
  label: string;
  value: string;
  hint?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Link>
  );
}

const prioridadClass: Record<Prioridad, string> = {
  Alta: "bg-destructive/10 text-destructive border-destructive/30",
  Media: "bg-warning/15 text-warning-foreground border-warning/40",
  Baja: "bg-muted text-muted-foreground border-border",
};

export function PriorityBadge({ value }: { value: Prioridad }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        prioridadClass[value],
      )}
    >
      {value}
    </span>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const bloqueado = /bloque/i.test(value);
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        bloqueado
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-secondary text-secondary-foreground",
      )}
    >
      {value}
    </span>
  );
}

export function Timeline({ items }: { items: { fecha: string; hito: string; fase: string }[] }) {
  return (
    <ol className="relative ml-2 border-l border-border pl-6">
      {items.map((it, i) => (
        <li key={i} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[1.9rem] top-1 flex h-3 w-3 items-center justify-center">
            <Circle className="h-3 w-3 fill-primary text-primary" />
          </span>
          <p className="text-sm font-medium text-foreground">{it.hito}</p>
          <p className="text-xs text-muted-foreground">
            {it.fecha} · {it.fase}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function Checklist({ items, done = 0 }: { items: string[]; done?: number }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={item}
          className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5"
        >
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
              i < done ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {i < done ? <Check className="h-3 w-3" /> : null}
          </span>
          <span
            className={cn(
              "text-sm",
              i < done ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function FieldList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 text-sm text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
