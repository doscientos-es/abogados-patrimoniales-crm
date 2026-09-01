// SEÑALES DE UNA COMUNICACIÓN.
//
// Sólo se muestra algo cuando queda ALGO CONCRETO por hacer. Si la
// comunicación está gestionada, no se muestra estado alguno: COMUNICACIONES
// no es una cola de trabajo paralela a TAREAS.
import { canalDe } from "@/data/comunicaciones";
import type { Comunicacion, TareaOp } from "@/data/expedientes-model";
import { sinContexto } from "@/components/comunicaciones/contexto";

export type Tono = "neutro" | "info" | "aviso" | "riesgo" | "exito";

export type SenalComunicacion = { id: string; label: string; tono: Tono };

export function senalesComunicacion(c: Comunicacion, tareas: TareaOp[]): SenalComunicacion[] {
  const s: SenalComunicacion[] = [];
  const abiertas = tareas.filter(
    (t) =>
      (c.tareasVinculadas ?? []).includes(t.id) &&
      t.estado !== "Completada" &&
      t.estado !== "Cancelada",
  );
  const especial = abiertas.find((t) => t.id === c.tareaEspecialId);

  if (sinContexto(c)) s.push({ id: "sinVincular", label: "Sin vincular", tono: "aviso" });

  if (especial) {
    s.push({
      id: "especial",
      label: canalDe(c) === "Llamada" ? "Llamada por devolver" : "Tarea de comunicación abierta",
      tono: "riesgo",
    });
  } else if (c.pendienteContestar) {
    s.push({ id: "sinResponder", label: "Sin responder", tono: "riesgo" });
  }

  if ((c.adjuntosRef ?? []).some((a) => !a.documentoId))
    s.push({ id: "adjunto", label: "Adjunto sin guardar", tono: "aviso" });

  const otras = abiertas.filter((t) => t.id !== c.tareaEspecialId);
  if (otras.length)
    s.push({
      id: "tarea",
      label: otras.length === 1 ? "Tarea pendiente" : `${otras.length} tareas pendientes`,
      tono: "info",
    });

  return s;
}

/** Una comunicación está gestionada cuando no queda nada concreto por hacer. */
export const gestionada = (c: Comunicacion, tareas: TareaOp[]) =>
  senalesComunicacion(c, tareas).length === 0;
