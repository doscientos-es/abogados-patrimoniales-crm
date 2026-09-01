// FICHA CENTRAL DE UNA COMUNICACIÓN.
//
// Sustituye al antiguo panel lateral. Es una ficha de CONSULTA y corrección
// puntual: qué ocurrió, con quién, en qué contexto y qué queda por hacer.
// El trabajo pendiente no vive aquí: vive en TAREAS.
import { useMemo, useState } from "react";
import { botonTarea, botonTareaComunicacion } from "@/components/comunicaciones/acciones";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { ToneBadge } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { canalDe } from "@/data/comunicaciones";
import type { Comunicacion } from "@/data/expedientes-model";
import { ops, useOps } from "@/lib/expedientes-store";
import { TareaFicha } from "@/components/tareas/ficha-modal";
import { NuevaTareaRapidaDialog } from "@/components/tareas/ui";
import {
  CamposContexto,
  NuevoEmailDialog,
  NuevoWhatsappDialog,
  TareaEspecialComunicacionDialog,
} from "@/components/comunicaciones/dialogos";
import {
  contextoDe,
  ctxLimpio,
  nombreContactoPorId,
  sinContexto,
  type ContextoComunicacion,
} from "@/components/comunicaciones/contexto";
import { senalesComunicacion } from "@/components/comunicaciones/senales";
import { EtiquetaContexto } from "@/components/comunicaciones/etiqueta-contexto";

