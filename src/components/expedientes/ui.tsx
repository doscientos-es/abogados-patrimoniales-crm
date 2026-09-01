// Componentes compartidos del núcleo operativo: kanban con arrastre,
// distintivos de tipología documental y utilidades de presentación.
import { useState, type ReactNode } from "react";
import { Gavel, FileCheck2, ShieldAlert, Clock } from "lucide-react";

import { ToneBadge } from "@/components/crm/ui";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ColumnaKanban } from "@/data/expedientes-model";

export function DndKanban<T>({
  columns,
  items,
  columnOf,
  idOf,
  onDrop,
  renderCard,
  vacio = "Sin elementos",
}: {
  columns: ColumnaKanban[];
  items: T[];
  columnOf: (item: T) => string;
  idOf: (item: T) => string;
  onDrop: (id: string, columna: string) => void;
  renderCard: (item: T) => ReactNode;
  vacio?: string;
}) {
  const [sobre, setSobre] = useState<string | null>(null);

  return (
    <div className="-mx-1 overflow-x-auto pb-3">
      <div className="flex flex-col gap-3 px-1 md:min-w-max md:flex-row">
        {columns.map((c) => {
          const lista = items.filter((i) => columnOf(i) === c.id);
          return (
            <section
              key={c.id}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(c.id);
              }}
              onDragLeave={() => setSobre((s) => (s === c.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDrop(id, c.id);
              }}
              className={cn(
                "shrink-0 rounded-lg border border-border/70 bg-muted/70 p-2 transition-colors md:w-72",
                sobre === c.id && "bg-primary/10 ring-1 ring-primary/40",
              )}
            >
              <header className="mb-2 flex items-center justify-between gap-2 px-1 py-1">
                <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground">
                  {c.nombre}
                </span>
                <ToneBadge tono={c.tono}>{lista.length}</ToneBadge>
              </header>
              <div className="space-y-2">
                {lista.length ? (
                  lista.map((i) => (
                    <div
                      key={idOf(i)}
                      draggable
                      className="cursor-grab transition-shadow active:cursor-grabbing active:shadow-lg"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", idOf(i));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      {renderCard(i)}
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    {vacio}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}


export function TipoDocBadges({
  judicial,
  entregable,
  plazo,
}: {
  judicial?: boolean;
  entregable?: boolean;
  plazo?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {judicial ? (
        <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          <Gavel className="h-3 w-3" /> Judicial
        </span>
      ) : null}
      {entregable ? (
        <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
          <FileCheck2 className="h-3 w-3" /> Entregable
        </span>
      ) : null}
      {plazo === "Posible plazo pendiente de validar" ? (
        <span className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
          <ShieldAlert className="h-3 w-3" /> Plazo sin validar
        </span>
      ) : null}
      {plazo === "Plazo validado" ? (
        <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-3 w-3" /> Plazo validado
        </span>
      ) : null}
    </div>
  );
}

export function DatoLinea({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

export function Bloque({
  titulo,
  acciones,
  children,
}: {
  titulo: string;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {acciones}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
      {texto}
    </p>
  );
}

export const euros = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
