// Capa de servicios del CRM. Hoy persiste en localStorage; la API es
// deliberadamente asíncrona-agnóstica y desacoplada para sustituirla más
// adelante por Lovable Cloud sin tocar los componentes.
import { useSyncExternalStore } from "react";

import {
  ACTIVIDADES,
  TAREAS,
  nombreContacto,

  type Prioridad,
  type Relacion,
} from "@/data/crm";
import {
  CHECKLIST_APERTURA,
  informacionInicialVacia,

  OPORTUNIDADES_MIGRADAS,
  UMBRALES_DEFECTO,
  citaVacia,
  contratacionVacia,
  fase as faseDef,
  gateOk,
  hoyTexto,
  presupuestoVacio,
  requisitosGate,
  sumarDias,
  type Cierre,
  type DocumentoInicial,
  type InformacionInicial,
  type IntervinienteOportunidad,
  type MensajeOportunidad,
  type RolEnOportunidad,
  type UrgenciaInicial,

  type EstadoOperativo,
  type EstadoPresupuestoEspejo,
  type EstadoTarea,
  type Excepcion,
  type FaseId,
  type OportunidadCRM,
  type ProximaAccion,
  type Requisito,
  type RolCRM,
  type TipoActividadCRM,
  type Umbrales,
  migrarFaseLegacy,
  type AceptacionLead,
} from "@/data/pipeline";

export type TareaCRM = {
  id: string;
  titulo: string;
  descripcion: string;
  notas: string;
  responsable: string;
  prioridad: Prioridad;
  estado: EstadoTarea;
  fechaPrevista: string;
  fechaLimite: string;
  relacion?: Relacion;
  creada: string;
  automatica?: boolean;
};

export type ActividadCRM = {
  id: string;
  tipo: TipoActividadCRM;
  fecha: string;
  hora: string;
  usuario: string;
  descripcion: string;
  resultado: string;
  proxima: string;
  relacion?: Relacion;
  automatica: boolean;
};

export type ExpedienteDemo = {
  id: string;
  codigo: string;
  oportunidadId: string;
  contactoId: string;
  titulo: string;
  area: string;
  responsable: string;
  fechaApertura: string;
  fase: string;
  /** Intervinientes trasladados desde la oportunidad (rol incluido). */
  intervinientes?: IntervinienteExpediente[];
  /** Documentos iniciales trasladados sin duplicar identidad. */
  documentos?: DocumentoInicial[];
};

export type IntervinienteExpediente = {
  contactoId?: string;
  nombre: string;
  /** Rol con el expediente, trasladado desde el rol en la oportunidad. */
  rol: string;
  aclaracion: string;
  principal: boolean;
};


export type CrmState = {
  version: number;
  oportunidades: OportunidadCRM[];
  tareas: TareaCRM[];
  actividades: ActividadCRM[];
  expedientes: ExpedienteDemo[];
  umbrales: Umbrales;
  rol: RolCRM;
  usuario: string;
  secuenciaExpediente: number;
};

const STORAGE_KEY = "patrimonial-suite-crm";
const VERSION = 4;

/* ------------------------------------------------------------------ */
/* Semilla de datos demo                                               */
/* ------------------------------------------------------------------ */

let contador = 1000;
const nuevoId = (prefijo: string) => `${prefijo}-${++contador}`;

type Extra = Partial<OportunidadCRM> & {
  id: string;
  titulo: string;
  contactoId: string;
  fase: FaseId;
  subestado: string;
};

function baseOportunidad(e: Extra): OportunidadCRM {
  const responsable = e.responsable ?? "Ana Torregrosa";
  return {
    codigo: e.id.replace("OP-", "OP-2026-"),
    area: "Sucesiones",
    responsable,
    etapa: "nuevo",
    prioridad: "Media",
    proximaActuacion: "",
    fechaSeguimiento: hoyTexto(),
    ultimaActividad: hoyTexto(),
    diasEnFase: 1,
    importeEstimado: "Por determinar",
    origen: "Formulario web",
    alertas: [],
    conflicto: "Sin conflicto",
    situacionDocumental: "Parcial",
    situacionPresupuesto: "Sin presupuesto",
    descripcion: "",
    antecedentes: "",
    objetivo: "",
    intervinientes: [],
    analisis: { viabilidad: "", complejidad: "", riesgos: "", recomendacion: "" },
    notas: [],
    historial: [
      {
        fecha: `${hoyTexto()} 08:30`,
        usuario: "Sistema",
        tipo: "Creación",
        descripcion: "Oportunidad de demostración creada",
      },
    ],
    estadoOperativo: "Debemos trabajo",
    proximaAccion: null,
    cualificacion: {
      comprobaciones: {},
      apta: null,
      motivo: "",
      resultado: "",
      conflictoResuelto: true,
      excepcionConflicto: "",
    },
    citaCRM: citaVacia(responsable),
    presupuestoEspejo: presupuestoVacio(),
    contratacion: contratacionVacia(),
    checklistApertura: {
      hoja: false,
      pago: false,
      datos: true,
      conflicto: true,
      tipo: false,
      area: true,
      responsable: true,
      documentacion: false,
    },
    excepciones: [],
    tipoExpediente: "",
    cierre: null,
    fechaEntrada: hoyTexto(),
    fechaCambioFase: hoyTexto(),
    etapaOriginal: "—",
    requiereRevisionIgor: false,
    documentacionPendiente: "",
    medioContacto: "Teléfono registrado en la ficha de contacto",
    ...e,
  } as OportunidadCRM;
}

