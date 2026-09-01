// Regla transversal de UX de LEX: cualquier campo de fecha y/o hora usa un
// selector visual, rápido y sencillo, permitiendo también escritura directa.
import { useState } from "react";
import { CalendarIcon, Clock } from "lucide-react";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseFecha, formatoFecha } from "@/data/pipeline";

const HORAS_RAPIDAS = ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00", "18:00"];

export function SelectorFecha({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const fecha = parseFecha(value) ?? undefined;

  return (
    <div className={cn("flex gap-1.5", className)}>
      <Input
        value={value}
        inputMode="numeric"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Elegir fecha">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            {...(fecha ? { selected: fecha, defaultMonth: fecha } : {})}
            onSelect={(d) => {
              if (d) onChange(formatoFecha(d));
              setAbierto(false);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function SelectorHora({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className={cn("flex gap-1.5", className)}>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Elegir hora">
            <Clock className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="grid grid-cols-2 gap-1">
            {HORAS_RAPIDAS.map((h) => (
              <Button
                key={h}
                type="button"
                size="sm"
                variant={value === h ? "default" : "ghost"}
                className="h-8 text-xs"
                onClick={() => {
                  onChange(h);
                  setAbierto(false);
                }}
              >
                {h}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-1 h-8 w-full text-xs"
            onClick={() => {
              onChange("");
              setAbierto(false);
            }}
          >
            Sin hora
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Campo combinado: elegir día → hora → confirmar. */
export function CampoFechaHora({
  label,
  fecha,
  hora,
  onFecha,
  onHora,
  requerido,
  ayudaHora = "Hora opcional",
}: {
  label: string;
  fecha: string;
  hora?: string;
  onFecha: (v: string) => void;
  onHora?: (v: string) => void;
  requerido?: boolean;
  ayudaHora?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
        {requerido ? " *" : ""}
      </Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectorFecha value={fecha} onChange={onFecha} />
        {onHora ? <SelectorHora value={hora ?? ""} onChange={onHora} /> : null}
      </div>
      {onHora ? <p className="text-[11px] text-muted-foreground">{ayudaHora}</p> : null}
    </div>
  );
}
