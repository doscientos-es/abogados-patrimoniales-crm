// Modelo del módulo ONBOARDING de LEX (fase 0.0).
// El Onboarding comienza tras la aceptación del presupuesto, cuando se
// registra manualmente el envío de la proforma, y termina cuando el asunto
// se incorpora a F3 · CASEWORK. No contiene funcionalidad económica real:
// «proforma enviada» y «pago confirmado» son estados manuales provisionales.
import type { FaseId } from "@/data/pipeline";

export type FaseOnboardingId = "proforma" | "pago" | "inicio" | "completado";

export type ColorFase =
  | "azul"
  | "cian"
  | "indigo"
  | "ambar"
  | "violeta"
  | "turquesa"
  | "verde"
  | "rojo"
  | "gris";

export const claseColor = (c: ColorFase) => `fase-${c}`;

export type FaseOnboarding = {
  id: FaseOnboardingId;
  nombre: string;
  corto: string;
  descripcion: string;
  color: ColorFase;
  /** Foco operativo único de la fase. */
  ahoraToca: string;
  terminal?: boolean;
};

export const FASES_ONBOARDING: FaseOnboarding[] = [
  {
    id: "proforma",
    nombre: "Proforma enviada",
    corto: "Proforma",
    descripcion: "Proforma registrada manualmente como enviada al cliente.",
    color: "ambar",
    ahoraToca: "Comprobar el pago",
  },
  {
    id: "pago",
    nombre: "Pago confirmado",
    corto: "Pago",
    descripcion: "Pago marcado provisionalmente como confirmado.",
    color: "turquesa",
    ahoraToca: "Contactar con el cliente para el inicio formal",
  },
  {
    id: "inicio",
    nombre: "Inicio formal con el cliente",
    corto: "Inicio formal",
    descripcion: "Contacto de inicio programado o en curso.",
    color: "violeta",
    ahoraToca: "Realizar y documentar el inicio formal",
  },
  {
    id: "completado",
    nombre: "Completado",
    corto: "Completado",
    descripcion: "Expediente creado o activado en F3 · CASEWORK.",
    color: "verde",
    ahoraToca: "Abrir expediente",
    terminal: true,
  },
];

export const faseOnboarding = (id: FaseOnboardingId) =>
  FASES_ONBOARDING.find((f) => f.id === id) ?? FASES_ONBOARDING[0]!;

/** Colores permanentes de las fases del Lead (no modifica su workflow). */
export const COLOR_FASE_LEAD: Record<FaseId, ColorFase> = {
  entrada: "azul",
  cualificacion: "cian",
  "primera-cita": "indigo",
  presupuesto: "ambar",
  validacion: "violeta",
  contratacion: "turquesa",
  ganada: "verde",
  cerrada: "rojo",
};

export const MODALIDADES_INICIO = ["Llamada", "Reunión presencial", "Videollamada"] as const;
export type ModalidadInicio = (typeof MODALIDADES_INICIO)[number];

export type ProgramacionInicio = {
  fecha: string;
  hora: string;
  modalidad: ModalidadInicio;
  responsable: string;
  participantes: string;
  ubicacion: string;
  indicacion: string;
  /** Elementos que se crean o vinculan al programar (fase 0.0: enlaces lógicos). */
  vincular: { actividad: boolean; calendario: boolean; tarea: boolean; recordatorio: boolean };
};

export type InicioFormal = {
  fecha: string;
  hora: string;
  modalidad: ModalidadInicio;
  asistentes: string;
  responsable: string;
  resumen: string;
  documentacionSolicitada: string;
  documentacionPendiente: string;
  urgencias: string;
  primeraActuacion: string;
  siguienteAccion: string;
  observaciones: string;
};

export type EventoOnboarding = {
  fecha: string;
  usuario: string;
  tipo: string;
  descripcion: string;
};

export type Onboarding = {
  id: string;
  codigo: string;
  contactoId: string;
  cliente: string;
  asunto: string;
  responsable: string;
  area?: string;
  naturaleza?: "Judicial" | "Extrajudicial";
  /** Lead de origen (comercialmente concluido). */
  leadId?: string;
  leadCodigo?: string;
  /** Presupuesto aceptado que da entrada al Onboarding. */
  presupuestoId?: string;
  presupuestoCodigo?: string;
  presupuestoVersion?: string;
  importe?: string;
  fase: FaseOnboardingId;
  fechaFase: string;
  /** Registro manual y provisional del envío de la proforma. */
  fechaProforma: string;
  /** Registro manual y provisional de la confirmación del pago. */
  fechaPago?: string;
  modalidadPrevista?: ModalidadInicio;
  programacion?: ProgramacionInicio;
  inicioFormal?: InicioFormal;
  expedienteId?: string;
  expedienteCodigo?: string;
  fechaFin?: string;
  alerta?: string;
  /** Casos dudosos de la migración: se conservan y se clasifican a mano. */
  revisionMigracion?: string;
  creadoPor: string;
  fechaCreacion: string;
  historial: EventoOnboarding[];
};

/** Siguiente acción coherente con la fase (foco único «AHORA TOCA»). */
export const siguienteAccionOnboarding = (o: Onboarding): string => {
  switch (o.fase) {
    case "proforma":
      return "Comprobar pago";
    case "pago":
      return o.programacion ? "Realizar inicio formal" : "Programar inicio formal";
    case "inicio":
      return "Completar Onboarding";
    case "completado":
      return "Abrir expediente";
  }
};

export const esActivo = (o: Onboarding) => o.fase !== "completado";