function extras(): OportunidadCRM[] {
  const cual = (apta: boolean | null, motivo: string, resultado: string) => ({
    comprobaciones: Object.fromEntries(
      ["encaje", "conflicto", "plazo", "viabilidad", "capacidad", "interes", "documentacion"].map(
        (k) => [k, apta === true],
      ),
    ),
    apta,
    motivo,
    resultado,
    conflictoResuelto: true,
    excepcionConflicto: "",
  });

  return [
    baseOportunidad({
      id: "OP-1101",
      titulo: "Donación de vivienda a dos hijos con reserva de usufructo",
      contactoId: "CT-0004",
      area: "Planificación patrimonial",
      responsable: "Luis Ferrán",
      fase: "entrada",
      subestado: "Pendiente de datos",
      origen: "Notaría",
      descripcion:
        "La notaría remite a un matrimonio que desea donar la vivienda familiar reservándose el usufructo.",
      medioContacto: "",
      prioridad: "Media",
      proximaAccion: {
        descripcion: "Llamar para completar teléfono y NIF de los donatarios",
        tipo: "Llamada",
        responsable: "Nuria Casals",
        fechaPrevista: sumarDias(1),
        fechaLimite: sumarDias(3),
        prioridad: "Media",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-2),
    }),
    baseOportunidad({
      id: "OP-1102",
      titulo: "Consulta sobre extinción de condominio entre hermanos",
      contactoId: "CT-0007",
      area: "Inmobiliario",
      responsable: "Marta Solé",
      fase: "entrada",
      subestado: "Duplicado detectado",
      origen: "Recomendación de cliente",
      descripcion:
        "Entra por segunda vez en tres semanas; coincide con una consulta previa del mismo inmueble.",
      documentacionPendiente: "Falta nota simple actualizada.",
      proximaAccion: {
        descripcion: "Comprobar si duplica la consulta de julio y unificar registros",
        tipo: "Gestión administrativa",
        responsable: "Nuria Casals",
        fechaPrevista: sumarDias(0),
        fechaLimite: sumarDias(1),
        prioridad: "Alta",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-4),
    }),
    baseOportunidad({
      id: "OP-1103",
      titulo: "Impugnación de cuaderno particional",
      contactoId: "CT-0008",
      area: "Sucesiones",
      responsable: "Ana Torregrosa",
      fase: "cualificacion",
      subestado: "Pendiente de revisión interna",
      origen: "Colaborador",
      prioridad: "Alta",
      requiereRevisionIgor: true,
      descripcion:
        "Heredera disconforme con las adjudicaciones del contador partidor designado judicialmente.",
      cualificacion: cual(null, "Interés económico elevado, pero plazo muy ajustado.", ""),
      proximaAccion: {
        descripcion: "Revisión interna con Igor antes de ofrecer primera cita",
        tipo: "Revisión interna",
        responsable: "Igor Belmonte",
        fechaPrevista: sumarDias(1),
        fechaLimite: sumarDias(2),
        prioridad: "Alta",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-6),
    }),
    baseOportunidad({
      id: "OP-1104",
      titulo: "Reclamación de rentas impagadas de local comercial",
      contactoId: "CT-0002",
      area: "Inmobiliario",
      responsable: "Marta Solé",
      fase: "cualificacion",
      subestado: "Apta para primera cita",
      origen: "Cliente recurrente",
      importeEstimado: "4.500 € aprox.",
      cualificacion: cual(
        true,
        "Encaja en arrendamientos urbanos y el cliente ya trabaja con el despacho.",
        "Apta para primera cita",
      ),
      proximaAccion: {
        descripcion: "Proponer tres huecos de agenda para la primera cita",
        tipo: "Correo",
        responsable: "Nuria Casals",
        fechaPrevista: sumarDias(1),
        fechaLimite: "",
        prioridad: "Media",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-3),
    }),
    baseOportunidad({
      id: "OP-1105",
      titulo: "Planificación sucesoria de patrimonio agrícola",
      contactoId: "CT-0009",
      area: "Planificación patrimonial",
      responsable: "Ana Torregrosa",
      fase: "primera-cita",
      subestado: "Programada",
      origen: "Recomendación de cliente",
      importeEstimado: "9.000 € aprox.",
      cualificacion: cual(true, "Patrimonio relevante y encaje pleno.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Ana Torregrosa"),
        fecha: sumarDias(4),
        hora: "12:00",
        duracion: "90 minutos",
        modalidad: "Presencial",
        lugar: "Despacho — Sala Grande",
        asistentes: "Cliente y su hija",
        estado: "Programada",
        notasPrevias: "Traer escrituras de las fincas y último testamento.",
        sincronizacionCalendar: "Sincronizada (simulada)",
        tipoServicioPreliminar: "Planificación sucesoria",
      },
      proximaAccion: {
        descripcion: "Preparar guion de la primera cita",
        tipo: "Reunión",
        responsable: "Ana Torregrosa",
        fechaPrevista: sumarDias(3),
        fechaLimite: sumarDias(4),
        prioridad: "Media",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-2),
    }),
    baseOportunidad({
      id: "OP-1106",
      titulo: "Revisión de capitulaciones matrimoniales",
      contactoId: "CT-0010",
      area: "Familia y patrimonio",
      responsable: "Luis Ferrán",
      fase: "primera-cita",
      subestado: "Pendiente de resultado",
      origen: "Formulario web",
      cualificacion: cual(true, "Asunto sencillo y viable.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Luis Ferrán"),
        fecha: sumarDias(-1),
        hora: "17:00",
        duracion: "60 minutos",
        modalidad: "Videollamada",
        lugar: "Videollamada",
        asistentes: "Ambos cónyuges",
        estado: "Celebrada",
        tipoServicioPreliminar: "Capitulaciones",
      },
      proximaAccion: null,
      fechaCambioFase: sumarDias(-1),
    }),
    baseOportunidad({
      id: "OP-1107",
      titulo: "Constitución de sociedad patrimonial familiar",
      contactoId: "CT-0001",
      area: "Societario patrimonial",
      responsable: "Ana Torregrosa",
      fase: "validacion",
      subestado: "Pendiente de validación",
      origen: "Cliente recurrente",
      importeEstimado: "7.200 €",
      cualificacion: cual(true, "Cliente conocido, sin conflicto.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Ana Torregrosa"),
        fecha: sumarDias(-8),
        hora: "10:00",
        duracion: "60 minutos",
        modalidad: "Presencial",
        lugar: "Despacho",
        estado: "Celebrada",
        resumen: "Se acuerda estructura de holding con dos filiales.",
        resultado: "Solicitar presupuesto",
        autorizadaPresupuesto: true,
        tipoServicioPreliminar: "Constitución de holding",
      },
      presupuestoEspejo: {
        ...presupuestoVacio(),
        numero: "PR-2026-0031",
        servicio: "Constitución de holding familiar",
        importe: "7.200 €",
        estado: "Pendiente de validación",
        responsable: "Luis Ferrán",
        fechaSolicitud: sumarDias(-5),
        version: 1,
        historial: [
          { fecha: sumarDias(-5), usuario: "Ana Torregrosa", texto: "Solicitud de presupuesto" },
          { fecha: sumarDias(-2), usuario: "Luis Ferrán", texto: "Enviado a validación de Igor" },
        ],
        validadoVersion: 0,
        instrucciones: "Holding con dos filiales; incluir escrituras y alta censal.",
        prioridad: "Alta",
        fechaObjetivo: sumarDias(1),
      },
      requiereRevisionIgor: true,
      proximaAccion: {
        descripcion: "Igor debe validar el presupuesto PR-2026-0031",
        tipo: "Presupuesto",
        responsable: "Igor Belmonte",
        fechaPrevista: sumarDias(1),
        fechaLimite: sumarDias(2),
        prioridad: "Alta",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-5),
    }),
    baseOportunidad({
      id: "OP-1108",
      titulo: "Defensa en procedimiento de división de herencia",
      contactoId: "CT-0011",
      area: "Sucesiones",
      responsable: "Marta Solé",
      fase: "presupuesto",
      subestado: "Pendiente de información",
      origen: "Notaría",
      documentacionPendiente: "Faltan la declaración de herederos y el inventario provisional.",
      situacionDocumental: "Pendiente",
      cualificacion: cual(true, "Viable, pendiente de documentación.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Marta Solé"),
        fecha: sumarDias(-12),
        hora: "09:30",
        estado: "Celebrada",
        resultado: "Solicitar documentación",
        autorizadaPresupuesto: true,
        tipoServicioPreliminar: "División de herencia",
      },
      presupuestoEspejo: {
        ...presupuestoVacio(),
        numero: "PR-2026-0034",
        servicio: "División judicial de herencia",
        importe: "Por determinar",
        estado: "Bloqueado",
        responsable: "Marta Solé",
        fechaSolicitud: sumarDias(-10),
        version: 1,
        incidencia: "No puede cifrarse sin el inventario de bienes.",
        historial: [{ fecha: sumarDias(-10), usuario: "Marta Solé", texto: "Solicitud de presupuesto" }],
      },
      estadoOperativo: "Depende del cliente",
      proximaAccion: {
        descripcion: "Reclamar inventario provisional al cliente",
        tipo: "Solicitud de documentación",
        responsable: "Marta Solé",
        fechaPrevista: sumarDias(-3),
        fechaLimite: sumarDias(-1),
        prioridad: "Alta",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-16),
    }),
    baseOportunidad({
      id: "OP-1109",
      titulo: "Asesoramiento en compraventa de nave industrial",
      contactoId: "CT-0005",
      area: "Inmobiliario",
      responsable: "Luis Ferrán",
      fase: "contratacion",
      subestado: "Pendiente de respuesta",
      origen: "Administrador de fincas",
      importeEstimado: "5.400 €",
      estadoOperativo: "Depende del cliente",
      cualificacion: cual(true, "Operación clara.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Luis Ferrán"),
        fecha: sumarDias(-9),
        hora: "11:00",
        estado: "Celebrada",
        resultado: "Solicitar presupuesto",
        autorizadaPresupuesto: true,
        tipoServicioPreliminar: "Compraventa inmobiliaria",
      },
      presupuestoEspejo: {
        ...presupuestoVacio(),
        numero: "PR-2026-0028",
        servicio: "Asesoramiento en compraventa",
        importe: "5.400 €",
        estado: "Enviado",
        responsable: "Luis Ferrán",
        fechaSolicitud: sumarDias(-7),
        fechaEnvio: sumarDias(-4),
        version: 1,
        historial: [
          { fecha: sumarDias(-7), usuario: "Luis Ferrán", texto: "Solicitud de presupuesto" },
          { fecha: sumarDias(-4), usuario: "Igor Belmonte", texto: "Validado y enviado al cliente" },
        ],
        validadoVersion: 1,
        validadoPor: "Igor Belmonte",
        fechaValidacion: sumarDias(-5),
        versionEnviada: 1,
        destinatario: "Cliente (correo principal)",
        canal: "Correo electrónico",
        vigencia: sumarDias(11),
      },
      proximaAccion: {
        descripcion: "Llamada de seguimiento del presupuesto enviado",
        tipo: "Seguimiento",
        responsable: "Luis Ferrán",
        fechaPrevista: sumarDias(0),
        fechaLimite: sumarDias(2),
        prioridad: "Media",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-4),
    }),
    baseOportunidad({
      id: "OP-1110",
      titulo: "Reestructuración de préstamo hipotecario familiar",
      contactoId: "CT-0012",
      area: "Bancario y patrimonial",
      responsable: "Ana Torregrosa",
      fase: "presupuesto",
      subestado: "Rectificación solicitada",
      origen: "Recomendación de cliente",
      importeEstimado: "3.900 €",
      estadoOperativo: "En seguimiento",
      cualificacion: cual(true, "Encaja y hay margen económico.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Ana Torregrosa"),
        fecha: sumarDias(-20),
        hora: "16:00",
        estado: "Celebrada",
        resultado: "Solicitar presupuesto",
        autorizadaPresupuesto: true,
        tipoServicioPreliminar: "Negociación bancaria",
      },
      presupuestoEspejo: {
        ...presupuestoVacio(),
        numero: "PR-2026-0022",
        servicio: "Negociación con la entidad y novación",
        importe: "3.900 €",
        estado: "Requiere modificación",
        responsable: "Ana Torregrosa",
        fechaSolicitud: sumarDias(-18),
        fechaEnvio: sumarDias(-15),
        version: 2,
        incidencia: "El cliente pide fraccionar los honorarios en cuatro plazos.",
        historial: [
          { fecha: sumarDias(-18), usuario: "Ana Torregrosa", texto: "Solicitud de presupuesto" },
          { fecha: sumarDias(-15), usuario: "Igor Belmonte", texto: "Validado y enviado" },
          { fecha: sumarDias(-3), usuario: "Ana Torregrosa", texto: "Devuelto: requiere modificación" },
        ],
        validadoVersion: 1,
        validadoPor: "Igor Belmonte",
        fechaValidacion: sumarDias(-16),
        versionEnviada: 1,
        destinatario: "Cliente (correo principal)",
        canal: "Correo electrónico",
        rectificacion: "El cliente pide fraccionar los honorarios en cuatro plazos.",
      },
      contratacion: {
        ...contratacionVacia(),
        negociacion: "Solicita fraccionar honorarios y ampliar el alcance a la escritura de novación.",
        fechaSeguimiento: sumarDias(2),
      },
      proximaAccion: {
        descripcion: "Enviar presupuesto modificado con pago fraccionado",
        tipo: "Presupuesto",
        responsable: "Ana Torregrosa",
        fechaPrevista: sumarDias(1),
        fechaLimite: sumarDias(3),
        prioridad: "Alta",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-15),
    }),
    baseOportunidad({
      id: "OP-1111",
      titulo: "Pacto sucesorio y protocolo familiar de empresa hotelera",
      contactoId: "CT-0003",
      area: "Planificación patrimonial",
      responsable: "Ana Torregrosa",
      fase: "validacion",
      subestado: "Validado · Pendiente de envío",
      origen: "Cliente recurrente",
      importeEstimado: "14.500 €",
      estadoOperativo: "Depende del cliente",
      cualificacion: cual(true, "Cliente histórico.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Ana Torregrosa"),
        fecha: sumarDias(-25),
        hora: "10:00",
        estado: "Celebrada",
        resultado: "Solicitar presupuesto",
        autorizadaPresupuesto: true,
        tipoServicioPreliminar: "Protocolo familiar",
      },
      presupuestoEspejo: {
        ...presupuestoVacio(),
        numero: "PR-2026-0019",
        servicio: "Protocolo familiar y pacto sucesorio",
        importe: "14.500 €",
        estado: "Validado",
        responsable: "Ana Torregrosa",
        fechaSolicitud: sumarDias(-23),
        fechaEnvio: "",
        version: 1,
        historial: [{ fecha: sumarDias(-20), usuario: "Igor Belmonte", texto: "Validado por Igor" }],
        validadoVersion: 1,
        validadoPor: "Igor Belmonte",
        fechaValidacion: sumarDias(-20),
      },
      contratacion: {
        ...contratacionVacia(),
        decision: "Aceptado verbalmente",
        hojaEncargo: "Firmada",
        proforma: "Generada",
        pago: "Pendiente",
      },
      checklistApertura: {
        hoja: true,
        pago: false,
        datos: true,
        conflicto: true,
        tipo: true,
        area: true,
        responsable: true,
        documentacion: true,
      },
      tipoExpediente: "Planificación patrimonial",
      proximaAccion: {
        descripcion: "Comprobar la recepción de la provisión de fondos",
        tipo: "Gestión administrativa",
        responsable: "Nuria Casals",
        fechaPrevista: sumarDias(1),
        fechaLimite: sumarDias(4),
        prioridad: "Alta",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-6),
    }),
    baseOportunidad({
      id: "OP-1112",
      titulo: "Aceptación de herencia con bienes en el extranjero",
      contactoId: "CT-0006",
      area: "Sucesiones",
      responsable: "Marta Solé",
      fase: "ganada",
      subestado: "Presupuesto aceptado",
      origen: "Notaría",
      importeEstimado: "8.800 €",
      cualificacion: cual(true, "Sin conflicto y con documentación completa.", "Apta para primera cita"),
      situacionDocumental: "Completa",
      citaCRM: {
        ...citaVacia("Marta Solé"),
        fecha: sumarDias(-18),
        hora: "09:00",
        estado: "Celebrada",
        resultado: "Solicitar presupuesto",
        autorizadaPresupuesto: true,
        tipoServicioPreliminar: "Herencia internacional",
      },
      presupuestoEspejo: {
        ...presupuestoVacio(),
        numero: "PR-2026-0021",
        servicio: "Aceptación de herencia internacional",
        importe: "8.800 €",
        estado: "Enviado",
        responsable: "Marta Solé",
        fechaSolicitud: sumarDias(-16),
        fechaEnvio: sumarDias(-13),
        version: 1,
        historial: [{ fecha: sumarDias(-13), usuario: "Igor Belmonte", texto: "Validado y enviado" }],
      },
      contratacion: {
        ...contratacionVacia(),
        decision: "Aceptado verbalmente",
        hojaEncargo: "Firmada",
        proforma: "Generada",
        pago: "Recibido",
      },
      checklistApertura: {
        hoja: true,
        pago: true,
        datos: true,
        conflicto: true,
        tipo: true,
        area: true,
        responsable: true,
        documentacion: true,
      },
      tipoExpediente: "Sucesiones",
      aceptacion: {
        fecha: sumarDias(-2),
        version: 1,
        importe: "8.800 €",
        forma: "Correo electrónico",
        usuario: "Marta Solé",
        soporte: "Correo de aceptación del cliente de 2 días atrás.",
      },
      estadoOperativo: "En seguimiento",
      proximaAccion: {
        descripcion: "Iniciar Onboarding / Enviar proforma",
        tipo: "Gestión administrativa",
        responsable: "Marta Solé",
        fechaPrevista: sumarDias(0),
        fechaLimite: sumarDias(1),
        prioridad: "Alta",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-2),
    }),
    baseOportunidad({
      id: "OP-1113",
      titulo: "Segregación de finca rústica con excepción autorizada",
      contactoId: "CT-0007",
      area: "Inmobiliario",
      responsable: "Luis Ferrán",
      fase: "ganada",
      subestado: "Presupuesto aceptado",
      origen: "Colaborador",
      importeEstimado: "6.100 €",
      cualificacion: cual(true, "Cliente institucional de confianza.", "Apta para primera cita"),
      citaCRM: {
        ...citaVacia("Luis Ferrán"),
        fecha: sumarDias(-14),
        hora: "13:00",
        estado: "Celebrada",
        resultado: "Solicitar presupuesto",
        autorizadaPresupuesto: true,
        tipoServicioPreliminar: "Segregación",
      },
      presupuestoEspejo: {
        ...presupuestoVacio(),
        numero: "PR-2026-0025",
        servicio: "Segregación y licencias",
        importe: "6.100 €",
        estado: "Enviado",
        responsable: "Luis Ferrán",
        fechaSolicitud: sumarDias(-12),
        fechaEnvio: sumarDias(-9),
        version: 1,
        historial: [{ fecha: sumarDias(-9), usuario: "Igor Belmonte", texto: "Validado y enviado" }],
      },
      contratacion: {
        ...contratacionVacia(),
        decision: "Aceptado verbalmente",
        hojaEncargo: "Firmada",
        proforma: "Generada",
        pago: "Pendiente",
      },
      checklistApertura: {
        hoja: true,
        pago: false,
        datos: true,
        conflicto: true,
        tipo: true,
        area: true,
        responsable: true,
        documentacion: true,
      },
      excepciones: [
        {
          requisito: "pago",
          motivo: "Cliente institucional con pago aplazado a 30 días aprobado por dirección.",
          usuario: "Igor Belmonte",
          fecha: sumarDias(-1),
        },
      ],
      tipoExpediente: "Inmobiliario",
      aceptacion: {
        fecha: sumarDias(-1),
        version: 1,
        importe: "6.100 €",
        forma: "Documento firmado",
        usuario: "Luis Ferrán",
        soporte: "Conformidad firmada del presupuesto PR-2026-0025.",
      },
      revisionMigracion:
        "Migrado desde «Lista para apertura». Pago pendiente: se traslada al futuro Onboarding.",
      proximaAccion: {
        descripcion: "Iniciar Onboarding / Enviar proforma",
        tipo: "Gestión administrativa",
        responsable: "Luis Ferrán",
        fechaPrevista: sumarDias(1),
        fechaLimite: sumarDias(2),
        prioridad: "Media",
        estado: "Pendiente",
      },
      fechaCambioFase: sumarDias(-1),
    }),
    baseOportunidad({
      id: "OP-1114",
      titulo: "Testamento y planificación fiscal de matrimonio jubilado",
      contactoId: "CT-0009",
      area: "Planificación patrimonial",
      responsable: "Ana Torregrosa",
      fase: "cerrada",
      subestado: "Perdida por decisión del cliente",
      origen: "Formulario web",
      cierre: {
        tipo: "Perdida por decisión del cliente",
        motivo: "Precio",
        comentario: "Considera elevados los honorarios frente a una gestoría local.",
        fecha: sumarDias(-5),
        usuario: "Ana Torregrosa",
      },
      estadoOperativo: "En pausa",
      proximaAccion: null,
      fechaCambioFase: sumarDias(-5),
    }),
    baseOportunidad({
      id: "OP-1115",
      titulo: "Reclamación de responsabilidad a administrador societario",
      contactoId: "CT-0011",
      area: "Societario patrimonial",
      responsable: "Igor Belmonte",
      fase: "cerrada",
      subestado: "Descartada por el despacho",
      origen: "Recomendación de cliente",
      conflicto: "Conflicto detectado",
      cierre: {
        tipo: "Descartada por el despacho",
        motivo: "Conflicto de interés",
        comentario: "La sociedad demandada es cliente del despacho desde 2021.",
        fecha: sumarDias(-9),
        usuario: "Igor Belmonte",
      },
      estadoOperativo: "En pausa",
      proximaAccion: null,
      fechaCambioFase: sumarDias(-9),
    }),
    baseOportunidad({
      id: "OP-1116",
      titulo: "Consulta sobre arrendamiento de temporada",
      contactoId: "CT-0010",
      area: "Inmobiliario",
      responsable: "Marta Solé",
      fase: "cerrada",
      subestado: "Caducada",
      origen: "Formulario web",
      cierre: {
        tipo: "Caducada",
        motivo: "Silencio prolongado",
        comentario: "Tres intentos de contacto sin respuesta en seis semanas.",
        fecha: sumarDias(-12),
        usuario: "Marta Solé",
      },
      estadoOperativo: "En pausa",
      proximaAccion: null,
      fechaCambioFase: sumarDias(-12),
    }),
  ];
}

