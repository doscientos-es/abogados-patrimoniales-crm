// BLOQUE DE TAREA ESPECIAL DE COMUNICACIÓN dentro de la ficha de la tarea.
//
// El encargo es COMUNICAR (contestar un email, responder un WhatsApp o
// devolver una llamada). La comunicación original se consulta aquí mismo, a
// golpe de clic, sin salir a Gmail o WhatsApp para entender el encargo.
// El botón único es CONTESTADO: cierra la tarea con el sistema existente.
import { useState } from "react";
import { CheckCircle2, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/crm/ui";
import type { TareaOp } from "@/data/expedientes-model";
import { ops, useOps } from "@/lib/expedientes-store";
import { NuevaTareaRapidaDialog } from "@/components/tareas/ui";

export function BloqueTareaEspecialComunicacion({
  tarea,
  abierta,
  onCerrada,
}: {
  tarea: TareaOp;
  abierta: boolean;
  onCerrada: () => void;
}) {
  const especial = tarea.especial;
  const comunicacion = useOps((s) =>
    s.comunicaciones.find((c) => c.id === especial?.comunicacionId),
  );
  const [verOriginal, setVerOriginal] = useState(false);
  if (!especial) return null;

  return (
    <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToneBadge tono="info">Tarea especial · Comunicación</ToneBadge>
        {especial.canal ? <ToneBadge tono="neutro">{especial.canal}</ToneBadge> : null}
        {especial.contestadoEn ? (
          <ToneBadge tono="exito">
            Contestado · {especial.contestadoEn}
            {especial.contestadoPor ? ` · ${especial.contestadoPor}` : ""}
          </ToneBadge>
        ) : null}
      </div>

      {comunicacion ? (
        <div className="rounded-md border border-border bg-background p-2.5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground">
            <span className="tabular-nums">
              {comunicacion.fecha} {comunicacion.hora}
            </span>
            <span>·</span>
            <span>{comunicacion.emisor || "—"}</span>
          </p>
          <p className="mt-0.5 font-medium text-foreground">
            {comunicacion.asunto || "(sin asunto)"}
          </p>
          {verOriginal ? (
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">
              {comunicacion.contenido || comunicacion.notasInternas || "Sin contenido registrado."}
            </p>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 h-6 px-0 text-[11px]"
            onClick={() => setVerOriginal((v) => !v)}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            {verOriginal ? "Ocultar comunicación original" : "Ver comunicación original"}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground">Sin comunicación original vinculada.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {abierta ? (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const r = ops.contestarTareaComunicacion(tarea.id);
              if (!r.ok) {
                toast.error("No se puede cerrar todavía", { description: r.motivos.join(" ") });
                return;
              }
              toast.success("Contestado: la tarea de comunicación queda resuelta");
              onCerrada();
            }}
          >
            <CheckCircle2 className="h-4 w-4" /> Contestado
          </Button>
        ) : null}

        <NuevaTareaRapidaDialog
          tituloInicial={
            comunicacion ? `Analizar: ${comunicacion.asunto || "comunicación"}` : "Nueva tarea"
          }
          {...(tarea.expedienteId ? { expedienteId: tarea.expedienteId } : {})}
          contextoLabel="esta comunicación"
          onCreada={(id) => {
            if (especial.comunicacionId) ops.vincularTareaComunicacion(especial.comunicacionId, id);
            toast.success("Tarea creada y vinculada a la comunicación");
          }}
          trigger={
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" /> Crear tarea
            </Button>
          }
        />
      </div>
    </div>
  );
}
