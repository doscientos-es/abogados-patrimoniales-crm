// Motor del módulo ONBOARDING de LEX.
// Persiste en localStorage (mismo patrón que crm-store, expedientes-store y
// notas-store). Fase 0.0: los estados económicos son manuales y provisionales.
import { useSyncExternalStore } from "react";

import { PRESUPUESTOS, nombreContacto, type Presupuesto } from "@/data/crm";
import { HOY, hoyTexto, parseFecha } from "@/data/pipeline";
import {
  siguienteAccionOnboarding,
  type FaseOnboardingId,
  type InicioFormal,
  type ModalidadInicio,
  type Onboarding,
  type ProgramacionInicio,
} from "@/data/onboarding";
import { getOps, ops, siguienteAccionDe } from "@/lib/expedientes-store";

export type OnboardingState = {
  version: number;
  usuario: string;
  secuencia: number;
  onboardings: Onboarding[];
};

const STORAGE_KEY = "lex-onboarding";
const VERSION = 1;

export const diasDesdeFecha = (v: string | undefined) => {
  const d = parseFecha(v);
  if (!d) return undefined;
  return Math.max(0, Math.round((HOY.getTime() - d.getTime()) / 86_400_000));
};

/* ------------------------------------------------------------------ */
/* Semilla: migración de los presupuestos actuales                     */
/* ------------------------------------------------------------------ */

/**
 * Correspondencia exigida por la migración:
 * - Presupuestos anteriores a la aceptación → permanecen en el Lead y NO
 *   aparecen en Onboarding.
 * - Aceptado sin proforma enviada → permanece en el Lead (pendiente de iniciar).
 * - Aceptado con proforma enviada → Onboarding · Proforma enviada.
 * - Pago marcado como confirmado → Onboarding · Pago confirmado.
 * - Expediente ya creado → Onboarding · Completado.
 */
const migrarPresupuesto = (p: Presupuesto, indice: number): Onboarding | null => {
  const conProforma = Boolean(p.proforma);
  const pagado = p.proforma?.estado === "Pagada" || p.proforma?.pagado === "100 %";
  const parcial = Boolean(p.proforma?.pagado && p.proforma.pagado !== "0 %" && !pagado);

  let fase: FaseOnboardingId | null = null;
  let revision: string | undefined;

  if (p.expedienteId && (conProforma || pagado)) fase = "completado";
  else if (pagado) fase = "pago";
  else if (parcial) {
    fase = "proforma";
    revision = "Pago parcial registrado: pendiente de revisión de migración.";
  } else if (p.estado === "proforma-enviada" || (conProforma && p.estado === "aceptado")) {
    fase = "proforma";
  }

  if (!fase) return null;

  const fechaProforma = p.proforma?.fecha ?? p.aceptacion?.fecha ?? p.fechaFase ?? hoyTexto();

  const historial = [
    ...p.historial.map((h) => ({
      fecha: h.fecha,
      usuario: h.usuario,
      tipo: h.tipo,
      descripcion: `[Presupuesto ${p.codigo}] ${h.descripcion}`,
    })),
    {
      fecha: fechaProforma,
      usuario: "Migración",
      tipo: "Onboarding",
      descripcion: `Onboarding creado desde el presupuesto aceptado ${p.codigo}`,
    },
  ];

  return {
    id: `ONB-${String(indice + 1).padStart(4, "0")}`,
    codigo: `ONB-2026-${String(indice + 1).padStart(4, "0")}`,
    contactoId: p.contactoId,
    cliente: nombreContacto(p.contactoId),
    asunto: p.titulo,
    responsable: p.responsable,
    ...(p.oportunidadId ? { leadId: p.oportunidadId, leadCodigo: p.oportunidadId } : {}),
    presupuestoId: p.id,
    presupuestoCodigo: p.codigo,
    presupuestoVersion: p.version,
    importe: p.total,
    fase,
    fechaFase: fechaProforma,
    fechaProforma,
    ...(fase === "pago" || fase === "completado" ? { fechaPago: p.proforma?.fecha ?? fechaProforma } : {}),
    ...(p.expedienteId ? { expedienteId: p.expedienteId, expedienteCodigo: p.expedienteId } : {}),
    ...(fase === "completado" ? { fechaFin: fechaProforma } : {}),
    ...(revision ? { revisionMigracion: revision } : {}),
    creadoPor: "Migración",
    fechaCreacion: fechaProforma,
    historial,
  };
};

const semilla = (): OnboardingState => {
  const onboardings = PRESUPUESTOS.map((p, i) => migrarPresupuesto(p, i)).filter(
    (o): o is Onboarding => o !== null,
  );
  return { version: VERSION, usuario: "Igor Belmonte", secuencia: onboardings.length, onboardings };
};

/* ------------------------------------------------------------------ */
/* Persistencia                                                        */
/* ------------------------------------------------------------------ */

const leerAlmacen = (): OnboardingState => {
  if (typeof window === "undefined") return semilla();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return semilla();
    const data = JSON.parse(raw) as OnboardingState;
    if (!data || data.version !== VERSION) return semilla();
    return data;
  } catch {
    return semilla();
  }
};

