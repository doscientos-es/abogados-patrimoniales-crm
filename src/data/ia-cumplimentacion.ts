// IA CUMPLIMENTACIÓN — modelo transversal.
//
// Capa única de ayuda a la cumplimentación de formularios de alta de LEX.
// NO hace análisis jurídico, ni plazos, ni tareas, ni comunicaciones, ni
// cambios de estado: sólo EXTRAE, ORDENA y PROPONE. La decisión final es
// siempre del usuario.
//
// Este módulo no duplica información de Contactos, Expedientes, Intervinientes
// ni Documentos: se limita a describir la sesión de cumplimentación y a
// referenciar esos módulos por identificador.
import type { Naturaleza, RelacionDespacho } from "@/data/contactos";

/* ------------------------------------------------------------------ */
/* Formularios soportados                                              */
/* ------------------------------------------------------------------ */

export type FormularioIA =
  | "contacto"
  | "oportunidad"
  | "expediente"
  | "interviniente"
  | "profesional";

export type CampoEsquema = {
  id: string;
  label: string;
  ayuda?: string;
};

export type EsquemaFormulario = {
  id: FormularioIA;
  titulo: string;
  /** Campos estructurados que la IA puede proponer. */
  campos: CampoEsquema[];
  /** Si el formulario admite alta múltiple de personas detectadas. */
  admitePersonas: boolean;
};

const CAMPOS_CONTACTO: CampoEsquema[] = [
  { id: "naturaleza", label: "Naturaleza", ayuda: "Persona física / Persona jurídica / Órgano judicial / Público" },
  { id: "nombre", label: "Nombre" },
  { id: "primerApellido", label: "Primer apellido" },
  { id: "segundoApellido", label: "Segundo apellido" },
  { id: "razonSocial", label: "Razón social o denominación oficial" },
  { id: "documento", label: "DNI / NIE / CIF" },
  { id: "fechaNacimiento", label: "Fecha de nacimiento", ayuda: "dd/mm/aaaa" },
  { id: "nacionalidad", label: "Nacionalidad" },
  { id: "caducidadDocumento", label: "Fecha de caducidad del documento" },
  { id: "telefono", label: "Teléfono principal" },
  { id: "email", label: "Correo principal" },
  { id: "direccion", label: "Dirección" },
  { id: "codigoPostal", label: "Código postal" },
  { id: "municipio", label: "Municipio" },
  { id: "provincia", label: "Provincia" },
  { id: "pais", label: "País" },
  { id: "personaContacto", label: "Persona de contacto" },
  { id: "cargo", label: "Cargo" },
  { id: "codigoOrgano", label: "Código o identificación oficial" },
];

const CAMPOS_EXPEDIENTE: CampoEsquema[] = [
  { id: "denominacion", label: "Denominación provisional del expediente", ayuda: "Propuesta a partir de las partes; requiere validación" },
  { id: "cliente", label: "Parte cliente" },
  { id: "contrario", label: "Parte contraria" },
  { id: "materia", label: "Materia" },
  { id: "via", label: "Vía", ayuda: "Judicial o Extrajudicial" },
  { id: "organoJudicial", label: "Órgano judicial" },
  { id: "jurisdiccion", label: "Jurisdicción" },
  { id: "tipoProcedimiento", label: "Tipo de procedimiento" },
  { id: "numeroProcedimiento", label: "Número de procedimiento" },
  { id: "nig", label: "NIG" },
  { id: "cuantia", label: "Cuantía" },
  { id: "fechaDocumento", label: "Fecha del documento" },
  { id: "notario", label: "Notario autorizante" },
  { id: "protocolo", label: "Número de protocolo" },
  { id: "notaria", label: "Notaría y localidad" },
  { id: "inmueble", label: "Bien inmueble / datos registrales" },
  { id: "referenciaCatastral", label: "Referencia catastral" },
  { id: "precio", label: "Precio o valor" },
];

const CAMPOS_OPORTUNIDAD: CampoEsquema[] = [
  { id: "titulo", label: "Título de la oportunidad" },
  { id: "cliente", label: "Contacto principal" },
  { id: "materia", label: "Materia" },
  { id: "descripcion", label: "Descripción del asunto" },
  { id: "importe", label: "Importe estimado" },
  { id: "origen", label: "Origen" },
];

const CAMPOS_INTERVINIENTE: CampoEsquema[] = [
  { id: "nombre", label: "Nombre o denominación" },
  { id: "documento", label: "DNI / NIE / CIF" },
  { id: "rolExpediente", label: "Interviene como", ayuda: "Rol dentro de este expediente; no modifica la ficha del contacto" },
  { id: "rolDocumental", label: "Rol documental" },
  { id: "telefono", label: "Teléfono" },
  { id: "email", label: "Correo" },
  { id: "direccion", label: "Dirección" },
];

const CAMPOS_PROFESIONAL: CampoEsquema[] = [
  { id: "nombre", label: "Nombre y apellidos" },
  { id: "despacho", label: "Despacho, notaría u organismo" },
  { id: "numeroColegiado", label: "Número de colegiado o protocolo" },
  { id: "telefono", label: "Teléfono" },
  { id: "email", label: "Correo" },
  { id: "direccion", label: "Dirección profesional" },
  { id: "municipio", label: "Localidad" },
];

