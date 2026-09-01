import { useRouterState } from "@tanstack/react-router";

import { CONTACTOS } from "@/data/contactos";
import { getOps } from "@/lib/expedientes-store";
import { getEstado as getCrm } from "@/lib/crm-store";
import type { AmbitoNota, OrigenNota } from "@/data/notas";

export const nombreContacto = (id: string) => {
  const c = CONTACTOS.find((x) => x.id === id);
  if (!c) return id;
  return [c.nombre, c.apellidos].filter(Boolean).join(" ") || c.razonSocial || id;
};

export type ContextoNota = {
  ambito: AmbitoNota;
  origen: OrigenNota;
  contactos: string[];
  expedienteId?: string;
  oportunidadId?: string;
};

/** Contexto por defecto de una nota rápida a partir de la ruta actual. */
export function useContextoNota(): ContextoNota | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const partes = pathname.split("/").filter(Boolean);
  const seccion = partes[0];
  const id = partes[1];
  if (!seccion || !id) return null;

  if (seccion === "contactos" && id !== "nuevo") {
    return {
      ambito: "persona",
      origen: { tipo: "persona", id, etiqueta: nombreContacto(id) },
      contactos: [id],
    };
  }

  if (seccion === "expedientes") {
    const e = getOps().expedientes.find((x) => x.id === id);
    if (!e) return null;
    return {
      ambito: "expediente",
      origen: { tipo: "expediente", id: e.id, etiqueta: `${e.codigo} · ${e.nombre}` },
      contactos: [e.contactoId, ...(e.otrosClientes ?? [])],
      expedienteId: e.id,
    };
  }

  if (seccion === "oportunidades") {
    const o = getCrm().oportunidades.find((x) => x.id === id);
    if (!o) return null;
    return {
      ambito: "oportunidad",
      origen: { tipo: "oportunidad", id: o.id, etiqueta: o.titulo || o.id },
      contactos: o.contactoId ? [o.contactoId] : [],
      oportunidadId: o.id,
    };
  }

  return null;
}

/** Ruta de destino del elemento de procedencia de una nota. */
export function enlaceOrigen(origen: OrigenNota): string {
  switch (origen.tipo) {
    case "persona":
      return `/contactos/${origen.id}`;
    case "expediente":
      return `/expedientes/${origen.id}`;
    case "oportunidad":
      return `/oportunidades/${origen.id}`;
    case "ejecucion":
      return `/ejecuciones`;
    case "presupuesto":
      return `/presupuestos/${origen.id}`;
    default:
      return "/notas";
  }
}
