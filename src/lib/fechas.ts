// FECHAS Y PLAZOS · utilidades puras del repositorio temporal central de LEX.
// Una única fuente de datos (FechaCritica) mostrada en distintos contextos.
import {
  type FechaCritica,
  type RegistroTemporal,
  type ClasePlazo,
} from "@/data/expedientes-model";
import { HOY, formatoFecha, parseFecha } from "@/data/pipeline";

/* ------------------------------------------------------------------ */
/* Tipo de registro                                                    */
/* ------------------------------------------------------------------ */

/** Deduce el tipo de registro temporal, con retrocompatibilidad de datos. */
export function registroDe(f: FechaCritica): RegistroTemporal {
  if (f.registro) return f.registro;
  if (f.tipo === "Recordatorio") return "Recordatorio";
  if (f.tipo === "Evento o cita") return "Evento";
  if (f.tipo === "Plazo procesal" || f.tipo === "Vencimiento interno") return "Plazo";
  return "Fecha";
}

export const esCritico = (f: FechaCritica) =>
  f.critico ?? (registroDe(f) === "Plazo" && f.criticidad === "Alta");

export const tonoRegistro: Record<RegistroTemporal, "info" | "neutro" | "exito" | "riesgo"> = {
  Recordatorio: "neutro",
  Fecha: "info",
  Evento: "exito",
  Plazo: "riesgo",
};

/** Clases de color por tipo, con lógica próxima a un calendario al uso. */
export const colorRegistro: Record<RegistroTemporal, string> = {
  Recordatorio: "border-muted-foreground/30 bg-muted text-foreground",
  Fecha: "border-primary/30 bg-primary/10 text-primary",
  Evento: "border-success/30 bg-success/10 text-success",
  Plazo: "border-destructive/30 bg-destructive/10 text-destructive",
};

/* ------------------------------------------------------------------ */
/* Fechas y horas                                                      */
/* ------------------------------------------------------------------ */

export const hoy = () => new Date(HOY);