let estado: OnboardingState = leerAlmacen();
const oyentes = new Set<() => void>();

const persistir = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    /* almacenamiento no disponible */
  }
};

const set = (fn: (s: OnboardingState) => OnboardingState) => {
  estado = fn(estado);
  persistir();
  oyentes.forEach((o) => o());
};

const subscribe = (fn: () => void) => {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
};

const getSnapshot = () => estado;
const semillaServidor = semilla();
const getServerSnapshot = () => semillaServidor;

export function useOnboarding<T>(sel: (s: OnboardingState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => sel(getSnapshot()),
    () => sel(getServerSnapshot()),
  );
}

const registrar = (o: Onboarding, tipo: string, descripcion: string): Onboarding => ({
  ...o,
  historial: [
    ...o.historial,
    { fecha: hoyTexto(), usuario: estado.usuario, tipo, descripcion },
  ],
});

const mapOnb = (id: string, fn: (o: Onboarding) => Onboarding) =>
  set((s) => ({ ...s, onboardings: s.onboardings.map((o) => (o.id === id ? fn(o) : o)) }));

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

export const onboarding = {
  usuarioActual: () => estado.usuario,

  porId: (id: string) => estado.onboardings.find((o) => o.id === id),

  porLead: (leadId: string) => estado.onboardings.find((o) => o.leadId === leadId),

  porPresupuesto: (presupuestoId: string) =>
    estado.onboardings.find((o) => o.presupuestoId === presupuestoId),

  /**
   * Entrada al Onboarding: solo desde un Lead aceptado y únicamente cuando se
   * registra manualmente el envío de la proforma.
   */
  registrarProformaEnviada(datos: {
    leadId?: string;
    leadCodigo?: string;
    contactoId: string;
    cliente: string;
    asunto: string;
    responsable: string;
    presupuestoId?: string;
    presupuestoCodigo?: string;
    presupuestoVersion?: string;
    importe?: string;
    area?: string;
    fecha?: string;
    observacion?: string;
  }): { ok: boolean; motivo?: string; id?: string } {
    if (!datos.presupuestoCodigo && !datos.presupuestoId) {
      return { ok: false, motivo: "No puede crearse un Onboarding sin presupuesto aceptado." };
    }
    const existente = datos.leadId
      ? estado.onboardings.find((o) => o.leadId === datos.leadId)
      : undefined;
    if (existente) return { ok: false, motivo: "Este Lead ya tiene un Onboarding.", id: existente.id };

    const n = estado.secuencia + 1;
    const fecha = datos.fecha?.trim() || hoyTexto();
    const nuevo: Onboarding = {
      id: `ONB-${String(n).padStart(4, "0")}`,
      codigo: `ONB-2026-${String(n).padStart(4, "0")}`,
      contactoId: datos.contactoId,
      cliente: datos.cliente,
      asunto: datos.asunto,
      responsable: datos.responsable,
      ...(datos.area ? { area: datos.area } : {}),
      ...(datos.leadId ? { leadId: datos.leadId } : {}),
      ...(datos.leadCodigo ? { leadCodigo: datos.leadCodigo } : {}),
      ...(datos.presupuestoId ? { presupuestoId: datos.presupuestoId } : {}),
      ...(datos.presupuestoCodigo ? { presupuestoCodigo: datos.presupuestoCodigo } : {}),
      ...(datos.presupuestoVersion ? { presupuestoVersion: datos.presupuestoVersion } : {}),
      ...(datos.importe ? { importe: datos.importe } : {}),
      fase: "proforma",
      fechaFase: fecha,
      fechaProforma: fecha,
      creadoPor: estado.usuario,
      fechaCreacion: hoyTexto(),
      historial: [
        {
          fecha,
          usuario: estado.usuario,
          tipo: "Alta",
          descripcion: `Onboarding creado desde el Lead ${datos.leadCodigo ?? datos.leadId ?? "—"} · presupuesto ${datos.presupuestoCodigo ?? "—"}`,
        },
        {
          fecha,
          usuario: estado.usuario,
          tipo: "Proforma",
          descripcion: `Envío de proforma registrado manualmente${datos.observacion ? ` · ${datos.observacion}` : ""}`,
        },
      ],
    };
    set((s) => ({ ...s, secuencia: n, onboardings: [nuevo, ...s.onboardings] }));
    return { ok: true, id: nuevo.id };
  },

  /** Estado manual y provisional hasta el módulo de Facturación y cobros. */
  marcarPagoConfirmado(id: string, fecha?: string, observacion?: string) {
    const f = fecha?.trim() || hoyTexto();
    mapOnb(id, (o) =>
      registrar(
        { ...o, fase: "pago", fechaPago: f, fechaFase: f },
        "Pago",
        `Pago marcado manualmente como confirmado${observacion ? ` · ${observacion}` : ""}`,
      ),
    );
  },

  programarInicioFormal(id: string, datos: ProgramacionInicio) {
    mapOnb(id, (o) =>
      registrar(
        {
          ...o,
          fase: "inicio",
          fechaFase: hoyTexto(),
          programacion: datos,
          modalidadPrevista: datos.modalidad,
        },
        "Inicio formal",
        `Inicio formal programado · ${datos.modalidad} · ${datos.fecha} ${datos.hora} · ${datos.responsable}`,
      ),
    );
  },

  registrarInicioFormal(id: string, datos: InicioFormal) {
    mapOnb(id, (o) =>
      registrar(
        { ...o, fase: "inicio", inicioFormal: datos, modalidadPrevista: datos.modalidad },
        "Actividad",
        `Inicio formal del encargo con el cliente · ${datos.modalidad} · ${datos.fecha}`,
      ),
    );
  },

  /** Cierra el Onboarding y crea o activa el expediente en F3 · CASEWORK. */
  completar(
    id: string,
    datos: { naturaleza: "Judicial" | "Extrajudicial"; area: string; responsable: string; siguienteAccion: string; excepcion?: string },
  ): { ok: boolean; motivo?: string; expedienteId?: string; expedienteCodigo?: string } {
    const o = estado.onboardings.find((x) => x.id === id);
    if (!o) return { ok: false, motivo: "Onboarding no encontrado" };
    if (!o.inicioFormal && !datos.excepcion?.trim()) {
      return { ok: false, motivo: "Registra el inicio formal o indica una excepción motivada." };
    }
    if (!datos.responsable.trim() || !datos.siguienteAccion.trim()) {
      return { ok: false, motivo: "El expediente exige responsable y siguiente acción." };
    }
    if (o.expedienteId) {
      return { ok: true, expedienteId: o.expedienteId, ...(o.expedienteCodigo ? { expedienteCodigo: o.expedienteCodigo } : {}) };
    }

    const exp = ops.crearExpediente({
      nombre: o.asunto,
      contactoId: o.contactoId,
      naturaleza: datos.naturaleza,
      responsable: datos.responsable,
      area: datos.area,
      // F3 · CASEWORK: primera fase del itinerario.
      fase: "diagnostico",
      dondeEstamos: o.inicioFormal?.resumen || "Expediente abierto tras el inicio formal con el cliente.",
      proximaAccion: datos.siguienteAccion,
      ...(o.presupuestoId ? { presupuestoId: o.presupuestoId } : {}),
      ...(o.leadId ? { oportunidadId: o.leadId } : {}),
    });

    mapOnb(id, (x) =>
      registrar(
        {
          ...x,
          fase: "completado",
          fechaFase: hoyTexto(),
          fechaFin: hoyTexto(),
          expedienteId: exp.id,
          expedienteCodigo: exp.codigo,
          ...(datos.excepcion?.trim() ? { revisionMigracion: `Completado con excepción: ${datos.excepcion}` } : {}),
        },
        "Expediente",
        `Onboarding completado · expediente ${exp.codigo} creado en F3 · CASEWORK`,
      ),
    );

    // SIGUIENTE ACCIÓN: si el Lead tenía una vigente, viaja al expediente sin
    // reiniciarse (rule: no se pierde al cambiar de fase).
    if (o.leadId) {
      const sa = siguienteAccionDe(getOps(), { tipo: "Oportunidad", id: o.leadId });
      if (sa) {
        ops.actualizarTarea(sa.id, {
          expedienteId: exp.id,
          origen: { tipo: "Expediente", id: exp.id, label: exp.codigo },
        });
        ops.registrarHistoricoTarea(
          sa.id,
          "Siguiente acción",
          `Continúa como siguiente acción del expediente ${exp.codigo}.`,
        );
      }
    }

    return { ok: true, expedienteId: exp.id, expedienteCodigo: exp.codigo };
  },

  anotar(id: string, tipo: string, descripcion: string) {
    mapOnb(id, (o) => registrar(o, tipo, descripcion));
  },
};

/* ------------------------------------------------------------------ */
/* Selectores                                                          */
/* ------------------------------------------------------------------ */

export const diasEnFaseOnboarding = (o: Onboarding) => diasDesdeFecha(o.fechaFase) ?? 0;

export const duracionOnboarding = (o: Onboarding) => {
  const inicio = parseFecha(o.fechaProforma);
  const fin = parseFecha(o.fechaFin) ?? HOY;
  if (!inicio) return undefined;
  return Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 86_400_000));
};

/** Alerta relevante única de la tarjeta. */
export const alertaOnboarding = (o: Onboarding): string | undefined => {
  if (o.revisionMigracion) return "Pendiente de revisión de migración";
  const dias = diasEnFaseOnboarding(o);
  if (o.fase === "proforma" && dias > 10) return `Sin pago confirmado (${dias} d)`;
  if (o.fase === "pago" && !o.programacion && dias > 5) return "Inicio formal sin programar";
  if (o.fase === "inicio" && !o.inicioFormal && dias > 7) return "Inicio formal sin documentar";
  return undefined;
};

export const sinSiguienteAccion = (o: Onboarding) =>
  o.fase !== "completado" && !siguienteAccionOnboarding(o);

export type { ModalidadInicio };