function semilla(): CrmState {
  const oportunidades = [...OPORTUNIDADES_MIGRADAS, ...extras()];
  const ganada = oportunidades.find((o) => o.fase === "ganada");
  const expedientes: ExpedienteDemo[] = ganada
    ? [
        {
          id: ganada.expedienteId ?? "EX-2026-0001",
          codigo: ganada.expedienteId ?? "EX-2026-0001",
          oportunidadId: ganada.id,
          contactoId: ganada.contactoId,
          titulo: ganada.titulo,
          area: ganada.area,
          responsable: ganada.responsable,
          fechaApertura: hoyTexto(),
          fase: "Onboarding",
        },
      ]
    : [];
  if (ganada && !ganada.expedienteId) ganada.expedienteId = "EX-2026-0001";

  const tareas: TareaCRM[] = [
    ...TAREAS.map<TareaCRM>((t) => ({
      id: t.id,
      titulo: t.titulo,
      descripcion: t.descripcion,
      notas: "",
      responsable: t.responsable,
      prioridad: t.prioridad,
      estado: t.estado === "En revisión" ? "En curso" : (t.estado as EstadoTarea),
      fechaPrevista: t.inicio ?? "",
      fechaLimite: t.limite ?? "",
      ...(t.relacion ? { relacion: t.relacion } : {}),
      creada: t.inicio ?? hoyTexto(),
    })),
    {
      id: "TK-900",
      titulo: "Seguimiento del presupuesto PR-2026-0028",
      descripcion: "Llamar al cliente para confirmar recepción y resolver dudas.",
      notas: "",
      responsable: "Luis Ferrán",
      prioridad: "Media",
      estado: "Pendiente",
      fechaPrevista: sumarDias(0),
      fechaLimite: sumarDias(3),
      relacion: { tipo: "Oportunidad", id: "OP-1109", label: "OP-2026-1109" },
      creada: sumarDias(-4),
      automatica: true,
    },
    {
      id: "TK-901",
      titulo: "Reclamar inventario provisional de bienes",
      descripcion: "Sin el inventario no puede cifrarse el presupuesto.",
      notas: "",
      responsable: "Marta Solé",
      prioridad: "Alta",
      estado: "Bloqueada",
      fechaPrevista: sumarDias(-3),
      fechaLimite: sumarDias(-1),
      relacion: { tipo: "Oportunidad", id: "OP-1108", label: "OP-2026-1108" },
      creada: sumarDias(-10),
    },
  ];

  const actividades: ActividadCRM[] = [
    ...ACTIVIDADES.map<ActividadCRM>((a) => ({
      id: a.id,
      tipo: (a.tipo === "Solicitud documental"
        ? "Solicitud de documentación"
        : a.tipo === "Envío de propuesta"
          ? "Presupuesto"
          : a.tipo === "Videollamada"
            ? "Reunión"
            : a.tipo === "Otra actividad"
              ? "Nota interna"
              : a.tipo) as TipoActividadCRM,
      fecha: a.fecha,
      hora: a.hora,
      usuario: a.responsable,
      descripcion: a.titulo,
      resultado: a.resultado ?? "",
      proxima: a.proxima ?? "",
      ...(a.relacion ? { relacion: a.relacion } : {}),
      automatica: false,
    })),
    {
      id: "AC-900",
      tipo: "Presupuesto",
      fecha: sumarDias(-4),
      hora: "12:10",
      usuario: "Igor Belmonte",
      descripcion: "Presupuesto PR-2026-0028 validado y enviado al cliente",
      resultado: "Enviado",
      proxima: "Seguimiento en 3 días",
      relacion: { tipo: "Oportunidad", id: "OP-1109", label: "OP-2026-1109" },
      automatica: true,
    },
    {
      id: "AC-901",
      tipo: "Primera cita",
      fecha: sumarDias(-1),
      hora: "17:00",
      usuario: "Luis Ferrán",
      descripcion: "Primera cita celebrada por videollamada sobre capitulaciones",
      resultado: "Pendiente de registrar el resultado",
      proxima: "",
      relacion: { tipo: "Oportunidad", id: "OP-1106", label: "OP-2026-1106" },
      automatica: false,
    },
  ];

  return {
    version: VERSION,
    oportunidades,
    tareas,
    actividades,
    expedientes,
    umbrales: { ...UMBRALES_DEFECTO },
    rol: "Administrador/Igor",
    usuario: "Igor Belmonte",
    secuenciaExpediente: expedientes.length,
  };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const semillaBase = semilla();
let estado: CrmState = semillaBase;
let hidratado = false;
const listeners = new Set<() => void>();

/**
 * Migración v3 → v4 del workflow de Leads: traduce las fases anteriores
 * (incluida «Lista para apertura») a las ocho fases vigentes sin perder
 * tareas, actividades, historial ni indicadores económicos.
 */
function migrarEstadoV4(parsed: CrmState): CrmState {
  const oportunidades = parsed.oportunidades.map((o) => {
    const destino = migrarFaseLegacy(String(o.fase), o.subestado);
    if (destino.fase === o.fase && destino.subestado === o.subestado) return o;
    return {
      ...o,
      fase: destino.fase,
      subestado: destino.subestado,
      ...(destino.revision ? { revisionMigracion: destino.revision } : {}),
      historial: [
        {
          fecha: ahora(),
          usuario: "Sistema",
          tipo: "Migración",
          detalle: `Migrado desde «${o.fase} · ${o.subestado}» a «${destino.fase} · ${destino.subestado}».`,
        },
        ...(o.historial ?? []),
      ],
    } as OportunidadCRM;
  });
  return { ...parsed, version: VERSION, oportunidades };
}

function leerAlmacen(): CrmState {
  if (typeof window === "undefined") return semillaBase;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return semilla();
    const parsed = JSON.parse(raw) as CrmState;
    if (parsed.version === VERSION) return parsed;
    if (parsed.version === 3 && Array.isArray(parsed.oportunidades)) return migrarEstadoV4(parsed);
    return semilla();
  } catch {
    return semilla();
  }
}


