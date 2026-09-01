import { createContext, useContext, type ReactNode } from "react";
import { AlertTriangle, Star } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type Naturaleza,
  type RelacionDespacho,
  type Satisfaccion,
} from "@/data/contactos";

/** Modo edición global de la ficha. */
export const FichaEditContext = createContext(false);
export const useFichaEdit = () => useContext(FichaEditContext);

const relacionClass: Record<RelacionDespacho, string> = {
  Cliente: "border-primary/40 bg-primary/10 text-primary",
  Lead: "border-warning/50 bg-warning/15 text-warning-foreground",
  "Profesional / colaborador": "border-success/40 bg-success/10 text-success",
  Tercero: "border-border bg-muted text-muted-foreground",
  Contraparte: "border-destructive/40 bg-destructive/10 text-destructive",
  Proveedor: "border-border bg-secondary text-secondary-foreground",
};

/** Relación con el despacho: única y excluyente. */
export function RelacionBadge({ value }: { value: RelacionDespacho }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        relacionClass[value] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

/** Naturaleza: qué es el contacto en sí mismo. */
export function NaturalezaBadge({ value }: { value: Naturaleza }) {
  return (
    <span className="inline-flex rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
      {value}
    </span>
  );
}


const estadoClass: Record<string, string> = {
  Activo: "border-success/40 bg-success/10 text-success",
  Inactivo: "border-border bg-muted text-muted-foreground",
  Archivado: "border-border bg-secondary text-secondary-foreground",
};

export function EstadoBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        estadoClass[value] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

const docTone = (estado: string) => {
  if (/vigent|firmad|complet/i.test(estado)) return "border-success/40 bg-success/10 text-success";
  if (/próxim|pendient/i.test(estado)) return "border-warning/50 bg-warning/15 text-warning-foreground";
  if (/caducad|revocad/i.test(estado)) return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
};

export function DocStatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", docTone(value))}
    >
      {value}
    </span>
  );
}

const NIVELES: Satisfaccion[] = ["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"];

export function SatisfactionMeter({
  value,
  showLabel = true,
}: {
  value: Satisfaccion;
  showLabel?: boolean;
}) {
  const idx = NIVELES.indexOf(value);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex gap-0.5" aria-label={`Nivel de satisfacción: ${value}`}>
        {NIVELES.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-4 rounded-full",
              i <= idx ? "bg-primary" : "bg-muted-foreground/20",
            )}
          />
        ))}
      </span>
      {showLabel ? <span className="text-xs text-muted-foreground">{value}</span> : null}
    </span>
  );
}

export function Field({
  label,
  value,
  wide,
  editable = true,
}: {
  label: string;
  value?: ReactNode;
  wide?: boolean;
  /** Cuando es false el campo nunca se convierte en editable. */
  editable?: boolean;
}) {
  const editing = useFichaEdit();
  const editableValue = typeof value === "string" || value === undefined;

  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {editing && editable && editableValue ? (
        <Input className="mt-1" defaultValue={value ?? ""} aria-label={label} />
      ) : (
        <div className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
          {value === undefined || value === "" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            value
          )}
        </div>
      )}
    </div>
  );
}

/** Nota interna con aspecto de post-it, común a todo el sistema. */
export function Postit({
  titulo,
  contenido,
  meta,
  destacada,
  className,
  children,
}: {
  titulo?: ReactNode;
  contenido?: ReactNode;
  meta?: ReactNode;
  destacada?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-xs -rotate-1 rounded-sm border border-postit-border bg-postit p-4 text-postit-foreground shadow-md transition-transform hover:rotate-0",
        className,
      )}
    >
      {titulo ? (
        <div className="flex items-start gap-1.5">
          {destacada ? <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-current" /> : null}
          <p className="font-serif text-base font-semibold leading-snug">{titulo}</p>
        </div>
      ) : null}
      {contenido ? <p className="mt-2 text-sm leading-relaxed">{contenido}</p> : null}
      {children}
      {meta ? <p className="mt-3 text-xs text-postit-foreground/70">{meta}</p> : null}
    </div>
  );
}


export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function InlineWarning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function FuturePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Pendiente de desarrollo
      </p>
    </div>
  );
}

export function maskIban(iban: string) {
  if (!iban) return "";
  const tail = iban.replace(/\s/g, "").slice(-4);
  return `ES** **** **** **** **** ${tail}`;
}
