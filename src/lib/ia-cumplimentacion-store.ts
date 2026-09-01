// IA CUMPLIMENTACIÓN — motor de sesión y trazabilidad.
//
// Mantiene la sesión de cumplimentación (documentos, datos extraídos, personas
// detectadas, preguntas y trazabilidad) sin duplicar la información de
// Contactos, Expedientes, Intervinientes ni Documentos: sólo los referencia.
// Persiste el registro de sesiones aplicadas en localStorage, con el mismo
// patrón que el resto de stores de LEX.
import { useSyncExternalStore } from "react";

import { CONTACTOS, nombreCompleto, type Naturaleza } from "@/data/contactos";
import {
  ESQUEMAS,
  ROLES_DOCUMENTALES,
  type Claridad,
  type Coincidencia,
  type DatoExtraido,
  type DocumentoFuente,
  type EventoIA,
  type FormularioIA,
  type PersonaDetectada,
  type Pregunta,
  type SesionIA,
} from "@/data/ia-cumplimentacion";

const STORAGE_KEY = "lex-ia-cumplimentacion";
const VERSION = 1;

const dos = (n: number) => String(n).padStart(2, "0");
export const ahoraIA = () => {
  const d = new Date();
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

let contador = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(contador++).toString(36)}`;

/* ------------------------------------------------------------------ */
/* Registro persistente de sesiones aplicadas (trazabilidad)           */
/* ------------------------------------------------------------------ */

type RegistroState = { version: number; sesiones: SesionIA[] };

let estado: RegistroState = { version: VERSION, sesiones: [] };
let cargado = false;
const suscriptores = new Set<() => void>();

function cargar() {
  if (cargado || typeof window === "undefined") return;
  cargado = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RegistroState;
      if (parsed?.sesiones) estado = { version: VERSION, sesiones: parsed.sesiones };
    }
  } catch {
    /* registro corrupto: se descarta */
  }
}

function guardar() {
  if (typeof window === "undefined") return;
  try {
    // No se persiste el binario del documento para no saturar el almacenamiento.
    const ligero: RegistroState = {
      version: VERSION,
      sesiones: estado.sesiones.map((s) => ({
        ...s,
        documentos: s.documentos.map((d) => ({ ...d, datos: "" })),
      })),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ligero));
  } catch {
    /* almacenamiento lleno */
  }
  suscriptores.forEach((f) => f());
}

export function registrarSesionAplicada(sesion: SesionIA) {
  cargar();
  estado = { ...estado, sesiones: [{ ...sesion, aplicada: true }, ...estado.sesiones].slice(0, 50) };
  guardar();
}

export function useSesionesIA() {
  return useSyncExternalStore(
    (f) => {
      suscriptores.add(f);
      return () => suscriptores.delete(f);
    },
    () => {
      cargar();
      return estado.sesiones;
    },
    () => [] as SesionIA[],
  );
}

/* ------------------------------------------------------------------ */
/* Sesión                                                              */
/* ------------------------------------------------------------------ */

export function nuevaSesion(
  formulario: FormularioIA,
  usuario: string,
  contexto?: string,
): SesionIA {
  return {
    id: uid("IAS"),
    formulario,
    ...(contexto ? { contexto } : {}),
    creadaEn: ahoraIA(),
    usuario,
    documentos: [],
    datos: [],
    personas: [],
    preguntas: [],
    trazabilidad: [
      {
        id: uid("EV"),
        fecha: ahoraIA(),
        usuario,
        accion: "Sesión iniciada",
        detalle: `Formulario ${ESQUEMAS[formulario].titulo}`,
      },
    ],
    aplicada: false,
  };
}

export function traza(sesion: SesionIA, accion: string, detalle: string): SesionIA {
  const ev: EventoIA = { id: uid("EV"), fecha: ahoraIA(), usuario: sesion.usuario, accion, detalle };
  return { ...sesion, trazabilidad: [...sesion.trazabilidad, ev] };
}

export function nuevoDocumento(
  nombre: string,
  mime: string,
  tamano: number,
  datos: string,
): DocumentoFuente {
  return {
    id: uid("DOC"),
    nombre,
    mime,
    tamano,
    datos,
    subidoEn: ahoraIA(),
    estado: "pendiente",
  };
}

/* ------------------------------------------------------------------ */
/* Duplicados                                                          */
/* ------------------------------------------------------------------ */

const norm = (v: string | undefined) =>
  (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@. ]/g, "")
    .trim();

const soloDigitos = (v: string | undefined) => (v ?? "").replace(/\D/g, "");

/**
 * Orden de comprobación: documento → nombre → email → teléfono → despacho/localidad.
 * Nunca fusiona ni sobrescribe: sólo propone coincidencias.
 */
export function buscarCoincidencias(p: {
  nombre: string;
  documento?: string;
  email?: string;
  telefono?: string;
  domicilio?: string;
  profesion?: string;
}): Coincidencia[] {
  const salida: Coincidencia[] = [];
  const doc = norm(p.documento);
  const nom = norm(p.nombre);
  const mail = norm(p.email);
  const tel = soloDigitos(p.telefono);
  const dom = norm(p.domicilio);

  for (const c of CONTACTOS) {
    const nombreC = norm(nombreCompleto(c));
    let motivo = "";
    if (doc && norm(c.nif) === doc) motivo = "Mismo DNI / NIE / CIF";
    else if (nom && nombreC && (nombreC === nom || nombreC.includes(nom) || nom.includes(nombreC)))
      motivo = "Nombre o denominación coincidente";
    else if (mail && norm(c.email) === mail) motivo = "Mismo correo electrónico";
    else if (tel && soloDigitos(c.telefono) === tel) motivo = "Mismo teléfono";
    else if (dom && norm(c.direccion) && norm(c.direccion) === dom)
      motivo = "Misma dirección profesional";

    if (motivo) salida.push({ contactoId: c.id, nombre: nombreCompleto(c), motivo });
    if (salida.length >= 4) break;
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/* Incorporación de una lectura a la sesión                            */
/* ------------------------------------------------------------------ */

const NATURALEZAS_VALIDAS: Naturaleza[] = [
  "Persona física",
  "Persona jurídica",
  "Órgano judicial",
  "Público",
];

const naturalezaValida = (v: string): Naturaleza =>
  NATURALEZAS_VALIDAS.find((n) => norm(n) === norm(v)) ?? "Persona física";

const rolDocumentalValido = (v: string) =>
  ROLES_DOCUMENTALES.find((r) => norm(r) === norm(v)) ?? (v.trim() || "Otros");

export type Lectura = {
  tipoDocumental: string;
  campos: {
    campoId: string;
    valor: string;
    pagina?: number | undefined;
    fragmento: string;
    claridad: Claridad;
  }[];
  personas: {
    nombre: string;
    naturaleza: string;
    documento: string;
    domicilio: string;
    telefono: string;
    email: string;
    profesion: string;
    esProfesional: boolean;
    rolDocumental: string;
    fragmento: string;
    pagina?: number | undefined;
  }[];
  preguntas: { texto: string; campoId: string; opciones: string[] }[];
};

/**
 * Integra una lectura. Los datos ya confirmados nunca se sobrescriben: si el
 * valor difiere se guarda como versión alternativa para que el usuario elija.
 */
export function integrarLectura(
  sesion: SesionIA,
  documentoId: string,
  lectura: Lectura,
): SesionIA {
  const esquema = ESQUEMAS[sesion.formulario];
  const datos = [...sesion.datos];

  for (const c of lectura.campos) {
    const campo = esquema.campos.find((x) => x.id === c.campoId);
    if (!campo || !c.valor?.trim()) continue;
    const existente = datos.find((d) => d.campoId === c.campoId && !d.personaId);
    if (existente) {
      if (norm(existente.valor) === norm(c.valor)) continue;
      existente.versiones = [
        ...existente.versiones,
        {
          valor: c.valor,
          documentoId,
          ...(c.pagina ? { pagina: c.pagina } : {}),
          ...(c.fragmento ? { fragmento: c.fragmento } : {}),
        },
      ];
      continue;
    }
    datos.push({
      id: uid("DT"),
      campoId: c.campoId,
      etiqueta: campo.label,
      valor: c.valor.trim(),
      estado: c.claridad === "ilegible" ? "dudoso" : "pendiente",
      claridad: c.claridad,
      documentoId,
      ...(c.pagina ? { pagina: c.pagina } : {}),
      ...(c.fragmento ? { fragmento: c.fragmento } : {}),
      versiones: [],
    });
  }

  const personas = [...sesion.personas];
  for (const p of lectura.personas) {
    if (!p.nombre?.trim()) continue;
    const yaEsta = personas.find((x) => norm(x.nombre) === norm(p.nombre));
    if (yaEsta) continue;
    const persona: PersonaDetectada = {
      id: uid("PER"),
      nombre: p.nombre.trim(),
      naturaleza: naturalezaValida(p.naturaleza),
      ...(p.documento ? { documento: p.documento } : {}),
      ...(p.domicilio ? { domicilio: p.domicilio } : {}),
      ...(p.telefono ? { telefono: p.telefono } : {}),
      ...(p.email ? { email: p.email } : {}),
      ...(p.profesion ? { profesion: p.profesion } : {}),
      esProfesional: Boolean(p.esProfesional),
      rolDocumental: rolDocumentalValido(p.rolDocumental),
      rolExpediente: "Sin determinar",
      decision: "pendiente",
      coincidencias: buscarCoincidencias({
        nombre: p.nombre,
        documento: p.documento,
        email: p.email,
        telefono: p.telefono,
        domicilio: p.domicilio,
        profesion: p.profesion,
      }),
      documentoId,
      ...(p.fragmento ? { fragmento: p.fragmento } : {}),
    };
    personas.push(persona);
  }

  const preguntas: Pregunta[] = [...sesion.preguntas];
  for (const q of lectura.preguntas) {
    if (!q.texto?.trim()) continue;
    // No se pregunta por datos ya cumplimentados o confirmados.
    if (q.campoId && datos.some((d) => d.campoId === q.campoId && d.valor)) continue;
    if (preguntas.some((x) => norm(x.texto) === norm(q.texto))) continue;
    preguntas.push({
      id: uid("PQ"),
      texto: q.texto.trim(),
      ...(q.campoId ? { campoId: q.campoId } : {}),
      opciones: q.opciones ?? [],
      estado: "pendiente",
    });
  }

  // Pregunta obligatoria de clasificación: la relación la decide el usuario.
  for (const p of personas) {
    if (p.relacion || preguntas.some((q) => q.personaId === p.id)) continue;
    preguntas.push({
      id: uid("PQ"),
      texto: `¿Qué relación tiene ${p.nombre} con el despacho?`,
      personaId: p.id,
      opciones: [
        "Lead",
        "Cliente",
        "Profesional / colaborador",
        "Tercero",
        "Contraparte",
        "Proveedor",
      ],
      estado: "pendiente",
    });
  }

  const conDocs: SesionIA = {
    ...sesion,
    documentos: sesion.documentos.map((d) =>
      d.id === documentoId
        ? { ...d, estado: "leido", tipoDocumental: lectura.tipoDocumental }
        : d,
    ),
    datos,
    personas,
    preguntas,
  };

  return traza(
    conDocs,
    "Lectura de documento",
    `${lectura.tipoDocumental}: ${lectura.campos.length} dato(s) y ${lectura.personas.length} persona(s) propuestos.`,
  );
}

/* ------------------------------------------------------------------ */
/* Validación campo por campo                                          */
/* ------------------------------------------------------------------ */

export function actualizarDato(
  sesion: SesionIA,
  datoId: string,
  cambios: Partial<DatoExtraido>,
): SesionIA {
  return {
    ...sesion,
    datos: sesion.datos.map((d) =>
      d.id === datoId
        ? {
            ...d,
            ...cambios,
            ...(cambios.estado === "confirmado"
              ? { validadoPor: sesion.usuario, validadoEn: ahoraIA() }
              : {}),
          }
        : d,
    ),
  };
}

export function datoManual(
  sesion: SesionIA,
  campoId: string,
  etiqueta: string,
  valor: string,
): SesionIA {
  const existente = sesion.datos.find((d) => d.campoId === campoId && !d.personaId);
  if (existente)
    return actualizarDato(sesion, existente.id, {
      valor,
      estado: "manual",
      corregido: true,
      claridad: "clara",
    });
  return {
    ...sesion,
    datos: [
      ...sesion.datos,
      {
        id: uid("DT"),
        campoId,
        etiqueta,
        valor,
        estado: "manual",
        claridad: "clara",
        versiones: [],
      },
    ],
  };
}

/** Datos listos para trasladar al formulario (confirmados o manuales). */
export function valoresAplicables(sesion: SesionIA): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const d of sesion.datos) {
    if (d.estado === "confirmado" || d.estado === "manual") salida[d.campoId] = d.valor;
  }
  return salida;
}