/** Convierte «dd/mm/aaaa» + «hh:mm» en Date. */
export function fechaHora(f: { fecha: string; hora?: string }): Date | null {
  const d = parseFecha(f.fecha);
  if (!d) return null;
  const m = (f.hora ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

export const mismoDia = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

export const sumarDiasDate = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Lunes de la semana de la fecha dada. */
export const inicioSemana = (d: Date) => {
  const x = new Date(d);
  const dia = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dia);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const iso = (d: Date) => formatoFecha(d);

export const textoFechaLarga = (d: Date) =>
  d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/* ------------------------------------------------------------------ */
/* Cómputo de plazos (primera versión: sábados, domingos y festivos)   */
/* ------------------------------------------------------------------ */

/** Festivos nacionales considerados en esta primera versión. */
export const FESTIVOS_NACIONALES = [
  "01/01",
  "06/01",
  "01/05",
  "15/08",
  "12/10",
  "01/11",
  "06/12",
  "08/12",
  "25/12",
];

export const esInhabil = (d: Date) => {
  const finde = d.getDay() === 0 || d.getDay() === 6;
  const clave = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return finde || FESTIVOS_NACIONALES.includes(clave);
};

export type Termino = {
  cantidad: number;
  unidad: "habiles" | "naturales" | "meses" | "anios";
};

/** Interpreta un término libre del tipo «20 días hábiles para contestar». */
export function interpretarTermino(texto: string): Termino | null {
  const t = (texto ?? "").toLowerCase();
  const m = t.match(/(\d+)/);
  if (!m) return null;
  const cantidad = Number(m[1]);
  if (!cantidad) return null;
  if (/a[nñ]o/.test(t)) return { cantidad, unidad: "anios" };
  if (/mes/.test(t)) return { cantidad, unidad: "meses" };
  if (/h[aá]bil/.test(t)) return { cantidad, unidad: "habiles" };
  return { cantidad, unidad: "naturales" };
}

export type PropuestaPlazo = {
  fecha: string;
  explicacion: string;
};

/**
 * Propone —nunca fija— la fecha de vencimiento a partir del día de
 * notificación y del término indicado. Requiere confirmación humana.
 */
export function proponerVencimiento(
  diaNotificacion: string,
  termino: string,
): PropuestaPlazo | null {
  const inicio = parseFecha(diaNotificacion);
  const t = interpretarTermino(termino);
  if (!inicio || !t) return null;

  const d = new Date(inicio);
  if (t.unidad === "habiles") {
    let restan = t.cantidad;
    while (restan > 0) {
      d.setDate(d.getDate() + 1);
      if (!esInhabil(d)) restan -= 1;
    }
  } else if (t.unidad === "naturales") {
    d.setDate(d.getDate() + t.cantidad);
  } else if (t.unidad === "meses") {
    d.setMonth(d.getMonth() + t.cantidad);
  } else {
    d.setFullYear(d.getFullYear() + t.cantidad);
  }
  // Si el vencimiento cae en inhábil, se traslada al siguiente día hábil.
  let trasladado = false;
  while (esInhabil(d)) {
    d.setDate(d.getDate() + 1);
    trasladado = true;
  }

  const unidadTexto =
    t.unidad === "habiles"
      ? "días hábiles"
      : t.unidad === "naturales"
        ? "días naturales"
        : t.unidad === "meses"
          ? "meses"
          : "años";

  return {
    fecha: formatoFecha(d),
    explicacion:
      `Cómputo desde el ${diaNotificacion} sumando ${t.cantidad} ${unidadTexto}` +
      (t.unidad === "habiles" ? " (excluidos sábados, domingos y festivos nacionales)" : "") +
      (trasladado ? ", trasladado al siguiente día hábil" : "") +
      ". Propuesta orientativa: requiere confirmación profesional.",
  };
}

/* ------------------------------------------------------------------ */
/* Estado temporal                                                     */
/* ------------------------------------------------------------------ */

export type SituacionTemporal =
  | "Pendiente"
  | "Realizado"
  | "Pospuesto"
  | "Pasada"
  | "Finalizado"
  | "Vencido";

export function situacionDe(f: FechaCritica, ahora: Date = new Date()): SituacionTemporal {
  const reg = registroDe(f);
  const cuando = fechaHora(f);
  const pasado = cuando ? cuando.getTime() < ahora.getTime() : false;

  if (reg === "Recordatorio") {
    if (f.estadoTemporal === "Realizado" || f.resultado === "Atendido") return "Realizado";
    if ((f.aplazamientos ?? []).length && !pasado) return "Pospuesto";
    return "Pendiente";
  }
  if (reg === "Fecha") return pasado ? "Pasada" : "Pendiente";
  if (reg === "Evento") return pasado ? "Finalizado" : "Pendiente";
  if (f.estadoTemporal === "Realizado" || f.resultado) return "Realizado";
  return pasado ? "Vencido" : "Pendiente";
}

export const tonoSituacion: Record<SituacionTemporal, "neutro" | "info" | "exito" | "aviso" | "riesgo"> = {
  Pendiente: "info",
  Realizado: "exito",
  Pospuesto: "aviso",
  Pasada: "neutro",
  Finalizado: "neutro",
  Vencido: "riesgo",
};

/* ------------------------------------------------------------------ */
/* Google Calendar                                                     */
/* ------------------------------------------------------------------ */

/** Calendario del despacho (control global de Secretaría). */
export const CALENDARIO_DESPACHO = "https://calendar.google.com/calendar/r";

const gcalFecha = (f: FechaCritica, fin = false) => {
  const d = fechaHora(f);
  if (!d) return "";
  const base = new Date(d);
  if (fin) {
    const m = (f.horaFin ?? "").match(/^(\d{1,2}):(\d{2})$/);
    if (m) base.setHours(Number(m[1]), Number(m[2]), 0, 0);
    else base.setHours(base.getHours() + 1);
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}${p(base.getMonth() + 1)}${p(base.getDate())}T${p(base.getHours())}${p(base.getMinutes())}00`;
};

/** Enlace de alta del registro en el calendario del despacho. */
export function urlGoogleCalendar(f: FechaCritica) {
  const inicio = gcalFecha(f);
  const fin = gcalFecha(f, true);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${esCritico(f) ? "[CRÍTICO] " : ""}${f.titulo}`,
    details: [f.observaciones, f.expedienteId ? `Expediente ${f.expedienteId}` : "", `LEX · ${registroDe(f)}`]
      .filter(Boolean)
      .join("\n"),
  });
  if (inicio && fin) params.set("dates", `${inicio}/${fin}`);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Filtros y ordenación                                                */
/* ------------------------------------------------------------------ */

export const ordenCronologico = (a: FechaCritica, b: FechaCritica) => {
  const da = fechaHora(a)?.getTime() ?? 0;
  const db = fechaHora(b)?.getTime() ?? 0;
  return da - db;
};

export type AtajoTemporal = "todas" | "hoy" | "semana" | "tres" | "siete";

export const ATAJOS: { id: AtajoTemporal; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana en curso" },
  { id: "tres", label: "Próximos 3 días" },
  { id: "siete", label: "Próximos 7 días" },
];

export function enAtajo(f: FechaCritica, atajo: AtajoTemporal, ref: Date = hoy()) {
  if (atajo === "todas") return true;
  const d = fechaHora(f);
  if (!d) return false;
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const base = new Date(ref);
  base.setHours(0, 0, 0, 0);

  if (atajo === "hoy") return mismoDia(dia, base);
  if (atajo === "semana") {
    const ini = inicioSemana(base);
    const fin = sumarDiasDate(ini, 6);
    return dia >= ini && dia <= fin;
  }
  const dias = atajo === "tres" ? 3 : 7;
  return dia >= base && dia <= sumarDiasDate(base, dias);
}

export function enRango(f: FechaCritica, desde: string, hasta: string) {
  const d = fechaHora(f);
  if (!d) return false;
  const a = parseFecha(desde);
  const b = parseFecha(hasta);
  if (a && d < a) return false;
  if (b) {
    const fin = new Date(b);
    fin.setHours(23, 59, 59, 999);
    if (d > fin) return false;
  }
  return true;
}

export type FiltroTemporal = {
  tipos: RegistroTemporal[];
  soloCriticos: boolean;
  atajo: AtajoTemporal;
  expedienteId: string;
  clase: ClasePlazo | "";
  desde: string;
  hasta: string;
  texto: string;
};

export const FILTRO_INICIAL: FiltroTemporal = {
  tipos: [],
  soloCriticos: false,
  atajo: "todas",
  expedienteId: "",
  clase: "",
  desde: "",
  hasta: "",
  texto: "",
};

export function aplicarFiltro(lista: FechaCritica[], f: FiltroTemporal) {
  return lista
    .filter((r) => (f.tipos.length ? f.tipos.includes(registroDe(r)) : true))
    .filter((r) => (f.soloCriticos ? esCritico(r) : true))
    .filter((r) => enAtajo(r, f.atajo))
    .filter((r) => (f.expedienteId ? r.expedienteId === f.expedienteId : true))
    .filter((r) => (f.clase ? r.clasePlazo === f.clase : true))
    .filter((r) => (f.desde || f.hasta ? enRango(r, f.desde, f.hasta) : true))
    .filter((r) =>
      f.texto.trim() ? r.titulo.toLowerCase().includes(f.texto.trim().toLowerCase()) : true,
    )
    .sort(ordenCronologico);
}
