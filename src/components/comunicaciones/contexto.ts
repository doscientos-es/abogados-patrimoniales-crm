// Contexto de una comunicación. Se comparte entre la cronología y los
// diálogos de creación: la comunicación se registra UNA sola vez con el
// contexto que corresponda y se muestra en todas las vistas afectadas.
import { CONTACTOS, nombreCompleto } from "@/data/contactos";
import type { Comunicacion } from "@/data/expedientes-model";

export type ContextoComunicacion = {
  contactoId?: string | undefined;
  leadId?: string | undefined;
  onboardingId?: string | undefined;
  expedienteId?: string | undefined;
  /** Vinculación excepcional a más de un expediente. */
  expedientesRelacionados?: string[] | undefined;
};

export const contextoDe = (c: Comunicacion): ContextoComunicacion => ({
  ...(c.contactoId ? { contactoId: c.contactoId } : {}),
  ...(c.leadId ? { leadId: c.leadId } : {}),
  ...(c.onboardingId ? { onboardingId: c.onboardingId } : {}),
  ...(c.expedienteId ? { expedienteId: c.expedienteId } : {}),
  ...(c.expedientesRelacionados?.length
    ? { expedientesRelacionados: c.expedientesRelacionados }
    : {}),
});

export const sinContexto = (c: Comunicacion) =>
  !c.leadId && !c.onboardingId && !c.expedienteId && !(c.expedientesRelacionados ?? []).length;

export const nombreContactoPorId = (id?: string) => {
  if (!id) return "";
  const c = CONTACTOS.find((x) => x.id === id);
  return c ? nombreCompleto(c) : id;
};

export const emailContactoPorId = (id?: string) =>
  CONTACTOS.find((x) => x.id === id)?.email ?? "";

export const telefonoContactoPorId = (id?: string) =>
  CONTACTOS.find((x) => x.id === id)?.telefono ?? "";

/** Elimina claves indefinidas: el store usa propiedades opcionales estrictas. */
export const ctxLimpio = (c: ContextoComunicacion) => ({
  ...(c.contactoId ? { contactoId: c.contactoId } : {}),
  ...(c.leadId ? { leadId: c.leadId } : {}),
  ...(c.onboardingId ? { onboardingId: c.onboardingId } : {}),
  ...(c.expedienteId ? { expedienteId: c.expedienteId } : {}),
  ...(c.expedientesRelacionados?.length
    ? { expedientesRelacionados: c.expedientesRelacionados }
    : {}),
});
