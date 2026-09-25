import type { Json, MemberRole, OpportunityStage } from "@/shared/infrastructure/supabase";

export type OportunidadResumen = {
  id: string;
  referencia: string;
  contactoId: string;
  titulo: string;
  area: string;
  fase: OpportunityStage;
  subestado: string;
  prioridad: "Alta" | "Media" | "Baja";
  estadoOperativo: string;
  origen: string;
  creada: string;
  actualizada: string;
  asignadoId: string | null;
};

export type OportunidadPersistida = OportunidadResumen & {
  descripcion: string;
  valorEstimado: number | null;
  probabilidad: number;
  fechaObjetivo: string | null;
  archivadoEn: string | null;
  motivoArchivo: string | null;
  detalles: Json;
  version: number;
};

export type EventoOportunidad = {
  id: string;
  tipo: string;
  datos: Json;
  autorId: string | null;
  creadoEn: string;
};

export type ComunicacionOportunidad = {
  id: string;
  leadId: string;
  leadReferencia: string;
  leadTitulo: string;
  tipo: "email_draft" | "phone_call" | "meeting";
  resumen: string;
  creadoEn: string;
};

export type TransicionarOportunidadInput = {
  id: string;
  fase: OpportunityStage;
  subestado: string;
  motivo?: string;
};

export type ActualizarOportunidadInput = {
  id: string;
  versionEsperada: number;
  titulo: string;
  area: string;
  prioridad: OportunidadResumen["prioridad"];
  estadoOperativo: string;
  origen: string;
  descripcion: string;
  asignadoId: string | null;
  valorEstimado: number | null;
};

export type ArchivarOportunidadInput = {
  id: string;
  versionEsperada: number;
  motivo: string;
};

export type ActualizarDetallesOportunidadInput = {
  id: string;
  versionEsperada: number;
  detalles: Json;
  transicionContratacion?: {
    fase: OpportunityStage;
    subestado: string;
    motivo?: string;
  };
};

export type MiembroDespacho = {
  id: string;
  nombre: string;
  rol: MemberRole;
};