export const ESQUEMAS: Record<FormularioIA, EsquemaFormulario> = {
  contacto: { id: "contacto", titulo: "Nuevo contacto", campos: CAMPOS_CONTACTO, admitePersonas: true },
  oportunidad: { id: "oportunidad", titulo: "Nueva oportunidad", campos: CAMPOS_OPORTUNIDAD, admitePersonas: true },
  expediente: { id: "expediente", titulo: "Nuevo expediente", campos: CAMPOS_EXPEDIENTE, admitePersonas: true },
  interviniente: { id: "interviniente", titulo: "Nuevo interviniente", campos: CAMPOS_INTERVINIENTE, admitePersonas: true },
  profesional: { id: "profesional", titulo: "Alta de profesional", campos: CAMPOS_PROFESIONAL, admitePersonas: true },
};

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

/** Posición de la persona en el asunto (no altera su clasificación general). */
export const ROLES_EXPEDIENTE = [
  "Parte cliente",
  "Parte contraria",
  "Demandante",
  "Demandado",
  "Letrado contrario",
  "Procurador",
  "Notario",
  "Administrador",
  "Representante",
  "Testigo",
  "Perito",
  "Sin determinar",
] as const;

/** Condición con la que interviene en el documento concreto. */
export const ROLES_DOCUMENTALES = [
  "Comprador",
  "Vendedor",
  "Heredero",
  "Legatario",
  "Donante",
  "Donatario",
  "Apoderado",
  "Representante",
  "Notario autorizante",
  "Demandante",
  "Demandado",
  "Letrado",
  "Procurador",
  "Otros",
] as const;

export type RolExpediente = (typeof ROLES_EXPEDIENTE)[number];
export type RolDocumental = (typeof ROLES_DOCUMENTALES)[number];

/* ------------------------------------------------------------------ */
/* Estados visuales                                                    */
/* ------------------------------------------------------------------ */

/** verde / amarillo / rojo / neutro, sin porcentajes técnicos. */
export type EstadoDato = "confirmado" | "pendiente" | "dudoso" | "manual" | "descartado";

export const TEXTO_ESTADO: Record<EstadoDato, string> = {
  confirmado: "Dato confirmado",
  pendiente: "Revisar",
  dudoso: "No se ha podido leer",
  manual: "Introducido manualmente",
  descartado: "Descartado",
};

export type Claridad = "clara" | "revisar" | "ilegible";

/* ------------------------------------------------------------------ */
/* Entidades de la sesión                                              */
/* ------------------------------------------------------------------ */

export type DocumentoFuente = {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
  /** Se conserva el original en la sesión para poder consultarlo. */
  datos: string;
  subidoEn: string;
  tipoDocumental?: string;
  estado: "pendiente" | "leyendo" | "leido" | "error";
  error?: string;
};

export type VersionDato = {
  valor: string;
  documentoId: string;
  pagina?: number;
  fragmento?: string;
};

export type DatoExtraido = {
  id: string;
  campoId: string;
  etiqueta: string;
  valor: string;
  estado: EstadoDato;
  claridad: Claridad;
  documentoId?: string;
  pagina?: number;
  fragmento?: string;
  /** Versiones alternativas halladas en otros documentos (contradicciones). */
  versiones: VersionDato[];
  personaId?: string;
  validadoPor?: string;
  validadoEn?: string;
  corregido?: boolean;
};

export type DecisionPersona = "crear" | "vincular" | "solo-documento" | "excluir" | "pendiente";

export type Coincidencia = {
  contactoId: string;
  nombre: string;
  motivo: string;
};

export type PersonaDetectada = {
  id: string;
  nombre: string;
  naturaleza: Naturaleza;
  documento?: string;
  domicilio?: string;
  telefono?: string;
  email?: string;
  profesion?: string;
  esProfesional: boolean;
  rolDocumental: string;
  rolExpediente: RolExpediente;
  /** La relación con el despacho SIEMPRE la decide el usuario. */
  relacion?: RelacionDespacho;
  decision: DecisionPersona;
  contactoVinculado?: string;
  coincidencias: Coincidencia[];
  documentoId?: string;
  fragmento?: string;
};

export type Pregunta = {
  id: string;
  texto: string;
  campoId?: string;
  personaId?: string;
  opciones: string[];
  respuesta?: string;
  estado: "pendiente" | "respondida" | "omitida";
};

export type EventoIA = {
  id: string;
  fecha: string;
  usuario: string;
  accion: string;
  detalle: string;
};

export type SesionIA = {
  id: string;
  formulario: FormularioIA;
  contexto?: string;
  creadaEn: string;
  usuario: string;
  documentos: DocumentoFuente[];
  datos: DatoExtraido[];
  personas: PersonaDetectada[];
  preguntas: Pregunta[];
  trazabilidad: EventoIA[];
  aplicada: boolean;
};

export const NATURALEZAS_IA: Naturaleza[] = [
  "Persona física",
  "Persona jurídica",
  "Órgano judicial",
  "Público",
];

export const RELACIONES_IA: RelacionDespacho[] = [
  "Lead",
  "Cliente",
  "Profesional / colaborador",
  "Tercero",
  "Contraparte",
  "Proveedor",
];