function persistir() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    /* almacenamiento no disponible */
  }
}

function emitir() {
  listeners.forEach((l) => l());
}

function set(fn: (s: CrmState) => CrmState) {
  estado = fn(estado);
  persistir();
  emitir();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

if (typeof window !== "undefined" && !hidratado) {
  hidratado = true;
  estado = leerAlmacen();
  persistir();
}

export function useCrm<T>(selector: (s: CrmState) => T): T {
  const snap = useSyncExternalStore(subscribe, () => estado, () => semillaBase);
  return selector(snap);
}

export const getEstado = () => estado;

/* ------------------------------------------------------------------ */
/* Utilidades internas                                                 */
/* ------------------------------------------------------------------ */

const ahora = () => `${hoyTexto()} ${new Date().toTimeString().slice(0, 5)}`;

function mapOp(id: string, fn: (o: OportunidadCRM) => OportunidadCRM) {
  set((s) => ({ ...s, oportunidades: s.oportunidades.map((o) => (o.id === id ? fn(o) : o)) }));
}

function hist(o: OportunidadCRM, tipo: string, descripcion: string, extra?: Partial<{ resultado: string; proxima: string }>) {
  return {
    ...o,
    historial: [
      ...o.historial,
      {
        fecha: ahora(),
        usuario: estado.usuario,
        tipo,
        descripcion,
        ...(extra?.resultado ? { resultado: extra.resultado } : {}),
        ...(extra?.proxima ? { proxima: extra.proxima } : {}),
      },
    ],
  };
}

function relacionDe(o: OportunidadCRM): Relacion {
  return { tipo: "Oportunidad", id: o.id, label: o.codigo };
}

function nuevaActividad(a: Omit<ActividadCRM, "id" | "fecha" | "hora" | "usuario">) {
  const act: ActividadCRM = {
    id: nuevoId("AC"),
    fecha: hoyTexto(),
    hora: new Date().toTimeString().slice(0, 5),
    usuario: estado.usuario,
    ...a,
  };

  set((s) => ({ ...s, actividades: [act, ...s.actividades] }));
  return act;
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export type ResultadoMovimiento = { ok: boolean; faltantes: Requisito[] };

export const crm = {
  reiniciar() {
    set(() => semilla());
  },
  setRol(rol: RolCRM, usuario: string) {
    set((s) => ({ ...s, rol, usuario }));
  },
  setUmbrales(u: Partial<Umbrales>) {
    set((s) => ({ ...s, umbrales: { ...s.umbrales, ...u } }));
  },

  puede(accion: string) {
    if (estado.rol === "Administrador/Igor") return true;
    const restringidas = [
      "Autorizar excepciones de apertura",
      "Reabrir oportunidades cerradas",
      "Modificar subestados automáticos",
      "Validar presupuestos",
      "Corregir una conversión errónea",
    ];
    return !restringidas.includes(accion);
  },

  comprobarGate(id: string, destino: FaseId): ResultadoMovimiento {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return { ok: false, faltantes: [] };
    const reqs = requisitosGate(o, destino);
    return { ok: reqs.every((r) => r.ok), faltantes: reqs.filter((r) => !r.ok) };
  },

  moverFase(id: string, destino: FaseId, opciones?: { motivo?: string; subestado?: string; forzar?: boolean }): ResultadoMovimiento {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return { ok: false, faltantes: [] };
    if (o.fase === destino) return { ok: true, faltantes: [] };
    const reqs = requisitosGate(o, destino);
    const retroceso = FASES_ORDEN.indexOf(destino) < FASES_ORDEN.indexOf(o.fase);
    if (!retroceso && !opciones?.forzar && !reqs.every((r) => r.ok))
      return { ok: false, faltantes: reqs.filter((r) => !r.ok) };

    const anterior = faseDef(o.fase).nombre;
    mapOp(id, (op) => {
      const sub = opciones?.subestado ?? faseDef(destino).subestados[0]!;
      const actualizado: OportunidadCRM = {
        ...op,
        fase: destino,
        subestado: sub,
        fechaCambioFase: hoyTexto(),
        diasEnFase: 0,
      };
      return hist(
        actualizado,
        "Cambio de fase",
        `${anterior} → ${faseDef(destino).nombre} · ${sub}${opciones?.motivo ? ` — Motivo: ${opciones.motivo}` : ""}`,
      );
    });
    nuevaActividad({
      tipo: "Cambio de fase",
      descripcion: `${o.codigo}: ${anterior} → ${faseDef(destino).nombre}`,
      resultado: opciones?.motivo ?? "",
      proxima: "",
      relacion: relacionDe(o),
      automatica: true,
    });
    return { ok: true, faltantes: [] };
  },

  actualizar(id: string, patch: Partial<OportunidadCRM>, nota?: string) {
    mapOp(id, (o) => {
      const actualizado = { ...o, ...patch };
      return nota ? hist(actualizado, "Actualización", nota) : actualizado;
    });
  },

  setSubestado(id: string, subestado: string) {
    mapOp(id, (o) => hist({ ...o, subestado }, "Subestado", `Subestado: ${subestado}`));
  },

  setEstadoOperativo(id: string, estadoOperativo: EstadoOperativo) {
    mapOp(id, (o) =>
      hist({ ...o, estadoOperativo }, "Estado operativo", `Estado operativo: ${estadoOperativo}`),
    );
  },

  setProximaAccion(id: string, accion: ProximaAccion | null, crearTarea = false) {
    mapOp(id, (o) =>
      hist(
        { ...o, proximaAccion: accion, proximaActuacion: accion?.descripcion ?? "" },
        "Próxima acción",
        accion ? `${accion.descripcion} (${accion.responsable}, ${accion.fechaPrevista})` : "Próxima acción eliminada",
      ),
    );
    if (accion && crearTarea) {
      const o = estado.oportunidades.find((x) => x.id === id);
      if (o)
        crm.crearTarea({
          titulo: accion.descripcion,
          descripcion: `Próxima acción de ${o.codigo}`,
          responsable: accion.responsable,
          prioridad: accion.prioridad,
          fechaPrevista: accion.fechaPrevista,
          fechaLimite: accion.fechaLimite,
          relacion: relacionDe(o),
        });
    }
  },

  guardarCualificacion(id: string, patch: Partial<OportunidadCRM["cualificacion"]>) {
    mapOp(id, (o) =>
      hist(
        { ...o, cualificacion: { ...o.cualificacion, ...patch } },
        "Cualificación",
        "Comprobaciones de cualificación actualizadas",
      ),
    );
  },

  guardarCita(id: string, patch: Partial<OportunidadCRM["citaCRM"]>, subestado?: string) {
    const o = estado.oportunidades.find((x) => x.id === id);
    mapOp(id, (op) => {
      const cita = { ...op.citaCRM, ...patch };
      const actualizado: OportunidadCRM = {
        ...op,
        citaCRM: cita,
        ...(subestado && op.fase === "primera-cita" ? { subestado } : {}),
      };
      return hist(actualizado, "Primera cita", patch.resultado ? `Resultado: ${patch.resultado}` : "Datos de la cita actualizados");
    });
    if (o)
      nuevaActividad({
        tipo: "Primera cita",
        descripcion: patch.resultado
          ? `Resultado de la primera cita: ${patch.resultado}`
          : `Primera cita ${patch.estado === "Programada" ? "programada" : "actualizada"} — ${o.codigo}`,
        resultado: patch.resultado ?? "",
        proxima: patch.proximoPaso ?? "",
        relacion: relacionDe(o),
        automatica: false,
      });
  },

  sincronizarCalendario(id: string) {
    mapOp(id, (o) =>
      hist(
        {
          ...o,
          citaCRM: { ...o.citaCRM, sincronizacionCalendar: "Sincronizada (simulada)" },
        },
        "Calendario",
        "Sincronización simulada con Google Calendar (integración pendiente de desarrollo)",
      ),
    );
  },

  solicitarPresupuesto(
    id: string,
    datos: {
      servicio: string;
      importe: string;
      responsable: string;
      notas?: string;
      prioridad?: string;
      fechaObjetivo?: string;
    },
  ) {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return;
    const numero = o.presupuestoEspejo.numero || `PR-2026-${String(4000 + estado.oportunidades.length).slice(-4)}`;
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          fase: op.fase === "primera-cita" || op.fase === "cualificacion" ? "presupuesto" : op.fase,
          subestado: op.fase === "contratacion" ? op.subestado : "Solicitado",
          fechaCambioFase: hoyTexto(),
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            numero,
            servicio: datos.servicio,
            importe: datos.importe,
            responsable: datos.responsable,
            estado: "Solicitado",
            fechaSolicitud: hoyTexto(),
            version: Math.max(op.presupuestoEspejo.version, 1),
            ...(datos.notas ? { instrucciones: datos.notas } : {}),
            ...(datos.prioridad ? { prioridad: datos.prioridad } : {}),
            ...(datos.fechaObjetivo ? { fechaObjetivo: datos.fechaObjetivo } : {}),
            rectificacion: "",
            historial: [
              ...op.presupuestoEspejo.historial,
              { fecha: hoyTexto(), usuario: estado.usuario, texto: `Solicitud enviada a ${datos.responsable}` },
            ],
          },
        },
        "Presupuesto",
        `Solicitud de presupuesto ${numero} — ${datos.servicio}`,
      ),
    );
    crm.crearTarea({
      titulo: `Elaborar presupuesto ${numero}`,
      descripcion: datos.notas ?? datos.servicio,
      responsable: datos.responsable,
      prioridad: "Alta",
      fechaPrevista: sumarDias(1),
      fechaLimite: sumarDias(estado.umbrales.primerAviso),
      relacion: relacionDe(o),
      automatica: true,
    });
    nuevaActividad({
      tipo: "Presupuesto",
      descripcion: `Presupuesto ${numero} solicitado a ${datos.responsable}`,
      resultado: "Solicitado",
      proxima: "Elaboración del presupuesto",
      relacion: relacionDe(o),
      automatica: true,
    });
  },

  cambiarEstadoPresupuesto(id: string, nuevo: EstadoPresupuestoEspejo, incidencia?: string) {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return;
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            estado: nuevo,
            incidencia: incidencia ?? (nuevo === "Bloqueado" || nuevo === "Requiere modificación" ? op.presupuestoEspejo.incidencia : ""),
            fechaEnvio: nuevo === "Enviado" ? hoyTexto() : op.presupuestoEspejo.fechaEnvio,
            version:
              nuevo === "Requiere modificación"
                ? op.presupuestoEspejo.version + 1
                : op.presupuestoEspejo.version,
            historial: [
              ...op.presupuestoEspejo.historial,
              { fecha: hoyTexto(), usuario: estado.usuario, texto: `Estado: ${nuevo}` },
            ],
          },
          ...(op.fase === "presupuesto" && nuevo !== "Enviado" ? { subestado: nuevo } : {}),
        },
        "Presupuesto",
        `Estado del presupuesto: ${nuevo}`,
      ),
    );

    if (nuevo === "Enviado") {
      // Automatización: el envío mueve la oportunidad a Contratación.
      crm.moverFase(id, "contratacion", { subestado: "Pendiente de respuesta", forzar: true });
      crm.setProximaAccion(id, {
        descripcion: `Primer seguimiento del presupuesto ${o.presupuestoEspejo.numero || ""}`.trim(),
        tipo: "Seguimiento",
        responsable: o.responsable,
        fechaPrevista: sumarDias(estado.umbrales.primerAviso),
        fechaLimite: sumarDias(estado.umbrales.tareaSeguimiento),
        prioridad: "Media",
        estado: "Pendiente",
      });
      crm.crearTarea({
        titulo: `Seguimiento del presupuesto enviado — ${o.codigo}`,
        descripcion: "Confirmar recepción, resolver dudas y recabar decisión del cliente.",
        responsable: o.responsable,
        prioridad: "Media",
        fechaPrevista: sumarDias(estado.umbrales.primerAviso),
        fechaLimite: sumarDias(estado.umbrales.tareaSeguimiento),
        relacion: relacionDe(o),
        automatica: true,
      });
      nuevaActividad({
        tipo: "Presupuesto",
        descripcion: `Presupuesto enviado al cliente — ${o.codigo}`,
        resultado: "Enviado",
        proxima: `Seguimiento en ${estado.umbrales.primerAviso} días`,
        relacion: relacionDe(o),
        automatica: true,
      });
    }
  },

  /** El presupuesto queda preparado: el Lead pasa a Validación (Igor). */
  enviarAValidacion(id: string, observaciones?: string): ResultadoMovimiento {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return { ok: false, faltantes: [] };
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          requiereRevisionIgor: true,
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            estado: "Pendiente de validación",
            ...(observaciones ? { incidencia: observaciones } : {}),
            historial: [
              ...op.presupuestoEspejo.historial,
              { fecha: hoyTexto(), usuario: estado.usuario, texto: "Enviado a validación de Igor" },
            ],
          },
        },
        "Presupuesto",
        "Presupuesto preparado y enviado a validación",
      ),
    );
    const r = crm.moverFase(id, "validacion", { subestado: "Pendiente de validación", forzar: true });
    crm.setProximaAccion(id, {
      descripcion: `Validar el presupuesto ${o.presupuestoEspejo.numero || ""}`.trim(),
      tipo: "Presupuesto",
      responsable: "Igor Belmonte",
      fechaPrevista: sumarDias(1),
      fechaLimite: sumarDias(2),
      prioridad: "Alta",
      estado: "Pendiente",
    });
    return r;
  },

  /** Igor valida la versión vigente. El Lead permanece en Validación. */
  validarPresupuesto(id: string, observaciones?: string): boolean {
    if (!crm.puede("Validar presupuestos")) return false;
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return false;
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          requiereRevisionIgor: false,
          subestado: op.fase === "validacion" ? "Validado · Pendiente de envío" : op.subestado,
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            estado: "Validado",
            validadoVersion: op.presupuestoEspejo.version,
            validadoPor: estado.usuario,
            fechaValidacion: hoyTexto(),
            rectificacion: "",
            historial: [
              ...op.presupuestoEspejo.historial,
              {
                fecha: hoyTexto(),
                usuario: estado.usuario,
                texto: `Versión ${op.presupuestoEspejo.version} validada${observaciones ? ` — ${observaciones}` : ""}`,
              },
            ],
          },
        },
        "Validación",
        `Presupuesto validado por ${estado.usuario}`,
      ),
    );
    crm.setProximaAccion(id, {
      descripcion: "Enviar el presupuesto al cliente",
      tipo: "Presupuesto",
      responsable: o.responsable,
      fechaPrevista: sumarDias(0),
      fechaLimite: sumarDias(1),
      prioridad: "Alta",
      estado: "Pendiente",
    });
    return true;
  },

  /** Igor devuelve el presupuesto: vuelve a Solicitud de presupuesto. */
  devolverParaRectificacion(id: string, instrucciones: string) {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return;
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          requiereRevisionIgor: false,
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            estado: "Requiere modificación",
            rectificacion: instrucciones,
            validadoVersion: 0,
            historial: [
              ...op.presupuestoEspejo.historial,
              { fecha: hoyTexto(), usuario: estado.usuario, texto: `Devuelto para rectificación: ${instrucciones}` },
            ],
          },
        },
        "Validación",
        `Devuelto para rectificación: ${instrucciones}`,
      ),
    );
    crm.moverFase(id, "presupuesto", { subestado: "Rectificación solicitada", forzar: true, motivo: instrucciones });
    crm.crearTarea({
      titulo: `Rectificar presupuesto ${o.presupuestoEspejo.numero || ""}`.trim(),
      descripcion: instrucciones,
      responsable: o.presupuestoEspejo.responsable || o.responsable,
      prioridad: "Alta",
      fechaPrevista: sumarDias(1),
      fechaLimite: sumarDias(2),
      relacion: relacionDe(o),
      automatica: true,
    });
  },

  /** Registro del envío real al cliente. Exige versión validada. */
  registrarEnvioPresupuesto(
    id: string,
    datos: { destinatario: string; canal: string; vigencia: string },
  ): ResultadoMovimiento {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return { ok: false, faltantes: [] };
    if (o.presupuestoEspejo.validadoVersion !== o.presupuestoEspejo.version)
      return { ok: false, faltantes: [{ label: "La versión vigente no está validada por Igor", ok: false }] };
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            estado: "Enviado",
            fechaEnvio: hoyTexto(),
            versionEnviada: op.presupuestoEspejo.version,
            destinatario: datos.destinatario,
            canal: datos.canal,
            vigencia: datos.vigencia,
            historial: [
              ...op.presupuestoEspejo.historial,
              {
                fecha: hoyTexto(),
                usuario: estado.usuario,
                texto: `Enviado a ${datos.destinatario} por ${datos.canal} (versión ${op.presupuestoEspejo.version})`,
              },
            ],
          },
        },
        "Presupuesto",
        `Presupuesto enviado al cliente por ${datos.canal}`,
      ),
    );
    return crm.moverFase(id, "contratacion", { subestado: "Pendiente de respuesta", forzar: true });
  },

  /** El cliente pide cambios: nueva versión y vuelta a Solicitud de presupuesto. */
  solicitarModificacionCliente(id: string, peticion: string, elaborador?: string) {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return;
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            estado: "Requiere modificación",
            version: op.presupuestoEspejo.version + 1,
            validadoVersion: 0,
            rectificacion: peticion,
            ...(elaborador ? { responsable: elaborador } : {}),
            historial: [
              ...op.presupuestoEspejo.historial,
              {
                fecha: hoyTexto(),
                usuario: estado.usuario,
                texto: `El cliente solicita cambios: ${peticion}. Nueva versión ${op.presupuestoEspejo.version + 1}`,
              },
            ],
          },
        },
        "Presupuesto",
        `Modificación solicitada por el cliente: ${peticion}`,
      ),
    );
    crm.moverFase(id, "presupuesto", { subestado: "Rectificación solicitada", forzar: true, motivo: peticion });
  },

  /** Aceptación del presupuesto por el cliente: cierra el Lead en Aceptado. */
  registrarAceptacion(id: string, datos: Omit<AceptacionLead, "usuario">): ResultadoMovimiento {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return { ok: false, faltantes: [] };
    if (!datos.version)
      return { ok: false, faltantes: [{ label: "Debe identificarse la versión aceptada", ok: false }] };
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          aceptacion: { ...datos, usuario: estado.usuario },
          presupuestoEspejo: {
            ...op.presupuestoEspejo,
            historial: [
              ...op.presupuestoEspejo.historial,
              {
                fecha: datos.fecha || hoyTexto(),
                usuario: estado.usuario,
                texto: `Versión ${datos.version} aceptada por el cliente (${datos.forma})`,
              },
            ],
          },
        },
        "Aceptación",
        `Presupuesto aceptado (versión ${datos.version}, ${datos.forma})`,
      ),
    );
    const r = crm.moverFase(id, "ganada", { subestado: "Presupuesto aceptado" });
    if (r.ok)
      crm.setProximaAccion(id, {
        descripcion: "Iniciar Onboarding / Enviar proforma",
        tipo: "Gestión administrativa",
        responsable: o.responsable,
        fechaPrevista: sumarDias(1),
        fechaLimite: sumarDias(3),
        prioridad: "Alta",
        estado: "Pendiente",
      });
    return r;
  },

  actualizarContratacion(id: string, patch: Partial<OportunidadCRM["contratacion"]>) {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return;
    mapOp(id, (op) => {
      const contratacion = { ...op.contratacion, ...patch };
      const checklist = {
        ...op.checklistApertura,
        hoja: contratacion.hojaEncargo === "Firmada" || contratacion.decision === "Aceptado verbalmente",
        pago: contratacion.pago === "Recibido",
      };
      let subestado = op.subestado;
      if (op.fase === "contratacion") {
        // Fase «Enviado al cliente»: proforma, pago y hoja de encargo son
        // indicadores económicos del futuro Onboarding, no subestados del Lead.
        if (contratacion.negociacion) subestado = "En negociación";
        else if (contratacion.fechaSeguimiento) subestado = "En seguimiento";
      }
      const actualizado: OportunidadCRM = { ...op, contratacion, checklistApertura: checklist, subestado };
      return hist(actualizado, "Contratación", `Seguimiento actualizado: ${subestado}`);
    });

    if (patch.pago === "Recibido") {
      nuevaActividad({
        tipo: "Seguimiento",
        descripcion: `Pago inicial registrado — ${o.codigo}`,
        resultado: "Pago recibido",
        proxima: "Indicador económico para Onboarding y Facturación",
        relacion: relacionDe(o),
        automatica: true,
      });
    }
    if (patch.decision === "Rechazado") {
      nuevaActividad({
        tipo: "Seguimiento",
        descripcion: `Presupuesto rechazado — ${o.codigo}`,
        resultado: patch.motivoRechazo ?? "",
        proxima: "Registrar el cierre de la oportunidad",
        relacion: relacionDe(o),
        automatica: true,
      });
    }
  },

  toggleChecklist(id: string, clave: string, valor: boolean) {
    mapOp(id, (o) => {
      const actualizado: OportunidadCRM = {
        ...o,
        checklistApertura: { ...o.checklistApertura, [clave]: valor },
      };
      return hist(actualizado, "Checklist de apertura", `${clave}: ${valor ? "cumplido" : "pendiente"}`);
    });
  },

  autorizarExcepcion(id: string, exc: Omit<Excepcion, "fecha">) {
    if (!crm.puede("Autorizar excepciones de apertura")) return false;
    mapOp(id, (o) => {
      const actualizado: OportunidadCRM = {
        ...o,
        excepciones: [...o.excepciones, { ...exc, fecha: ahora() }],
      };
      return hist(
        actualizado,
        "Excepción autorizada",
        `Requisito «${exc.requisito}» exceptuado por ${exc.usuario}: ${exc.motivo}`,
      );
    });
    return true;
  },

  convertirEnExpediente(id: string): { ok: boolean; faltantes: Requisito[]; expedienteId?: string } {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return { ok: false, faltantes: [] };
    if (o.expedienteId) return { ok: false, faltantes: [{ label: "Ya existe un expediente vinculado", ok: false }] };
    const reqs = requisitosGate(o, "ganada");
    if (!reqs.every((r) => r.ok)) return { ok: false, faltantes: reqs.filter((r) => !r.ok) };

    const secuencia = estado.secuenciaExpediente + 1;
    const codigo = `EX-2026-${String(secuencia).padStart(4, "0")}`;
    const expediente: ExpedienteDemo = {
      id: codigo,
      codigo,
      oportunidadId: o.id,
      contactoId: o.contactoId,
      titulo: o.titulo,
      area: o.area,
      responsable: o.responsable,
      fechaApertura: hoyTexto(),
      fase: "Onboarding",
      // El contacto no se duplica: se traslada la relación y su rol,
      // revisable y modificable ya dentro del expediente.
      intervinientes: [
        ...(o.contactoId
          ? [
              {
                contactoId: o.contactoId,
                nombre: nombreContacto(o.contactoId),
                rol: o.rolContacto?.rol || "Interesado principal",
                aclaracion: o.rolContacto?.aclaracion ?? "",
                principal: true,
              },
            ]
          : []),
        ...(o.otrosIntervinientes ?? []).map((i) => ({
          ...(i.contactoId ? { contactoId: i.contactoId } : {}),
          nombre: i.nombre,
          rol: i.rol || "Sin indicar",
          aclaracion: i.aclaracion,
          principal: false,
        })),
      ],
      documentos: o.documentosIniciales ?? [],
    };

    set((s) => ({
      ...s,
      secuenciaExpediente: secuencia,
      expedientes: [expediente, ...s.expedientes],
      oportunidades: s.oportunidades.map((x) =>
        x.id === id
          ? hist(
              {
                ...x,
                fase: "ganada",
                subestado: "Expediente creado",
                expedienteId: codigo,
                fechaConversion: hoyTexto(),
                fechaCambioFase: hoyTexto(),
                estadoOperativo: "En seguimiento",
                proximaAccion: null,
                proximaActuacion: "",
              },
              "Conversión en expediente",
              `Expediente ${codigo} creado a partir de la oportunidad`,
            )
          : x,
      ),
    }));
    nuevaActividad({
      tipo: "Conversión en expediente",
      descripcion: `Oportunidad ${o.codigo} convertida en el expediente ${codigo}`,
      resultado: "Ganada",
      proxima: "Iniciar onboarding",
      relacion: relacionDe(o),
      automatica: true,
    });
    return { ok: true, faltantes: [], expedienteId: codigo };
  },

  cerrar(id: string, cierre: Omit<Cierre, "fecha" | "usuario">) {
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return;
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          fase: "cerrada",
          subestado: cierre.tipo,
          estadoOperativo: "En pausa",
          proximaAccion: null,
          proximaActuacion: "",
          fechaCambioFase: hoyTexto(),
          cierre: { ...cierre, fecha: hoyTexto(), usuario: estado.usuario },
        },
        "Cierre",
        `${cierre.tipo} — ${cierre.motivo}${cierre.comentario ? `. ${cierre.comentario}` : ""}`,
      ),
    );
    nuevaActividad({
      tipo: "Cierre",
      descripcion: `Oportunidad ${o.codigo} cerrada: ${cierre.tipo}`,
      resultado: cierre.motivo,
      proxima: "",
      relacion: relacionDe(o),
      automatica: true,
    });
  },

  reabrir(
    id: string,
    datos: { motivo: string; faseDestino: FaseId; responsable: string; proximaAccion: ProximaAccion },
  ) {
    if (!crm.puede("Reabrir oportunidades cerradas")) return false;
    const o = estado.oportunidades.find((x) => x.id === id);
    if (!o) return false;
    mapOp(id, (op) =>
      hist(
        {
          ...op,
          fase: datos.faseDestino,
          subestado: faseDef(datos.faseDestino).subestados[0]!,
          responsable: datos.responsable,
          cierre: null,
          estadoOperativo: "Debemos trabajo",
          proximaAccion: datos.proximaAccion,
          proximaActuacion: datos.proximaAccion.descripcion,
          fechaCambioFase: hoyTexto(),
        },
        "Reapertura",
        `Reabierta en ${faseDef(datos.faseDestino).nombre}. Motivo: ${datos.motivo}`,
      ),
    );
    nuevaActividad({
      tipo: "Reapertura",
      descripcion: `Oportunidad ${o.codigo} reabierta en ${faseDef(datos.faseDestino).nombre}`,
      resultado: datos.motivo,
      proxima: datos.proximaAccion.descripcion,
      relacion: relacionDe(o),
      automatica: true,
    });
    return true;
  },

  /**
   * Alta de oportunidad. Ningún dato es obligatorio: la ficha puede
   * completarse después. Solo se exige un identificador interno.
   */
  crearOportunidad(datos: {
    titulo?: string;
    contactoId?: string;
    area?: string;
    responsable?: string;
    origen?: string;
    recomendadoPor?: string;
    prioridad?: Prioridad;
    descripcion?: string;
    medioContacto?: string;
    rolContacto?: RolEnOportunidad;
    otrosIntervinientes?: IntervinienteOportunidad[];
    informacionInicial?: InformacionInicial;
    urgencia?: UrgenciaInicial;
    documentosIniciales?: DocumentoInicial[];
    mensajes?: MensajeOportunidad[];
  }) {
    const id = nuevoId("OP");
    const info = datos.informacionInicial ?? informacionInicialVacia();
    const nueva = baseOportunidad({
      id,
      fase: "entrada",
      subestado: "Sin revisar",
      titulo: datos.titulo?.trim() || "Oportunidad sin título",
      contactoId: datos.contactoId ?? "",
      ...(datos.area ? { area: datos.area } : {}),
      ...(datos.responsable ? { responsable: datos.responsable } : {}),
      ...(datos.origen ? { origen: datos.origen } : {}),
      ...(datos.recomendadoPor ? { recomendadoPor: datos.recomendadoPor } : {}),
      ...(datos.prioridad ? { prioridad: datos.prioridad } : {}),
      ...(datos.medioContacto ? { medioContacto: datos.medioContacto } : {}),
      descripcion: datos.descripcion ?? info.queHaOcurrido,
      informacionInicial: info,
      ...(datos.rolContacto ? { rolContacto: datos.rolContacto } : {}),
      otrosIntervinientes: datos.otrosIntervinientes ?? [],
      ...(datos.urgencia ? { urgencia: datos.urgencia } : {}),
      documentosIniciales: datos.documentosIniciales ?? [],
      mensajes: datos.mensajes ?? [],
      intervinientes: [
        ...(datos.contactoId
          ? [
              {
                contactoId: datos.contactoId,
                nombre: nombreContacto(datos.contactoId),
                rol: datos.rolContacto?.rol || "Interesado principal",
              },
            ]
          : []),
        ...(datos.otrosIntervinientes ?? []).map((i) => ({
          ...(i.contactoId ? { contactoId: i.contactoId } : {}),
          nombre: i.nombre,
          rol: i.rol || "Sin indicar",
        })),
      ],
    });
    set((s) => ({ ...s, oportunidades: [nueva, ...s.oportunidades] }));
    nuevaActividad({
      tipo: "Nota interna",
      descripcion: `Oportunidad creada: ${nueva.titulo}`,
      resultado: "",
      proxima: "Revisar y asignar",
      relacion: { tipo: "Oportunidad", id, label: nueva.codigo },
      automatica: false,
    });
    return id;
  },

  /** Añade un mensaje a la conversación de la oportunidad. */
  añadirMensaje(id: string, m: Omit<MensajeOportunidad, "id">) {
    const mensaje: MensajeOportunidad = { id: nuevoId("MSG"), ...m };
    mapOp(id, (op) => ({ ...op, mensajes: [...(op.mensajes ?? []), mensaje] }));
    return mensaje.id;
  },


  crearTarea(t: Omit<TareaCRM, "id" | "estado" | "creada" | "notas"> & Partial<TareaCRM>) {
    const tarea: TareaCRM = {
      id: nuevoId("TK"),
      estado: "Pendiente",
      notas: "",
      creada: hoyTexto(),
      ...t,
    } as TareaCRM;
    set((s) => ({ ...s, tareas: [tarea, ...s.tareas] }));
    return tarea.id;
  },

  actualizarTarea(id: string, patch: Partial<TareaCRM>) {
    set((s) => ({ ...s, tareas: s.tareas.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  registrarActividad(a: {
    tipo: TipoActividadCRM;
    descripcion: string;
    resultado?: string;
    proxima?: string;
    relacion?: Relacion;
    fecha?: string;
    hora?: string;
  }) {
    nuevaActividad({
      tipo: a.tipo,
      descripcion: a.descripcion,
      resultado: a.resultado ?? "",
      proxima: a.proxima ?? "",
      ...(a.relacion ? { relacion: a.relacion } : {}),
      ...(a.fecha ? { fecha: a.fecha } : {}),
      ...(a.hora ? { hora: a.hora } : {}),
      automatica: false,
    });
  },
};

const FASES_ORDEN: FaseId[] = [
  "entrada",
  "cualificacion",
  "primera-cita",
  "presupuesto",
  "validacion",
  "contratacion",
  "ganada",
  "cerrada",
];

export const gateSuperado = gateOk;
