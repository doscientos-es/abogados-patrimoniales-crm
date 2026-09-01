// Bloque "Resumen IA" de la ficha de expediente.
// Sólo lectura: genera una síntesis del expediente actual y la guarda.
// No altera fases, tareas, actuaciones, plazos ni ningún otro dato operativo.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExpedienteOp, FuenteIA } from "@/data/expedientes-model";
import { generarResumenIA } from "@/lib/resumen-ia.functions";
import { construirContextoIA } from "@/lib/resumen-ia";
import { getOps, ops, useOps } from "@/lib/expedientes-store";
import { getNotas } from "@/lib/notas-store";

const SECCIONES: { clave: string; titulo: string }[] = [
  { clave: "OBJETO:", titulo: "Objeto" },
  { clave: "SITUACIÓN ACTUAL:", titulo: "Situación actual" },
  { clave: "ACTUACIONES RELEVANTES:", titulo: "Actuaciones relevantes" },
  { clave: "PENDIENTE:", titulo: "Pendiente" },
  { clave: "PLAZOS E HITOS:", titulo: "Plazos e hitos" },
  { clave: "ADVERTENCIAS:", titulo: "Advertencias" },
];

function trocear(texto: string) {
  const bloques: { titulo: string; cuerpo: string }[] = [];
  const indices = SECCIONES.map((s) => ({ ...s, pos: texto.indexOf(s.clave) })).filter((s) => s.pos >= 0);
  if (!indices.length) return [{ titulo: "Resumen", cuerpo: texto }];
  indices.sort((a, b) => a.pos - b.pos);
  indices.forEach((s, i) => {
    const fin = i + 1 < indices.length ? indices[i + 1]!.pos : texto.length;
    bloques.push({ titulo: s.titulo, cuerpo: texto.slice(s.pos + s.clave.length, fin).trim() });
  });
  return bloques;
}

function Cuerpo({
  texto,
  fuentes,
  onAbrirFuente,
}: {
  texto: string;
  fuentes: FuenteIA[];
  onAbrirFuente: (f: FuenteIA) => void;
}) {
  const partes = texto.split(/(\[[^\]\n]+\])/g);
  return (
    <>
      {partes.map((p, i) => {
        if (!p.startsWith("[") || !p.endsWith("]")) return <span key={i}>{p}</span>;
        const etiqueta = p.slice(1, -1).trim();
        const fuente = fuentes.find((f) => `${f.tipo} · ${f.label}` === etiqueta)
          ?? fuentes.find((f) => etiqueta.includes(f.label));
        if (!fuente) return <span key={i} className="text-muted-foreground">{p}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onAbrirFuente(fuente)}
            className="mx-0.5 inline-flex items-center rounded border border-border bg-muted/60 px-1 py-px align-baseline text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            title={`Abrir ${fuente.tipo}: ${fuente.label}`}
          >
            {fuente.tipo} · {fuente.label}
          </button>
        );
      })}
    </>
  );
}

export function ResumenIABloque({
  expediente,
  onAbrirPestana,
}: {
  expediente: ExpedienteOp;
  onAbrirPestana: (pestana: string) => void;
}) {
  const resumen = useOps((s) => s.expedientes.find((x) => x.id === expediente.id)?.resumenIA);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [insuficiente, setInsuficiente] = useState(false);
  const [verFuentes, setVerFuentes] = useState(false);

  const contextoActual = useMemo(
    () => construirContextoIA(getOps(), getNotas(), expediente.id),
    // Se recalcula cuando cambia cualquier dato relevante del expediente.
    [expediente],
  );

  const desactualizado = Boolean(resumen && resumen.huella !== contextoActual.huella);

  const generar = async () => {
    setCargando(true);
    setError("");
    setInsuficiente(false);
    try {
      const ctx = construirContextoIA(getOps(), getNotas(), expediente.id);
      if (!ctx.suficiente) {
        setInsuficiente(true);
        return;
      }
      const r = await generarResumenIA({
        data: {
          codigo: expediente.codigo,
          contexto: ctx.contexto,
          etiquetasFuente: ctx.fuentes.map((f) => `${f.tipo} · ${f.label}`),
        },
      });
      if (r.estado === "insuficiente") {
        setInsuficiente(true);
        return;
      }
      ops.guardarResumenIA(expediente.id, { texto: r.texto, fuentes: ctx.fuentes, huella: ctx.huella });
      toast.success("Resumen IA actualizado");
    } catch (err) {
      // El contenido anterior se conserva intacto.
      setError(err instanceof Error ? err.message : "No ha sido posible generar el resumen.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Card className="border-primary/25">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Resumen IA
              <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-primary">
                Generado con IA
              </span>
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {resumen
                ? `Actualizado el ${resumen.fecha} por ${resumen.usuario} · versión ${resumen.version}`
                : "Síntesis construida únicamente con el contenido de este expediente."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {resumen ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setVerFuentes((v) => !v)}>
                  Ver fuentes ({resumen.fuentes.length})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => {
                    void navigator.clipboard?.writeText(resumen.texto);
                    toast.success("Resumen copiado");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </>
            ) : null}
            <Button size="sm" variant={resumen ? "outline" : "default"} className="gap-1.5" onClick={generar} disabled={cargando}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {resumen ? "Actualizar resumen IA" : "Generar resumen IA"}
            </Button>
          </div>
        </div>

        {desactualizado && !cargando ? (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            Existen cambios posteriores a este resumen.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            No ha sido posible generar el resumen. El contenido anterior se conserva. {error}
          </p>
        ) : null}
        {insuficiente ? (
          <p className="mt-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            No existe información suficiente para generar un resumen fiable.
          </p>
        ) : null}

        {cargando ? (
          <p className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analizando el contenido del expediente…
          </p>
        ) : null}

        {resumen ? (
          <div className="mt-3 space-y-3">
            {trocear(resumen.texto).map((b) => (
              <div key={b.titulo}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{b.titulo}</p>
                <div className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-foreground">
                  <Cuerpo
                    texto={b.cuerpo}
                    fuentes={resumen.fuentes}
                    onAbrirFuente={(f) => onAbrirPestana(f.pestana)}
                  />
                </div>
              </div>
            ))}

            {verFuentes ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Fuentes utilizadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resumen.fuentes.map((f) => (
                    <button
                      key={`${f.tipo}-${f.id}`}
                      type="button"
                      onClick={() => onAbrirPestana(f.pestana)}
                      className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {f.tipo} · {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2 border-t border-border/60 pt-2">
              <span className="text-[11px] text-muted-foreground">¿Te resulta útil?</span>
              <Button
                size="sm"
                variant={resumen.valoracion === "util" ? "default" : "ghost"}
                className="h-7 gap-1 px-2"
                onClick={() => ops.valorarResumenIA(expediente.id, "util")}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Útil
              </Button>
              <Button
                size="sm"
                variant={resumen.valoracion === "incorrecto" ? "default" : "ghost"}
                className="h-7 gap-1 px-2"
                onClick={() => ops.valorarResumenIA(expediente.id, "incorrecto")}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Incorrecto
              </Button>
              <span className="ml-auto text-[10px] text-muted-foreground">
                Síntesis orientativa: no sustituye la lectura de los documentos ni el criterio profesional.
              </span>
            </div>
          </div>
        ) : cargando || insuficiente ? null : (
          <p className="mt-3 rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Todavía no se ha generado un resumen IA.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