export function FichaComunicacion({
  comunicacion,
  onClose,
}: {
  comunicacion: Comunicacion | null;
  onClose: () => void;
}) {
  const documentos = useOps((s) => s.documentos);
  const tareas = useOps((s) => s.tareas);
  const [editandoCtx, setEditandoCtx] = useState(false);
  const [ctx, setCtx] = useState<ContextoComunicacion>({});
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null);

  const vinculadas = useMemo(
    () => tareas.filter((t) => (comunicacion?.tareasVinculadas ?? []).includes(t.id)),
    [tareas, comunicacion],
  );
  const senales = useMemo(
    () => (comunicacion ? senalesComunicacion(comunicacion, tareas) : []),
    [comunicacion, tareas],
  );

  if (!comunicacion) return null;
  const c = comunicacion;
  const canal = canalDe(c);
  const entrada = (c.direccion ?? "Entrada") === "Entrada";
  const especial = vinculadas.find((t) => t.id === c.tareaEspecialId);
  const especialAbierta =
    !!especial && especial.estado !== "Completada" && especial.estado !== "Cancelada";
  /** Sólo tiene sentido responder si la comunicación sigue esperando respuesta. */
  const requiereRespuesta = !!c.pendienteContestar && !especialAbierta;

  const abrirEdicion = () => {
    setCtx(contextoDe(c));
    setEditandoCtx(true);
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base">{c.asunto || "(sin asunto)"}</DialogTitle>
            <DialogDescription>
              {canal} · {c.fecha} {c.hora} · {entrada ? "Entrante" : "Saliente"} ·{" "}
              {entrada ? c.emisor : (c.destinatarios ?? []).join(", ") || "—"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">De</span>
                <span>{c.emisor || "—"}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">Para</span>
                <span>{(c.destinatarios ?? []).join(", ") || "—"}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">Contacto</span>
                <span>{nombreContactoPorId(c.contactoId) || "Sin identificar"}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr]">
                <span className="text-muted-foreground">Buzón</span>
                <span>{c.cuenta || "—"}</span>
              </div>
              <div className="grid grid-cols-[110px_1fr] sm:col-span-2">
                <span className="text-muted-foreground">Contexto</span>
                <span>
                  <EtiquetaContexto c={c} />
                </span>
              </div>
            </div>

            {senales.length ? (
              <div className="flex flex-wrap gap-1.5">
                {senales.map((s) => (
                  <ToneBadge key={s.id} tono={s.tono}>
                    {s.label}
                  </ToneBadge>
                ))}
              </div>
            ) : null}

            <Separator />

            {c.contenido ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.contenido}</p>
            ) : null}
            {c.notasInternas ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">
                  Notas de la llamada
                </p>
                <p className="whitespace-pre-wrap">{c.notasInternas}</p>
              </div>
            ) : null}

            {(c.adjuntosRef ?? []).length ? (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Adjuntos
                </p>
                <ul className="space-y-1.5">
                  {(c.adjuntosRef ?? []).map((a) => {
                    const doc = documentos.find((d) => d.id === a.documentoId);
                    return (
                      <li
                        key={a.nombre}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.nombre}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px]"
                            disabled
                            title="Visor de adjuntos pendiente de integración"
                          >
                            Ver
                          </Button>
                          {doc ? (
                            <Button asChild size="sm" variant="outline" className="h-6 text-[11px]">
                              <Link to="/documentos" search={{ doc: doc.id }}>
                                <FileText className="mr-1 h-3 w-3" /> Ver documento
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[11px]"
                              onClick={() => {
                                const id = ops.guardarAdjuntoEnDocumentos(c.id, a.nombre);
                                if (!id) return;
                                toast.success("Adjunto guardado en DOCUMENTOS", {
                                  description: c.expedienteId
                                    ? "Ubicado en el expediente vinculado."
                                    : "Queda en la bandeja de pendientes de asignación.",
                                });
                              }}
                            >
                              Guardar en documentos
                            </Button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {vinculadas.length ? (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tareas vinculadas
                </p>
                <ul className="space-y-1 text-xs">
                  {vinculadas.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setTareaAbierta(t.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-left hover:bg-muted/50"
                      >
                        <span className="truncate">
                          {t.especial ? "Tarea especial · " : ""}
                          {t.titulo}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          {t.estado} <ExternalLink className="h-3 w-3" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {editandoCtx ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Vincular a
                </p>
                <CamposContexto ctx={ctx} onChange={setCtx} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditandoCtx(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      ops.vincularComunicacion(c.id, ctxLimpio(ctx));
                      setEditandoCtx(false);
                      toast.success("Vinculación actualizada");
                    }}
                  >
                    Guardar vinculación
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
            {requiereRespuesta && canal !== "Llamada" ? (
              canal === "WhatsApp" ? (
                <NuevoWhatsappDialog
                  contexto={contextoDe(c)}
                  trigger={<Button size="sm">Responder</Button>}
                />
              ) : (
                <NuevoEmailDialog
                  contexto={contextoDe(c)}
                  asuntoInicial={
                    c.asunto?.startsWith("RE:") ? c.asunto : `RE: ${c.asunto ?? ""}`
                  }
                  respuestaDe={c.id}
                  trigger={<Button size="sm">Responder</Button>}
                />
              )
            ) : null}




            {!especialAbierta ? (
              <TareaEspecialComunicacionDialog
                comunicacion={c}
                trigger={botonTareaComunicacion}
              />
            ) : (
              <Button size="sm" variant="outline" onClick={() => setTareaAbierta(especial!.id)}>
                Ver tarea vinculada
              </Button>
            )}

            <NuevaTareaRapidaDialog
              tituloInicial={`Analizar: ${c.asunto || "comunicación"}`}
              descripcionInicial={c.contenido || c.notasInternas || ""}
              {...(c.expedienteId ? { expedienteId: c.expedienteId } : {})}
              contextoLabel="esta comunicación"
              onCreada={(tareaId) => {
                ops.vincularTareaComunicacion(c.id, tareaId);
                toast.success("Tarea creada y vinculada a la comunicación");
              }}
              trigger={botonTarea}
            />

            <Button size="sm" variant="outline" onClick={abrirEdicion}>
              {sinContexto(c) ? "Vincular" : "Cambiar vinculación"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TareaFicha tareaId={tareaAbierta} onOpenChange={(v) => !v && setTareaAbierta(null)} />
    </>
  );
}
