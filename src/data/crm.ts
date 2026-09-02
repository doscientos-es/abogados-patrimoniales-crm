// Datos de demostración del CRM LEX. Todo ficticio: no hay backend ni integraciones.
import { CONTACTOS, contactoPorId, nombreCompleto } from '@/data/contactos'

export type Prioridad = 'Alta' | 'Media' | 'Baja'
export type Tono = 'neutro' | 'exito' | 'aviso' | 'riesgo' | 'info'

export type Usuario = {
  id: string
  nombre: string
  iniciales: string
  rol: PerfilUsuario
}

export type PerfilUsuario =
  | 'Administrador'
  | 'Abogado responsable'
  | 'Abogado colaborador'
  | 'Personal administrativo'
  | 'Usuario de consulta'

export const USUARIOS: Usuario[] = [
  { id: 'U1', nombre: 'Igor Belmonte', iniciales: 'IB', rol: 'Administrador' },
  { id: 'U2', nombre: 'Ana Torregrosa', iniciales: 'AT', rol: 'Abogado responsable' },
  { id: 'U3', nombre: 'Luis Ferrán', iniciales: 'LF', rol: 'Abogado colaborador' },
  { id: 'U4', nombre: 'Marta Solé', iniciales: 'MS', rol: 'Abogado colaborador' },
  { id: 'U5', nombre: 'Nuria Casals', iniciales: 'NC', rol: 'Personal administrativo' },
  { id: 'U6', nombre: 'Pau Miralles', iniciales: 'PM', rol: 'Usuario de consulta' },
]

export const PERMISOS: {
  area: string
  perfiles: Record<PerfilUsuario, 'Total' | 'Lectura' | 'Sin acceso'>
}[] = [
  {
    area: 'Datos económicos',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Total',
      'Abogado colaborador': 'Lectura',
      'Personal administrativo': 'Lectura',
      'Usuario de consulta': 'Sin acceso',
    },
  },
  {
    area: 'Datos bancarios',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Lectura',
      'Abogado colaborador': 'Sin acceso',
      'Personal administrativo': 'Lectura',
      'Usuario de consulta': 'Sin acceso',
    },
  },
  {
    area: 'Notas confidenciales',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Total',
      'Abogado colaborador': 'Lectura',
      'Personal administrativo': 'Sin acceso',
      'Usuario de consulta': 'Sin acceso',
    },
  },
  {
    area: 'Informes de conflicto',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Total',
      'Abogado colaborador': 'Lectura',
      'Personal administrativo': 'Sin acceso',
      'Usuario de consulta': 'Sin acceso',
    },
  },
  {
    area: 'Documentos personales',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Total',
      'Abogado colaborador': 'Lectura',
      'Personal administrativo': 'Total',
      'Usuario de consulta': 'Lectura',
    },
  },
  {
    area: 'Validación de presupuestos',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Sin acceso',
      'Abogado colaborador': 'Sin acceso',
      'Personal administrativo': 'Sin acceso',
      'Usuario de consulta': 'Sin acceso',
    },
  },
  {
    area: 'Cierre y reapertura',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Total',
      'Abogado colaborador': 'Sin acceso',
      'Personal administrativo': 'Sin acceso',
      'Usuario de consulta': 'Sin acceso',
    },
  },
  {
    area: 'Eliminación de registros',
    perfiles: {
      Administrador: 'Total',
      'Abogado responsable': 'Sin acceso',
      'Abogado colaborador': 'Sin acceso',
      'Personal administrativo': 'Sin acceso',
      'Usuario de consulta': 'Sin acceso',
    },
  },
]

/* ------------------------------------------------------------------ */
/* Oportunidades                                                       */
/* ------------------------------------------------------------------ */

export type EtapaOportunidadId =
  | 'nuevo'
  | 'analisis'
  | 'aceptable'
  | 'cita-pendiente'
  | 'cita-programada'
  | 'cita-celebrada'
  | 'decision-interna'
  | 'presupuesto-solicitado'
  | 'presupuesto-tramitacion'
  | 'presupuesto-enviado'
  | 'pendiente-aceptacion'
  | 'pendiente-proforma'
  | 'proforma-enviada'
  | 'preparada-convertir'
  | 'convertida'
  | 'cerrada'

export const ETAPAS_OPORTUNIDAD: {
  id: EtapaOportunidadId
  nombre: string
  grupo: 'Captación' | 'Cita' | 'Presupuesto' | 'Cierre'
  tono: Tono
}[] = [
  { id: 'nuevo', nombre: 'Nuevo contacto', grupo: 'Captación', tono: 'info' },
  { id: 'analisis', nombre: 'Análisis preliminar', grupo: 'Captación', tono: 'info' },
  { id: 'aceptable', nombre: 'Aceptable a priori', grupo: 'Captación', tono: 'info' },
  { id: 'cita-pendiente', nombre: 'Primera cita pendiente', grupo: 'Cita', tono: 'aviso' },
  { id: 'cita-programada', nombre: 'Primera cita programada', grupo: 'Cita', tono: 'info' },
  { id: 'cita-celebrada', nombre: 'Primera cita celebrada', grupo: 'Cita', tono: 'neutro' },
  { id: 'decision-interna', nombre: 'Pendiente de decisión interna', grupo: 'Cita', tono: 'aviso' },
  {
    id: 'presupuesto-solicitado',
    nombre: 'Presupuesto solicitado',
    grupo: 'Presupuesto',
    tono: 'aviso',
  },
  {
    id: 'presupuesto-tramitacion',
    nombre: 'Presupuesto en tramitación',
    grupo: 'Presupuesto',
    tono: 'aviso',
  },
  { id: 'presupuesto-enviado', nombre: 'Presupuesto enviado', grupo: 'Presupuesto', tono: 'info' },
  {
    id: 'pendiente-aceptacion',
    nombre: 'Pendiente de aceptación',
    grupo: 'Presupuesto',
    tono: 'aviso',
  },
  {
    id: 'pendiente-proforma',
    nombre: 'Aceptado, pendiente de proforma',
    grupo: 'Presupuesto',
    tono: 'info',
  },
  {
    id: 'proforma-enviada',
    nombre: 'Proforma enviada, pendiente de pago',
    grupo: 'Presupuesto',
    tono: 'aviso',
  },
  {
    id: 'preparada-convertir',
    nombre: 'Pagado, preparado para convertir',
    grupo: 'Cierre',
    tono: 'exito',
  },
  { id: 'convertida', nombre: 'Convertida en expediente', grupo: 'Cierre', tono: 'exito' },
  { id: 'cerrada', nombre: 'Cerrada', grupo: 'Cierre', tono: 'riesgo' },
]

export const etapaOportunidad = (id: EtapaOportunidadId) =>
  ETAPAS_OPORTUNIDAD.find((e) => e.id === id) ??
  ({
    id,
    nombre: String(id),
    grupo: 'Captación',
    tono: 'neutro',
  } as (typeof ETAPAS_OPORTUNIDAD)[number])

export type Interviniente = { contactoId?: string; nombre: string; rol: string; nota?: string }

export type HistorialItem = {
  fecha: string
  usuario: string
  tipo: string
  descripcion: string
  relacionado?: string
  resultado?: string
  proxima?: string
}

export type PrimeraCita = {
  fecha: string
  hora: string
  duracion: string
  modalidad: 'Presencial' | 'Videollamada' | 'Telefónica'
  lugar: string
  responsable: string
  asistentes: string[]
  recordatorio: string
  notas: string
  celebrada: boolean
  resultado?: {
    resumen: string
    interes: 'Alto' | 'Medio' | 'Bajo'
    documentacionRevisada: string[]
    documentacionPendiente: string[]
    urgencias: string
    valoracion: string
    proximaActuacion: string
  }
}

export type Oportunidad = {
  id: string
  codigo: string
  titulo: string
  contactoId: string
  area: string
  responsable: string
  etapa: EtapaOportunidadId
  prioridad: Prioridad
  proximaActuacion: string
  fechaSeguimiento: string
  ultimaActividad: string
  diasEnFase: number
  importeEstimado: string
  origen: string
  alertas: string[]
  conflicto: 'Sin conflicto' | 'En revisión' | 'Conflicto detectado'
  situacionDocumental: 'Completa' | 'Parcial' | 'Pendiente'
  situacionPresupuesto: string
  descripcion: string
  antecedentes: string
  objetivo: string
  intervinientes: Interviniente[]
  analisis: { viabilidad: string; complejidad: string; riesgos: string; recomendacion: string }
  cita?: PrimeraCita
  presupuestoId?: string
  expedienteId?: string
  motivoCierre?: string
  notas: { fecha: string; autor: string; texto: string }[]
  historial: HistorialItem[]
}

export const OPORTUNIDADES: Oportunidad[] = [
  {
    id: 'OP-0001',
    codigo: 'OP-2026-0001',
    titulo: 'Reclamación de legítima sobre herencia familiar',
    contactoId: 'CT-0003',
    area: 'Sucesiones',
    responsable: 'Ana Torregrosa',
    etapa: 'nuevo',
    prioridad: 'Media',
    proximaActuacion: 'Llamada de cualificación',
    fechaSeguimiento: '07/08/2026',
    ultimaActividad: '04/08/2026 · Formulario web',
    diasEnFase: 2,
    importeEstimado: 'Por determinar',
    origen: 'Formulario web',
    alertas: ['Sin cualificar'],
    conflicto: 'En revisión',
    situacionDocumental: 'Pendiente',
    situacionPresupuesto: 'Sin presupuesto',
    descripcion:
      'Posible reclamación de legítima frente a los hermanos tras el fallecimiento del causante en 2025.',
    antecedentes: 'Testamento abierto de 2019. Existe cuaderno particional no aceptado.',
    objetivo: 'Determinar si procede acción de complemento de legítima.',
    intervinientes: [
      { contactoId: 'CT-0003', nombre: 'Ramón Iglesias Peña', rol: 'Potencial cliente' },
    ],
    analisis: {
      viabilidad: 'Pendiente de análisis',
      complejidad: 'Sin valorar',
      riesgos: 'Sin valorar',
      recomendacion: 'Cualificar por teléfono antes de agendar cita',
    },
    notas: [
      {
        fecha: '04/08/2026',
        autor: 'Nuria Casals',
        texto: 'Entra por formulario web a las 21:14.',
      },
    ],
    historial: [
      {
        fecha: '04/08/2026 21:14',
        usuario: 'Sistema',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada desde formulario web',
        proxima: 'Llamada de cualificación',
      },
    ],
  },
  {
    id: 'OP-0002',
    codigo: 'OP-2026-0002',
    titulo: 'Reorganización patrimonial familiar y protocolo',
    contactoId: 'CT-0001',
    area: 'Planificación patrimonial',
    responsable: 'Ana Torregrosa',
    etapa: 'cita-programada',
    prioridad: 'Alta',
    proximaActuacion: 'Primera cita presencial',
    fechaSeguimiento: '10/08/2026',
    ultimaActividad: '03/08/2026 · Correo de confirmación',
    diasEnFase: 3,
    importeEstimado: '12.000 € aprox.',
    origen: 'Cliente recurrente',
    alertas: ['Cita en 5 días'],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Parcial',
    situacionPresupuesto: 'Sin presupuesto',
    descripcion:
      'Reordenación de la estructura patrimonial familiar mediante holding y protocolo familiar.',
    antecedentes: 'Cliente con expediente previo de constitución societaria.',
    objetivo: 'Diseñar estructura y calendario de aportaciones.',
    intervinientes: [
      { contactoId: 'CT-0001', nombre: 'Elena Vargas Miralles', rol: 'Potencial cliente' },
      {
        contactoId: 'CT-0002',
        nombre: 'Inversiones Torrelodones, S.L.',
        rol: 'Sociedad del grupo',
      },
      { contactoId: 'CT-0006', nombre: 'Notaría Ruiz de Alda', rol: 'Notaría' },
    ],
    analisis: {
      viabilidad: 'Alta',
      complejidad: 'Media-alta',
      riesgos: 'Coste fiscal de las aportaciones no diferidas',
      recomendacion: 'Continuar. Preparar cita con documentación societaria',
    },
    cita: {
      fecha: '10/08/2026',
      hora: '10:30',
      duracion: '90 minutos',
      modalidad: 'Presencial',
      lugar: 'Despacho — Sala Grande',
      responsable: 'Ana Torregrosa',
      asistentes: ['Elena Vargas Miralles', 'Ana Torregrosa', 'Luis Ferrán'],
      recordatorio: '24 horas antes por correo',
      notas: 'Traer escrituras y últimas cuentas anuales.',
      celebrada: false,
    },
    notas: [
      {
        fecha: '03/08/2026',
        autor: 'Ana Torregrosa',
        texto: 'Confirma asistencia también el hijo mayor.',
      },
    ],
    historial: [
      {
        fecha: '01/08/2026 09:40',
        usuario: 'Ana Torregrosa',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '02/08/2026 12:05',
        usuario: 'Ana Torregrosa',
        tipo: 'Cambio de estado',
        descripcion: 'Análisis preliminar → Primera cita programada',
      },
      {
        fecha: '03/08/2026 17:22',
        usuario: 'Nuria Casals',
        tipo: 'Comunicación',
        descripcion: 'Correo de confirmación de cita',
        resultado: 'Confirmada',
        proxima: 'Celebrar cita 10/08',
      },
    ],
  },
  {
    id: 'OP-0003',
    codigo: 'OP-2026-0003',
    titulo: 'Impugnación de acuerdos de junta de propietarios',
    contactoId: 'CT-0007',
    area: 'Propiedad horizontal',
    responsable: 'Luis Ferrán',
    etapa: 'presupuesto-solicitado',
    prioridad: 'Alta',
    proximaActuacion: 'Recibir presupuesto de elaboración',
    fechaSeguimiento: '06/08/2026',
    ultimaActividad: '04/08/2026 · Solicitud de presupuesto',
    diasEnFase: 1,
    importeEstimado: '4.500 € aprox.',
    origen: 'Administrador de fincas',
    alertas: ['Plazo de impugnación corto'],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Parcial',
    situacionPresupuesto: 'Solicitado el 04/08/2026',
    descripcion: 'Impugnación de los acuerdos adoptados en junta extraordinaria de julio.',
    antecedentes: 'Acta de la junta y burofax previo de oposición.',
    objetivo: 'Dejar sin efecto la derrama aprobada.',
    intervinientes: [
      {
        contactoId: 'CT-0007',
        nombre: 'Gestión de Fincas Levante, S.L.U.',
        rol: 'Potencial cliente',
      },
      { contactoId: 'CT-0005', nombre: 'Alfonso Rueda Barcina', rol: 'Procurador propuesto' },
    ],
    analisis: {
      viabilidad: 'Media',
      complejidad: 'Media',
      riesgos: 'Cómputo del plazo de impugnación',
      recomendacion: 'Presupuestar con carácter urgente',
    },
    cita: {
      fecha: '31/07/2026',
      hora: '12:00',
      duracion: '60 minutos',
      modalidad: 'Videollamada',
      lugar: 'Enlace de videollamada interna',
      responsable: 'Luis Ferrán',
      asistentes: ['Gestión de Fincas Levante', 'Luis Ferrán'],
      recordatorio: '1 hora antes',
      notas: 'Revisar acta y convocatoria.',
      celebrada: true,
      resultado: {
        resumen: 'Se revisan acta y convocatoria; hay defectos formales en la convocatoria.',
        interes: 'Alto',
        documentacionRevisada: ['Acta de la junta', 'Convocatoria'],
        documentacionPendiente: ['Justificante de recepción del burofax'],
        urgencias: 'Plazo de impugnación próximo',
        valoracion: 'Asunto viable con reservas',
        proximaActuacion: 'Solicitar presupuesto',
      },
    },
    presupuestoId: 'PR-0002',
    notas: [{ fecha: '04/08/2026', autor: 'Luis Ferrán', texto: 'Prioridad alta por plazo.' }],
    historial: [
      {
        fecha: '28/07/2026 10:00',
        usuario: 'Luis Ferrán',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '31/07/2026 13:10',
        usuario: 'Luis Ferrán',
        tipo: 'Actividad',
        descripcion: 'Primera cita celebrada',
        resultado: 'Asunto viable con reservas',
        proxima: 'Solicitar presupuesto',
      },
      {
        fecha: '04/08/2026 09:15',
        usuario: 'Luis Ferrán',
        tipo: 'Presupuesto',
        descripcion: 'Solicitud de presupuesto PR-2026-0002',
      },
    ],
  },
  {
    id: 'OP-0004',
    codigo: 'OP-2026-0004',
    titulo: 'Reclamación de cantidad por incumplimiento de contrato',
    contactoId: 'CT-0011',
    area: 'Contratación civil',
    responsable: 'Marta Solé',
    etapa: 'presupuesto-enviado',
    prioridad: 'Media',
    proximaActuacion: 'Llamada de seguimiento del presupuesto',
    fechaSeguimiento: '08/08/2026',
    ultimaActividad: '02/08/2026 · Presupuesto enviado',
    diasEnFase: 3,
    importeEstimado: '6.200 €',
    origen: 'Recomendación de cliente',
    alertas: ['Sin respuesta desde hace 3 días'],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Completa',
    situacionPresupuesto: 'Enviado el 02/08/2026 — pendiente de respuesta',
    descripcion: 'Reclamación frente al contratista por obra defectuosa y retrasos.',
    antecedentes: 'Contrato de ejecución de obra y actas de recepción con reservas.',
    objetivo: 'Recuperar el sobrecoste y los daños acreditados.',
    intervinientes: [
      { contactoId: 'CT-0011', nombre: 'Jorge Landa Etxeberria', rol: 'Potencial cliente' },
      { contactoId: 'CT-0004', nombre: 'Beatriz Cañete Ordóñez', rol: 'Abogada de la contraparte' },
      { contactoId: 'CT-0008', nombre: 'Peritaciones Delta, S.L.', rol: 'Perito propuesto' },
    ],
    analisis: {
      viabilidad: 'Alta',
      complejidad: 'Media',
      riesgos: 'Solvencia de la contraparte',
      recomendacion: 'Aceptar el encargo con provisión inicial',
    },
    presupuestoId: 'PR-0003',
    notas: [
      { fecha: '02/08/2026', autor: 'Marta Solé', texto: 'Cliente pide desglose por fases.' },
    ],
    historial: [
      {
        fecha: '20/07/2026 11:30',
        usuario: 'Marta Solé',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '02/08/2026 16:00',
        usuario: 'Nuria Casals',
        tipo: 'Presupuesto',
        descripcion: 'Presupuesto PR-2026-0003 enviado al cliente',
        proxima: 'Seguimiento 08/08',
      },
    ],
  },
  {
    id: 'OP-0005',
    codigo: 'OP-2026-0005',
    titulo: 'Planificación sucesoria y testamento',
    contactoId: 'CT-0001',
    area: 'Sucesiones',
    responsable: 'Ana Torregrosa',
    etapa: 'proforma-enviada',
    prioridad: 'Alta',
    proximaActuacion: 'Confirmar pago de la proforma',
    fechaSeguimiento: '06/08/2026',
    ultimaActividad: '03/08/2026 · Proforma enviada',
    diasEnFase: 2,
    importeEstimado: '3.800 €',
    origen: 'Cliente recurrente',
    alertas: ['Proforma pendiente de pago'],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Completa',
    situacionPresupuesto: 'Aceptado — proforma enviada',
    descripcion:
      'Otorgamiento de testamento y planificación de la sucesión del patrimonio inmobiliario.',
    antecedentes: 'Cliente con inventario patrimonial actualizado en 2025.',
    objetivo: 'Otorgar testamento y documento de últimas voluntades.',
    intervinientes: [
      { contactoId: 'CT-0001', nombre: 'Elena Vargas Miralles', rol: 'Cliente' },
      { contactoId: 'CT-0006', nombre: 'Notaría Ruiz de Alda', rol: 'Notaría' },
    ],
    analisis: {
      viabilidad: 'Alta',
      complejidad: 'Baja',
      riesgos: 'Ninguno relevante',
      recomendacion: 'Aceptar',
    },
    presupuestoId: 'PR-0004',
    notas: [],
    historial: [
      {
        fecha: '15/07/2026 09:00',
        usuario: 'Ana Torregrosa',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '01/08/2026 10:20',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Presupuesto validado',
      },
      {
        fecha: '03/08/2026 12:00',
        usuario: 'Nuria Casals',
        tipo: 'Facturación',
        descripcion: 'Proforma PF-2026-0011 enviada',
      },
    ],
  },
  {
    id: 'OP-0006',
    codigo: 'OP-2026-0006',
    titulo: 'Compraventa de local comercial y due diligence',
    contactoId: 'CT-0002',
    area: 'Inmobiliario',
    responsable: 'Luis Ferrán',
    etapa: 'preparada-convertir',
    prioridad: 'Alta',
    proximaActuacion: 'Abrir expediente e iniciar onboarding',
    fechaSeguimiento: '05/08/2026',
    ultimaActividad: '04/08/2026 · Pago recibido',
    diasEnFase: 1,
    importeEstimado: '9.500 €',
    origen: 'Notaría',
    alertas: ['Lista para convertir'],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Completa',
    situacionPresupuesto: 'Pagado íntegramente',
    descripcion:
      'Adquisición de local comercial con revisión registral, urbanística y arrendaticia.',
    antecedentes: 'Arras firmadas el 25/07/2026.',
    objetivo: 'Cerrar la compraventa en escritura pública antes de octubre.',
    intervinientes: [
      { contactoId: 'CT-0002', nombre: 'Inversiones Torrelodones, S.L.', rol: 'Cliente' },
      { contactoId: 'CT-0006', nombre: 'Notaría Ruiz de Alda', rol: 'Notaría' },
      { contactoId: 'CT-0005', nombre: 'Alfonso Rueda Barcina', rol: 'Colaborador' },
    ],
    analisis: {
      viabilidad: 'Alta',
      complejidad: 'Media',
      riesgos: 'Cargas registrales pendientes de cancelar',
      recomendacion: 'Aceptar y abrir expediente',
    },
    presupuestoId: 'PR-0005',
    notas: [
      { fecha: '04/08/2026', autor: 'Nuria Casals', texto: 'Transferencia recibida por el total.' },
    ],
    historial: [
      {
        fecha: '10/07/2026 08:45',
        usuario: 'Luis Ferrán',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '28/07/2026 11:00',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Presupuesto validado',
      },
      {
        fecha: '01/08/2026 09:30',
        usuario: 'Cliente',
        tipo: 'Aceptación',
        descripcion: 'Presupuesto aceptado por el cliente',
      },
      {
        fecha: '04/08/2026 10:10',
        usuario: 'Nuria Casals',
        tipo: 'Cobro',
        descripcion: 'Pago íntegro recibido',
        proxima: 'Abrir expediente',
      },
    ],
  },
  {
    id: 'OP-0007',
    codigo: 'OP-2026-0007',
    titulo: 'Asesoramiento fiscal en donación de inmueble',
    contactoId: 'CT-0011',
    area: 'Fiscal patrimonial',
    responsable: 'Marta Solé',
    etapa: 'cerrada',
    prioridad: 'Baja',
    proximaActuacion: '—',
    fechaSeguimiento: '—',
    ultimaActividad: '22/07/2026 · Cierre',
    diasEnFase: 14,
    importeEstimado: '1.200 €',
    origen: 'Recomendación de cliente',
    alertas: [],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Parcial',
    situacionPresupuesto: 'Rechazado',
    descripcion: 'Consulta sobre el coste fiscal de la donación de un inmueble a los hijos.',
    antecedentes: 'Consulta puntual.',
    objetivo: 'Cuantificar el coste fiscal.',
    intervinientes: [
      { contactoId: 'CT-0011', nombre: 'Jorge Landa Etxeberria', rol: 'Potencial cliente' },
    ],
    analisis: {
      viabilidad: 'Alta',
      complejidad: 'Baja',
      riesgos: 'Ninguno',
      recomendacion: 'Aceptar',
    },
    motivoCierre: 'Precio — el cliente opta por su asesoría habitual',
    notas: [],
    historial: [
      {
        fecha: '05/07/2026 10:00',
        usuario: 'Marta Solé',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '22/07/2026 18:00',
        usuario: 'Marta Solé',
        tipo: 'Cierre',
        descripcion: 'Cerrada por precio',
        resultado: 'Perdida',
      },
    ],
  },
  {
    id: 'OP-0008',
    codigo: 'OP-2026-0008',
    titulo: 'División de cosa común entre coherederos',
    contactoId: 'CT-0003',
    area: 'Civil patrimonial',
    responsable: 'Ana Torregrosa',
    etapa: 'analisis',
    prioridad: 'Media',
    proximaActuacion: 'Comprobación de conflicto de intereses',
    fechaSeguimiento: '06/08/2026',
    ultimaActividad: '30/07/2026 · Llamada inicial',
    diasEnFase: 6,
    importeEstimado: 'Por determinar',
    origen: 'Recomendación de colaborador',
    alertas: ['Posible conflicto de intereses', '6 días sin actividad'],
    conflicto: 'Conflicto detectado',
    situacionDocumental: 'Pendiente',
    situacionPresupuesto: 'Sin presupuesto',
    descripcion:
      'Acción de división de cosa común sobre finca proindiviso entre cuatro coherederos.',
    antecedentes: 'Uno de los coherederos ya es cliente del despacho.',
    objetivo: 'Valorar si el despacho puede intervenir.',
    intervinientes: [
      { contactoId: 'CT-0003', nombre: 'Ramón Iglesias Peña', rol: 'Potencial cliente' },
    ],
    analisis: {
      viabilidad: 'Pendiente',
      complejidad: 'Media',
      riesgos: 'Conflicto con cliente existente',
      recomendacion: 'No continuar hasta resolver el conflicto',
    },
    notas: [
      {
        fecha: '30/07/2026',
        autor: 'Ana Torregrosa',
        texto: 'Elevar a comité el posible conflicto.',
      },
    ],
    historial: [
      {
        fecha: '30/07/2026 09:00',
        usuario: 'Ana Torregrosa',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '30/07/2026 12:00',
        usuario: 'Ana Torregrosa',
        tipo: 'Alerta',
        descripcion: 'Posible conflicto de intereses',
      },
    ],
  },
  {
    id: 'OP-0009',
    codigo: 'OP-2026-0009',
    titulo: 'Reclamación de rentas impagadas de local',
    contactoId: 'CT-0007',
    area: 'Arrendamientos',
    responsable: 'Luis Ferrán',
    etapa: 'pendiente-aceptacion',
    prioridad: 'Media',
    proximaActuacion: 'Recordatorio de decisión al cliente',
    fechaSeguimiento: '09/08/2026',
    ultimaActividad: '29/07/2026 · Presupuesto enviado',
    diasEnFase: 7,
    importeEstimado: '3.100 €',
    origen: 'Administrador de fincas',
    alertas: ['7 días sin respuesta'],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Parcial',
    situacionPresupuesto: 'Enviado — pendiente de aceptación',
    descripcion: 'Reclamación de rentas y desahucio por falta de pago de local comercial.',
    antecedentes: 'Cuatro mensualidades impagadas.',
    objetivo: 'Recuperar la posesión y las rentas.',
    intervinientes: [
      {
        contactoId: 'CT-0007',
        nombre: 'Gestión de Fincas Levante, S.L.U.',
        rol: 'Potencial cliente',
      },
    ],
    analisis: {
      viabilidad: 'Alta',
      complejidad: 'Baja',
      riesgos: 'Insolvencia del arrendatario',
      recomendacion: 'Aceptar',
    },
    presupuestoId: 'PR-0006',
    notas: [],
    historial: [
      {
        fecha: '18/07/2026 10:00',
        usuario: 'Luis Ferrán',
        tipo: 'Creación',
        descripcion: 'Oportunidad creada',
      },
      {
        fecha: '29/07/2026 09:00',
        usuario: 'Nuria Casals',
        tipo: 'Presupuesto',
        descripcion: 'Presupuesto enviado',
      },
    ],
  },
  {
    id: 'OP-0010',
    codigo: 'OP-2026-0010',
    titulo: 'Constitución de sociedad patrimonial',
    contactoId: 'CT-0001',
    area: 'Societario',
    responsable: 'Ana Torregrosa',
    etapa: 'convertida',
    prioridad: 'Media',
    proximaActuacion: 'Seguimiento del expediente EX-2026-0001',
    fechaSeguimiento: '—',
    ultimaActividad: '12/06/2026 · Conversión en expediente',
    diasEnFase: 54,
    importeEstimado: '5.400 €',
    origen: 'Cliente recurrente',
    alertas: [],
    conflicto: 'Sin conflicto',
    situacionDocumental: 'Completa',
    situacionPresupuesto: 'Pagado',
    descripcion: 'Constitución de sociedad patrimonial para la tenencia de inmuebles.',
    antecedentes: '—',
    objetivo: 'Constituir la sociedad e inscribirla.',
    intervinientes: [{ contactoId: 'CT-0001', nombre: 'Elena Vargas Miralles', rol: 'Cliente' }],
    analisis: {
      viabilidad: 'Alta',
      complejidad: 'Baja',
      riesgos: 'Ninguno',
      recomendacion: 'Aceptar',
    },
    presupuestoId: 'PR-0001',
    expedienteId: 'EX-0002',
    notas: [],
    historial: [
      {
        fecha: '12/06/2026 12:00',
        usuario: 'Ana Torregrosa',
        tipo: 'Conversión',
        descripcion: 'Convertida en expediente EX-2026-0002',
      },
    ],
  },
]

export const oportunidadPorId = (id: string) => OPORTUNIDADES.find((o) => o.id === id)

/* ------------------------------------------------------------------ */
/* Presupuestos                                                        */
/* ------------------------------------------------------------------ */

export type EstadoPresupuestoId =
  | 'solicitado'
  | 'asignado'
  | 'elaboracion'
  | 'pendiente-info'
  | 'pendiente-validacion'
  | 'devuelto'
  | 'validado'
  | 'enviado'
  | 'pendiente-respuesta'
  | 'modificacion'
  | 'aceptado'
  | 'proforma-pendiente'
  | 'proforma-enviada'
  | 'pago-parcial'
  | 'pagado'
  | 'rechazado'
  | 'caducado'
  | 'cancelado'

export const ESTADOS_PRESUPUESTO: {
  id: EstadoPresupuestoId
  nombre: string
  grupo: 'Elaboración' | 'Validación' | 'Cliente' | 'Cobro' | 'Fin'
  tono: Tono
}[] = [
  { id: 'solicitado', nombre: 'Solicitado', grupo: 'Elaboración', tono: 'info' },
  { id: 'asignado', nombre: 'Asignado', grupo: 'Elaboración', tono: 'info' },
  { id: 'elaboracion', nombre: 'En elaboración', grupo: 'Elaboración', tono: 'info' },
  { id: 'pendiente-info', nombre: 'Pendiente de información', grupo: 'Elaboración', tono: 'aviso' },
  {
    id: 'pendiente-validacion',
    nombre: 'Pendiente de validación',
    grupo: 'Validación',
    tono: 'aviso',
  },
  { id: 'devuelto', nombre: 'Devuelto para rectificación', grupo: 'Validación', tono: 'riesgo' },
  { id: 'validado', nombre: 'Validado', grupo: 'Validación', tono: 'exito' },
  { id: 'enviado', nombre: 'Enviado al cliente', grupo: 'Cliente', tono: 'info' },
  { id: 'pendiente-respuesta', nombre: 'Pendiente de respuesta', grupo: 'Cliente', tono: 'aviso' },
  { id: 'modificacion', nombre: 'En modificación', grupo: 'Cliente', tono: 'aviso' },
  { id: 'aceptado', nombre: 'Aceptado', grupo: 'Cliente', tono: 'exito' },
  { id: 'proforma-pendiente', nombre: 'Proforma pendiente', grupo: 'Cobro', tono: 'aviso' },
  { id: 'proforma-enviada', nombre: 'Proforma enviada', grupo: 'Cobro', tono: 'aviso' },
  { id: 'pago-parcial', nombre: 'Pago parcial', grupo: 'Cobro', tono: 'aviso' },
  { id: 'pagado', nombre: 'Pagado', grupo: 'Cobro', tono: 'exito' },
  { id: 'rechazado', nombre: 'Rechazado', grupo: 'Fin', tono: 'riesgo' },
  { id: 'caducado', nombre: 'Caducado', grupo: 'Fin', tono: 'riesgo' },
  { id: 'cancelado', nombre: 'Cancelado', grupo: 'Fin', tono: 'neutro' },
]

export const estadoPresupuesto = (id: EstadoPresupuestoId) =>
  ESTADOS_PRESUPUESTO.find((e) => e.id === id) ??
  ({
    id,
    nombre: String(id),
    grupo: 'Elaboración',
    tono: 'neutro',
  } as (typeof ESTADOS_PRESUPUESTO)[number])

export const TIPOS_PRESUPUESTO = [
  'Presupuesto inicial',
  'Ampliación de encargo',
  'Adenda',
  'Recurso',
  'Ejecución',
  'Nueva fase del expediente',
  'Otro encargo relacionado',
] as const

export type MotivoCierrePresupuesto =
  | 'Rechazado por el cliente'
  | 'Sin respuesta'
  | 'Caducado'
  | 'Cancelado por el despacho'
  | 'Duplicado'
  | 'Sustituido por otro presupuesto'
  | 'Otro motivo'

export type Presupuesto = {
  id: string
  codigo: string
  version: string
  titulo: string
  contactoId: string
  oportunidadId?: string
  expedienteId?: string
  tipo: (typeof TIPOS_PRESUPUESTO)[number]
  responsable: string
  validador: string
  /** Microestado interno heredado (se conserva para el historial y la trazabilidad). */
  estado: EstadoPresupuestoId
  alcance: string[]
  exclusiones: string[]
  honorarios: { concepto: string; importe: string }[]
  total: string
  formaPago: string
  provision: string
  vigencia: string
  observaciones: string
  validado: boolean
  versiones: { version: string; fecha: string; autor: string; cambio: string }[]
  validaciones: { fecha: string; validador: string; resultado: string; observacion: string }[]
  proforma?: { numero: string; fecha: string; importe: string; estado: string; pagado: string }
  historial: HistorialItem[]
  /** Fecha de entrada en la fase actual (dd/mm/aaaa). */
  fechaFase?: string
  envio?: {
    fecha: string
    destinatario: string
    canal: string
    caducidad: string
    seguimiento?: string
  }
  aceptacion?: { fecha: string; version: string; forma: string }
  cierre?: { motivo: MotivoCierrePresupuesto; fecha: string; observacion?: string }
}

export const PRESUPUESTOS: Presupuesto[] = [
  {
    id: 'PR-0001',
    codigo: 'PR-2026-0001',
    version: 'v2',
    titulo: 'Constitución de sociedad patrimonial',
    contactoId: 'CT-0001',
    oportunidadId: 'OP-0010',
    expedienteId: 'EX-0002',
    tipo: 'Presupuesto inicial',
    responsable: 'Luis Ferrán',
    validador: 'Igor Belmonte',
    estado: 'pagado',
    alcance: ['Redacción de estatutos', 'Asistencia a notaría', 'Inscripción registral'],
    exclusiones: ['Aranceles notariales y registrales', 'Impuestos'],
    honorarios: [
      { concepto: 'Honorarios fijos', importe: '4.500 €' },
      { concepto: 'Gestión registral', importe: '900 €' },
    ],
    total: '5.400 €',
    formaPago: '50 % a la aceptación, 50 % a la firma',
    provision: '2.700 €',
    vigencia: '30 días',
    observaciones: 'Incluye una reunión de seguimiento.',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '20/05/2026', autor: 'Luis Ferrán', cambio: 'Versión inicial' },
      {
        version: 'v2',
        fecha: '26/05/2026',
        autor: 'Luis Ferrán',
        cambio: 'Se añade gestión registral',
      },
    ],
    validaciones: [
      {
        fecha: '27/05/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    proforma: {
      numero: 'PF-2026-0004',
      fecha: '29/05/2026',
      importe: '2.700 €',
      estado: 'Pagada',
      pagado: '100 %',
    },
    historial: [
      {
        fecha: '20/05/2026',
        usuario: 'Ana Torregrosa',
        tipo: 'Solicitud',
        descripcion: 'Presupuesto solicitado',
      },
      {
        fecha: '27/05/2026',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Validado',
      },
      {
        fecha: '12/06/2026',
        usuario: 'Nuria Casals',
        tipo: 'Cobro',
        descripcion: 'Pago total recibido',
      },
    ],
  },
  {
    id: 'PR-0002',
    codigo: 'PR-2026-0002',
    version: 'v1',
    titulo: 'Impugnación de acuerdos de junta',
    contactoId: 'CT-0007',
    oportunidadId: 'OP-0003',
    tipo: 'Presupuesto inicial',
    responsable: 'Luis Ferrán',
    validador: 'Igor Belmonte',
    estado: 'pendiente-validacion',
    alcance: ['Estudio del acta', 'Demanda de impugnación', 'Vista'],
    exclusiones: ['Procurador', 'Peritaje'],
    honorarios: [
      { concepto: 'Fase declarativa', importe: '3.600 €' },
      { concepto: 'Vista', importe: '900 €' },
    ],
    total: '4.500 €',
    formaPago: 'Provisión inicial y liquidación final',
    provision: '1.500 €',
    vigencia: '15 días',
    observaciones: 'Urgente por plazo de impugnación.',
    validado: false,
    versiones: [
      { version: 'v1', fecha: '05/08/2026', autor: 'Luis Ferrán', cambio: 'Versión inicial' },
    ],
    validaciones: [],
    historial: [
      {
        fecha: '04/08/2026',
        usuario: 'Luis Ferrán',
        tipo: 'Solicitud',
        descripcion: 'Presupuesto solicitado',
      },
      {
        fecha: '05/08/2026',
        usuario: 'Luis Ferrán',
        tipo: 'Estado',
        descripcion: 'Enviado a validación de Igor',
      },
    ],
  },
  {
    id: 'PR-0003',
    codigo: 'PR-2026-0003',
    version: 'v2',
    titulo: 'Reclamación de cantidad por obra defectuosa',
    contactoId: 'CT-0011',
    oportunidadId: 'OP-0004',
    tipo: 'Presupuesto inicial',
    responsable: 'Marta Solé',
    validador: 'Igor Belmonte',
    estado: 'pendiente-respuesta',
    alcance: ['Requerimiento previo', 'Demanda', 'Ejecución en su caso'],
    exclusiones: ['Perito', 'Tasas judiciales'],
    honorarios: [
      { concepto: 'Fase extrajudicial', importe: '1.200 €' },
      { concepto: 'Fase judicial', importe: '5.000 €' },
    ],
    total: '6.200 €',
    formaPago: 'Por fases',
    provision: '1.200 €',
    vigencia: '30 días',
    observaciones: 'Desglose por fases solicitado por el cliente.',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '28/07/2026', autor: 'Marta Solé', cambio: 'Versión inicial' },
      { version: 'v2', fecha: '01/08/2026', autor: 'Marta Solé', cambio: 'Desglose por fases' },
    ],
    validaciones: [
      {
        fecha: '29/07/2026',
        validador: 'Igor Belmonte',
        resultado: 'Devuelto',
        observacion: 'Falta desglose por fases',
      },
      {
        fecha: '01/08/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme tras rectificación',
      },
    ],
    historial: [
      {
        fecha: '01/08/2026',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Validado v2',
      },
      {
        fecha: '02/08/2026',
        usuario: 'Nuria Casals',
        tipo: 'Envío',
        descripcion: 'Enviado al cliente',
        proxima: 'Seguimiento 08/08',
      },
    ],
    envio: {
      fecha: '02/08/2026',
      destinatario: 'clara.medina@correo.es',
      canal: 'Correo electrónico',
      caducidad: '01/09/2026',
      seguimiento: '08/08/2026',
    },
    fechaFase: '02/08/2026',
  },
  {
    id: 'PR-0004',
    codigo: 'PR-2026-0004',
    version: 'v1',
    titulo: 'Planificación sucesoria y testamento',
    contactoId: 'CT-0001',
    oportunidadId: 'OP-0005',
    tipo: 'Presupuesto inicial',
    responsable: 'Ana Torregrosa',
    validador: 'Igor Belmonte',
    estado: 'proforma-enviada',
    alcance: ['Estudio patrimonial', 'Borrador de testamento', 'Asistencia a notaría'],
    exclusiones: ['Aranceles notariales'],
    honorarios: [{ concepto: 'Honorarios fijos', importe: '3.800 €' }],
    total: '3.800 €',
    formaPago: 'Pago único a la aceptación',
    provision: '1.900 €',
    vigencia: '30 días',
    observaciones: '—',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '28/07/2026', autor: 'Ana Torregrosa', cambio: 'Versión inicial' },
    ],
    validaciones: [
      {
        fecha: '01/08/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    proforma: {
      numero: 'PF-2026-0011',
      fecha: '03/08/2026',
      importe: '1.900 €',
      estado: 'Pendiente de pago',
      pagado: '0 %',
    },
    historial: [
      {
        fecha: '01/08/2026',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Validado',
      },
      {
        fecha: '03/08/2026',
        usuario: 'Nuria Casals',
        tipo: 'Proforma',
        descripcion: 'Proforma PF-2026-0011 enviada',
      },
    ],
    aceptacion: { fecha: '02/08/2026', version: 'v1', forma: 'Correo electrónico de conformidad' },
    fechaFase: '02/08/2026',
  },
  {
    id: 'PR-0005',
    codigo: 'PR-2026-0005',
    version: 'v1',
    titulo: 'Compraventa de local comercial',
    contactoId: 'CT-0002',
    oportunidadId: 'OP-0006',
    tipo: 'Presupuesto inicial',
    responsable: 'Luis Ferrán',
    validador: 'Igor Belmonte',
    estado: 'pagado',
    alcance: ['Due diligence registral y urbanística', 'Contrato', 'Escritura'],
    exclusiones: ['Impuestos', 'Notaría y registro'],
    honorarios: [{ concepto: 'Honorarios fijos', importe: '9.500 €' }],
    total: '9.500 €',
    formaPago: '50 % a la aceptación, 50 % a la escritura',
    provision: '4.750 €',
    vigencia: '30 días',
    observaciones: 'Plazo objetivo: escritura antes de octubre.',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '26/07/2026', autor: 'Luis Ferrán', cambio: 'Versión inicial' },
    ],
    validaciones: [
      {
        fecha: '28/07/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    proforma: {
      numero: 'PF-2026-0012',
      fecha: '01/08/2026',
      importe: '4.750 €',
      estado: 'Pagada',
      pagado: '100 %',
    },
    historial: [
      {
        fecha: '28/07/2026',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Validado',
      },
      {
        fecha: '04/08/2026',
        usuario: 'Nuria Casals',
        tipo: 'Cobro',
        descripcion: 'Pago recibido',
        proxima: 'Abrir expediente',
      },
    ],
  },
  {
    id: 'PR-0006',
    codigo: 'PR-2026-0006',
    version: 'v1',
    titulo: 'Reclamación de rentas impagadas',
    contactoId: 'CT-0007',
    oportunidadId: 'OP-0009',
    tipo: 'Presupuesto inicial',
    responsable: 'Luis Ferrán',
    validador: 'Igor Belmonte',
    estado: 'enviado',
    alcance: ['Requerimiento', 'Demanda de desahucio y reclamación de rentas'],
    exclusiones: ['Procurador'],
    honorarios: [{ concepto: 'Honorarios fijos', importe: '3.100 €' }],
    total: '3.100 €',
    formaPago: 'Provisión y liquidación final',
    provision: '1.000 €',
    vigencia: '20 días',
    observaciones: '—',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '26/07/2026', autor: 'Luis Ferrán', cambio: 'Versión inicial' },
    ],
    validaciones: [
      {
        fecha: '28/07/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    historial: [
      {
        fecha: '29/07/2026',
        usuario: 'Nuria Casals',
        tipo: 'Envío',
        descripcion: 'Enviado al cliente',
      },
    ],
    envio: {
      fecha: '29/07/2026',
      destinatario: 'administracion@patrimoniosbcn.es',
      canal: 'Correo electrónico',
      caducidad: '20/08/2026',
      seguimiento: '20/08/2026',
    },
    fechaFase: '29/07/2026',
  },
  {
    id: 'PR-0007',
    codigo: 'PR-2026-0007',
    version: 'v2',
    titulo: 'Adenda por ampliación de encargo',
    contactoId: 'CT-0002',
    expedienteId: 'EX-0003',
    tipo: 'Adenda',
    responsable: 'Marta Solé',
    validador: 'Igor Belmonte',
    estado: 'devuelto',
    alcance: ['Ampliación a la fase de ejecución'],
    exclusiones: ['Costas'],
    honorarios: [{ concepto: 'Ampliación', importe: '2.400 €' }],
    total: '2.400 €',
    formaPago: 'Pago único',
    provision: '1.200 €',
    vigencia: '15 días',
    observaciones: 'Pendiente de ajustar el alcance.',
    validado: false,
    versiones: [
      { version: 'v1', fecha: '27/07/2026', autor: 'Marta Solé', cambio: 'Versión inicial' },
      { version: 'v2', fecha: '03/08/2026', autor: 'Marta Solé', cambio: 'Ajuste de alcance' },
    ],
    validaciones: [
      {
        fecha: '04/08/2026',
        validador: 'Igor Belmonte',
        resultado: 'Devuelto',
        observacion: 'Detallar actuaciones incluidas',
      },
    ],
    historial: [
      {
        fecha: '04/08/2026',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Devuelto para rectificación',
      },
    ],
  },
  {
    id: 'PR-0008',
    codigo: 'PR-2026-0008',
    version: 'v1',
    titulo: 'Recurso de apelación',
    contactoId: 'CT-0011',
    expedienteId: 'EX-0004',
    tipo: 'Recurso',
    responsable: 'Luis Ferrán',
    validador: 'Igor Belmonte',
    estado: 'elaboracion',
    alcance: ['Recurso de apelación y oposición'],
    exclusiones: ['Procurador'],
    honorarios: [{ concepto: 'Recurso', importe: '2.900 €' }],
    total: '2.900 €',
    formaPago: 'Pago único',
    provision: '1.450 €',
    vigencia: '15 días',
    observaciones: 'En elaboración.',
    validado: false,
    versiones: [{ version: 'v1', fecha: '04/08/2026', autor: 'Luis Ferrán', cambio: 'Borrador' }],
    validaciones: [],
    historial: [
      {
        fecha: '03/08/2026',
        usuario: 'Marta Solé',
        tipo: 'Asignación',
        descripcion: 'Asignado a Luis Ferrán',
      },
    ],
  },
  {
    id: 'PR-0009',
    codigo: 'PR-2026-0009',
    version: 'v1',
    titulo: 'Nueva fase: ejecución de sentencia',
    contactoId: 'CT-0011',
    expedienteId: 'EX-0005',
    tipo: 'Ejecución',
    responsable: 'Marta Solé',
    validador: 'Igor Belmonte',
    estado: 'pago-parcial',
    alcance: ['Demanda ejecutiva', 'Averiguación patrimonial'],
    exclusiones: ['Costas'],
    honorarios: [{ concepto: 'Ejecución', importe: '2.000 €' }],
    total: '2.000 €',
    formaPago: 'Dos plazos',
    provision: '1.000 €',
    vigencia: '30 días',
    observaciones: 'Primer plazo cobrado.',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '10/07/2026', autor: 'Marta Solé', cambio: 'Versión inicial' },
    ],
    validaciones: [
      {
        fecha: '12/07/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    proforma: {
      numero: 'PF-2026-0009',
      fecha: '15/07/2026',
      importe: '2.000 €',
      estado: 'Pago parcial',
      pagado: '50 %',
    },
    historial: [
      {
        fecha: '20/07/2026',
        usuario: 'Nuria Casals',
        tipo: 'Cobro',
        descripcion: 'Primer plazo cobrado',
      },
    ],
  },
  {
    id: 'PR-0010',
    codigo: 'PR-2026-0010',
    version: 'v1',
    titulo: 'Asesoramiento fiscal en donación',
    contactoId: 'CT-0011',
    oportunidadId: 'OP-0007',
    tipo: 'Presupuesto inicial',
    responsable: 'Marta Solé',
    validador: 'Igor Belmonte',
    estado: 'rechazado',
    alcance: ['Informe fiscal'],
    exclusiones: ['Presentación de impuestos'],
    honorarios: [{ concepto: 'Informe', importe: '1.200 €' }],
    total: '1.200 €',
    formaPago: 'Pago único',
    provision: '—',
    vigencia: '15 días',
    observaciones: 'Rechazado por precio.',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '12/07/2026', autor: 'Marta Solé', cambio: 'Versión inicial' },
    ],
    validaciones: [
      {
        fecha: '14/07/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    historial: [
      {
        fecha: '22/07/2026',
        usuario: 'Marta Solé',
        tipo: 'Respuesta',
        descripcion: 'Rechazado por el cliente',
      },
    ],
  },
  {
    id: 'PR-0011',
    codigo: 'PR-2026-0011',
    version: 'v1',
    titulo: 'Reorganización patrimonial familiar',
    contactoId: 'CT-0001',
    oportunidadId: 'OP-0002',
    tipo: 'Presupuesto inicial',
    responsable: 'Sin asignar',
    validador: 'Igor Belmonte',
    estado: 'solicitado',
    alcance: ['Pendiente de definir tras la primera cita'],
    exclusiones: [],
    honorarios: [],
    total: 'Por determinar',
    formaPago: 'Por determinar',
    provision: 'Por determinar',
    vigencia: '—',
    observaciones: 'A la espera de la primera cita del 10/08.',
    validado: false,
    versiones: [],
    validaciones: [],
    historial: [
      {
        fecha: '04/08/2026',
        usuario: 'Ana Torregrosa',
        tipo: 'Solicitud',
        descripcion: 'Presupuesto solicitado',
      },
    ],
  },
  {
    id: 'PR-0012',
    codigo: 'PR-2026-0012',
    version: 'v1',
    titulo: 'Segunda instancia — caducado',
    contactoId: 'CT-0007',
    expedienteId: 'EX-0006',
    tipo: 'Nueva fase del expediente',
    responsable: 'Luis Ferrán',
    validador: 'Igor Belmonte',
    estado: 'caducado',
    alcance: ['Fase de apelación'],
    exclusiones: [],
    honorarios: [{ concepto: 'Apelación', importe: '2.100 €' }],
    total: '2.100 €',
    formaPago: 'Pago único',
    provision: '—',
    vigencia: 'Vencida el 20/07/2026',
    observaciones: 'Sin respuesta del cliente dentro de la vigencia.',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '20/06/2026', autor: 'Luis Ferrán', cambio: 'Versión inicial' },
    ],
    validaciones: [
      {
        fecha: '22/06/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    historial: [
      {
        fecha: '20/07/2026',
        usuario: 'Sistema',
        tipo: 'Estado',
        descripcion: 'Presupuesto caducado',
      },
    ],
    cierre: {
      motivo: 'Caducado',
      fecha: '20/07/2026',
      observacion: 'Vigencia vencida sin respuesta.',
    },
    fechaFase: '20/07/2026',
  },
  {
    id: 'PR-0013',
    codigo: 'PR-2026-0013',
    version: 'v1',
    titulo: 'Pacto de socios y protocolo familiar',
    contactoId: 'CT-0002',
    oportunidadId: 'OP-0008',
    tipo: 'Presupuesto inicial',
    responsable: 'Ana Torregrosa',
    validador: 'Igor Belmonte',
    estado: 'validado',
    alcance: ['Protocolo familiar', 'Pacto de socios', 'Reunión de cierre'],
    exclusiones: ['Notaría'],
    honorarios: [{ concepto: 'Honorarios fijos', importe: '7.200 €' }],
    total: '7.200 €',
    formaPago: '50 % a la aceptación, 50 % a la entrega',
    provision: '3.600 €',
    vigencia: '30 días',
    observaciones: 'Validado y pendiente de remitir al cliente.',
    validado: true,
    versiones: [
      { version: 'v1', fecha: '10/08/2026', autor: 'Ana Torregrosa', cambio: 'Versión inicial' },
    ],
    validaciones: [
      {
        fecha: '12/08/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme',
      },
    ],
    historial: [
      {
        fecha: '10/08/2026',
        usuario: 'Ana Torregrosa',
        tipo: 'Estado',
        descripcion: 'Enviado a validación',
      },
      {
        fecha: '12/08/2026',
        usuario: 'Igor Belmonte',
        tipo: 'Validación',
        descripcion: 'Validado v1',
        proxima: 'Enviar al cliente',
      },
    ],
    fechaFase: '12/08/2026',
  },
  {
    id: 'PR-0014',
    codigo: 'PR-2026-0014',
    version: 'v3',
    titulo: 'Reestructuración de deuda hipotecaria',
    contactoId: 'CT-0007',
    oportunidadId: 'OP-0011',
    tipo: 'Presupuesto inicial',
    responsable: 'Marta Solé',
    validador: 'Igor Belmonte',
    estado: 'modificacion',
    alcance: ['Negociación con la entidad', 'Novación', 'Seguimiento'],
    exclusiones: ['Tasación'],
    honorarios: [{ concepto: 'Honorarios fijos', importe: '4.100 €' }],
    total: '4.100 €',
    formaPago: 'Tres plazos',
    provision: '1.400 €',
    vigencia: '30 días',
    observaciones: 'El cliente solicita rebajar la provisión inicial.',
    validado: false,
    versiones: [
      { version: 'v1', fecha: '20/07/2026', autor: 'Marta Solé', cambio: 'Versión inicial' },
      { version: 'v2', fecha: '30/07/2026', autor: 'Marta Solé', cambio: 'Ajuste de honorarios' },
      {
        version: 'v3',
        fecha: '13/08/2026',
        autor: 'Marta Solé',
        cambio: 'Nueva forma de pago (en preparación)',
      },
    ],
    validaciones: [
      {
        fecha: '22/07/2026',
        validador: 'Igor Belmonte',
        resultado: 'Validado',
        observacion: 'Conforme v1',
      },
    ],
    historial: [
      {
        fecha: '24/07/2026',
        usuario: 'Nuria Casals',
        tipo: 'Envío',
        descripcion: 'Enviado al cliente',
      },
      {
        fecha: '12/08/2026',
        usuario: 'Marta Solé',
        tipo: 'Respuesta',
        descripcion: 'El cliente solicita cambios en la forma de pago',
      },
    ],
    envio: {
      fecha: '24/07/2026',
      destinatario: 'financiero@grupoalvear.es',
      canal: 'Correo electrónico',
      caducidad: '23/08/2026',
      seguimiento: '18/08/2026',
    },
    fechaFase: '12/08/2026',
  },
  {
    id: 'PR-0015',
    codigo: 'PR-2026-0015',
    version: 'v1',
    titulo: 'División de cosa común entre hermanos',
    contactoId: 'CT-0001',
    oportunidadId: 'OP-0012',
    tipo: 'Presupuesto inicial',
    responsable: 'Luis Ferrán',
    validador: 'Igor Belmonte',
    estado: 'pendiente-info',
    alcance: ['Estudio registral', 'Propuesta de extinción de condominio'],
    exclusiones: ['Impuestos'],
    honorarios: [],
    total: 'Por determinar',
    formaPago: 'Por determinar',
    provision: 'Por determinar',
    vigencia: '—',
    observaciones: 'Falta la nota simple de las dos fincas.',
    validado: false,
    versiones: [],
    validaciones: [],
    historial: [
      {
        fecha: '08/08/2026',
        usuario: 'Ana Torregrosa',
        tipo: 'Solicitud',
        descripcion: 'Presupuesto solicitado',
      },
      {
        fecha: '11/08/2026',
        usuario: 'Luis Ferrán',
        tipo: 'Estado',
        descripcion: 'Bloqueado: falta documentación registral',
      },
    ],
    fechaFase: '11/08/2026',
  },
]

export const presupuestoPorId = (id: string) => PRESUPUESTOS.find((p) => p.id === id)

/* ---------------- Workflow simplificado: 7 fases operativas ---------------- */

export type FasePresupuestoId =
  | 'preparacion'
  | 'validacion'
  | 'listo'
  | 'cliente'
  | 'revision'
  | 'aceptado'
  | 'cerrado'

export const FASES_PRESUPUESTO: {
  id: FasePresupuestoId
  nombre: string
  descripcion: string
  tono: Tono
}[] = [
  {
    id: 'preparacion',
    nombre: 'Preparación',
    descripcion: 'Solicitado, asignado, en elaboración o bloqueado.',
    tono: 'info',
  },
  {
    id: 'validacion',
    nombre: 'Pendiente de validación',
    descripcion: 'Remitido a Igor para su revisión.',
    tono: 'aviso',
  },
  {
    id: 'listo',
    nombre: 'Listo para enviar',
    descripcion: 'Validado y pendiente de remisión al cliente.',
    tono: 'exito',
  },
  {
    id: 'cliente',
    nombre: 'Pendiente del cliente',
    descripcion: 'Enviado y a la espera de respuesta.',
    tono: 'info',
  },
  {
    id: 'revision',
    nombre: 'En revisión',
    descripcion: 'Negociación o nueva versión en preparación.',
    tono: 'aviso',
  },
  {
    id: 'aceptado',
    nombre: 'Aceptado',
    descripcion: 'Encargo aceptado por el cliente.',
    tono: 'exito',
  },
  {
    id: 'cerrado',
    nombre: 'Cerrado sin encargo',
    descripcion: 'Rechazado, caducado o cancelado.',
    tono: 'riesgo',
  },
]

export const fasePresupuesto = (id: FasePresupuestoId) => {
  const encontrada = FASES_PRESUPUESTO.find((f) => f.id === id) ?? FASES_PRESUPUESTO[0]
  if (!encontrada) throw new Error('El catálogo de fases de presupuesto no puede estar vacío.')
  return encontrada
}

/** Migración automática del microestado histórico a la fase operativa. */
export const MIGRACION_PRESUPUESTO: Record<
  EstadoPresupuestoId,
  { fase: FasePresupuestoId; etiqueta?: string; motivo?: MotivoCierrePresupuesto }
> = {
  solicitado: { fase: 'preparacion', etiqueta: 'Sin asignar' },
  asignado: { fase: 'preparacion' },
  elaboracion: { fase: 'preparacion' },
  'pendiente-info': { fase: 'preparacion', etiqueta: 'Pendiente de información' },
  'pendiente-validacion': { fase: 'validacion' },
  devuelto: { fase: 'preparacion', etiqueta: 'Rectificación solicitada' },
  validado: { fase: 'listo', etiqueta: 'Validado' },
  enviado: { fase: 'cliente' },
  'pendiente-respuesta': { fase: 'cliente' },
  modificacion: { fase: 'revision', etiqueta: 'Nueva versión' },
  aceptado: { fase: 'aceptado' },
  'proforma-pendiente': { fase: 'aceptado' },
  'proforma-enviada': { fase: 'aceptado' },
  'pago-parcial': { fase: 'aceptado' },
  pagado: { fase: 'aceptado' },
  rechazado: { fase: 'cerrado', motivo: 'Rechazado por el cliente' },
  caducado: { fase: 'cerrado', motivo: 'Caducado' },
  cancelado: { fase: 'cerrado', motivo: 'Cancelado por el despacho' },
}

export const faseDePresupuesto = (p: Presupuesto): FasePresupuestoId =>
  MIGRACION_PRESUPUESTO[p.estado]?.fase ?? 'preparacion'

export const motivoCierrePresupuesto = (p: Presupuesto): MotivoCierrePresupuesto | undefined =>
  p.cierre?.motivo ?? MIGRACION_PRESUPUESTO[p.estado]?.motivo

/** Situación interna dentro de la fase (no es una columna). */
export const situacionPresupuesto = (p: Presupuesto): string => {
  switch (p.estado) {
    case 'solicitado':
      return p.responsable === 'Sin asignar' ? 'Sin asignar' : 'Asignado'
    case 'asignado':
      return 'Asignado'
    case 'elaboracion':
      return 'En elaboración'
    case 'pendiente-info':
      return 'Bloqueado: pendiente de información'
    case 'devuelto':
      return 'Rectificación solicitada'
    default:
      return estadoPresupuesto(p.estado).nombre
  }
}

/** Situación económica vinculada (se gestiona en Facturación y cobros). */
export const situacionEconomica = (p: Presupuesto): { texto: string; tono: Tono } => {
  if (!p.proforma) return { texto: 'Sin proforma', tono: 'neutro' }
  const pagado = p.proforma.pagado
  if (p.proforma.estado === 'Pagada' || pagado === '100 %')
    return { texto: 'Pagado', tono: 'exito' }
  if (pagado && pagado !== '0 %') return { texto: 'Pago parcial', tono: 'aviso' }
  if (p.proforma.estado === 'Pendiente de pago') return { texto: 'Proforma enviada', tono: 'aviso' }
  return { texto: 'Proforma pendiente', tono: 'aviso' }
}

const parseFecha = (f?: string) => {
  if (!f) return undefined
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(f)
  if (!m) return undefined
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
}

const HOY = new Date(2026, 7, 18)

const diasDesde = (f?: string) => {
  const d = parseFecha(f)
  if (!d) return undefined
  return Math.max(0, Math.round((HOY.getTime() - d.getTime()) / 86_400_000))
}

/** Antigüedad en la fase actual, en días. */
export const antiguedadFase = (p: Presupuesto): number | undefined =>
  diasDesde(p.fechaFase ?? p.historial[p.historial.length - 1]?.fecha)

export const diasSinRespuesta = (p: Presupuesto): number | undefined =>
  faseDePresupuesto(p) === 'cliente' ? diasDesde(p.envio?.fecha ?? p.fechaFase) : undefined

/** Etiquetas visibles de la tarjeta (sin redundancias). */
export const etiquetasPresupuesto = (p: Presupuesto): { texto: string; tono: Tono }[] => {
  const fase = faseDePresupuesto(p)
  const out: { texto: string; tono: Tono }[] = []

  if (fase === 'preparacion') {
    if (p.estado === 'pendiente-info')
      out.push({ texto: 'Pendiente de información', tono: 'riesgo' })
    else if (p.estado === 'devuelto')
      out.push({ texto: 'Rectificación solicitada', tono: 'riesgo' })
    else if (p.responsable === 'Sin asignar') out.push({ texto: 'Sin asignar', tono: 'aviso' })
  }
  if (fase === 'listo') out.push({ texto: 'Validado', tono: 'exito' })
  if (fase === 'revision') out.push({ texto: 'Nueva versión', tono: 'aviso' })
  if (fase === 'cliente') {
    const caducidad = diasDesde(p.envio?.caducidad)
    const fechaCaducidad = parseFecha(p.envio?.caducidad)
    const restantes = fechaCaducidad
      ? Math.round((fechaCaducidad.getTime() - HOY.getTime()) / 86_400_000)
      : undefined
    if (restantes !== undefined && restantes <= 7 && restantes >= 0) {
      out.push({ texto: 'Próximo a caducar', tono: 'riesgo' })
    } else if (caducidad !== undefined && restantes !== undefined && restantes < 0) {
      out.push({ texto: 'Caducado', tono: 'riesgo' })
    }
    const seg = p.envio?.seguimiento ? parseFecha(p.envio.seguimiento) : undefined
    if (seg && seg.getTime() < HOY.getTime())
      out.push({ texto: 'Seguimiento vencido', tono: 'riesgo' })
  }
  if (fase === 'aceptado') {
    const e = situacionEconomica(p)
    out.push(e)
  }
  if (fase === 'cerrado') {
    const m = motivoCierrePresupuesto(p)
    if (m) out.push({ texto: m, tono: 'riesgo' })
  }
  return out
}

/** Siguiente acción operativa coherente con la fase. */
export const siguienteAccionPresupuesto = (p: Presupuesto): string => {
  switch (faseDePresupuesto(p)) {
    case 'preparacion':
      if (p.responsable === 'Sin asignar') return 'Asignar elaborador'
      if (p.estado === 'pendiente-info') return 'Completar información'
      if (p.estado === 'devuelto') return 'Corregir presupuesto'
      return 'Continuar elaboración'
    case 'validacion':
      return 'Validar presupuesto'
    case 'listo':
      return 'Enviar al cliente'
    case 'cliente':
      return 'Realizar seguimiento'
    case 'revision':
      return 'Preparar nueva versión'
    case 'aceptado':
      return p.proforma
        ? situacionEconomica(p).texto === 'Pagado'
          ? 'Abrir expediente'
          : 'Seguir el cobro'
        : 'Generar proforma'
    case 'cerrado':
      return 'Sin acción pendiente'
  }
}

/* ------------------------------------------------------------------ */
/* Expedientes                                                         */
/* ------------------------------------------------------------------ */

export type FaseExpedienteId =
  | 'onboarding'
  | 'preparacion'
  | 'casework'
  | 'offboarding'
  | 'ejecucion'
  | 'aftercare'

export const FASES_EXPEDIENTE: { id: FaseExpedienteId; nombre: string; descripcion: string }[] = [
  {
    id: 'onboarding',
    nombre: 'Onboarding',
    descripcion: 'Alta del encargo y documentación inicial',
  },
  { id: 'preparacion', nombre: 'Preparación', descripcion: 'Estrategia y preparación del trabajo' },
  { id: 'casework', nombre: 'Case Work', descripcion: 'Ejecución del encargo' },
  { id: 'offboarding', nombre: 'Offboarding', descripcion: 'Cierre, entrega y facturación final' },
  { id: 'ejecucion', nombre: 'Ejecución', descripcion: 'Ejecución y seguimiento posterior' },
  { id: 'aftercare', nombre: 'Aftercare', descripcion: 'Mantenimiento de la relación' },
]

export const faseExpediente = (id: FaseExpedienteId) =>
  FASES_EXPEDIENTE.find((f) => f.id === id) ??
  ({ id, nombre: String(id), descripcion: '' } as (typeof FASES_EXPEDIENTE)[number])

export type Expediente = {
  id: string
  codigo: string
  titulo: string
  contactoId: string
  area: string
  responsable: string
  equipo: string[]
  fase: FaseExpedienteId
  estado: string
  prioridad: Prioridad
  apertura: string
  proximaActuacion: string
  fechaProxima: string
  alertas: string[]
  estrategia: string
  intervinientes: Interviniente[]
  onboarding: { paso: string; estado: 'Completado' | 'Pendiente' | 'En curso' }[]
  actuaciones: { fecha: string; titulo: string; responsable: string; estado: string }[]
  fechasCriticas: { fecha: string; titulo: string; tipo: string; estado: string }[]
  presupuestos: string[]
  cierre?: {
    entrega: string
    conformidad: string
    facturacion: string
    cobro: string
    archivo: string
  }
  aftercare?: { seguimiento: string; satisfaccion: string; proximaRevision: string }
  historial: HistorialItem[]
}

export const EXPEDIENTES: Expediente[] = [
  {
    id: 'EX-0001',
    codigo: 'EX-2026-0001',
    titulo: 'Compraventa de local comercial',
    contactoId: 'CT-0002',
    area: 'Inmobiliario',
    responsable: 'Luis Ferrán',
    equipo: ['Luis Ferrán', 'Nuria Casals'],
    fase: 'onboarding',
    estado: 'En alta',
    prioridad: 'Alta',
    apertura: '05/08/2026',
    proximaActuacion: 'Firma de hoja de encargo',
    fechaProxima: '07/08/2026',
    alertas: ['Hoja de encargo pendiente'],
    estrategia: 'Cerrar due diligence antes de la escritura.',
    intervinientes: [
      { contactoId: 'CT-0002', nombre: 'Inversiones Torrelodones, S.L.', rol: 'Cliente' },
      { contactoId: 'CT-0006', nombre: 'Notaría Ruiz de Alda', rol: 'Notaría' },
    ],
    onboarding: [
      { paso: 'Identificación del cliente', estado: 'Completado' },
      { paso: 'Comprobación de conflicto de intereses', estado: 'Completado' },
      { paso: 'Hoja de encargo', estado: 'En curso' },
      { paso: 'Protección de datos', estado: 'Pendiente' },
      { paso: 'Poderes', estado: 'Pendiente' },
      { paso: 'Provisión o condición económica', estado: 'Completado' },
      { paso: 'Documentación inicial', estado: 'En curso' },
      { paso: 'Preparación para comenzar el trabajo', estado: 'Pendiente' },
    ],
    actuaciones: [
      {
        fecha: '05/08/2026',
        titulo: 'Apertura del expediente',
        responsable: 'Luis Ferrán',
        estado: 'Completada',
      },
    ],
    fechasCriticas: [
      {
        fecha: '30/09/2026',
        titulo: 'Fecha límite de escritura',
        tipo: 'Contractual',
        estado: 'Vigente',
      },
    ],
    presupuestos: ['PR-0005'],
    historial: [
      {
        fecha: '05/08/2026',
        usuario: 'Luis Ferrán',
        tipo: 'Conversión',
        descripcion: 'Expediente abierto desde OP-2026-0006',
      },
    ],
  },
  {
    id: 'EX-0002',
    codigo: 'EX-2026-0002',
    titulo: 'Constitución de sociedad patrimonial',
    contactoId: 'CT-0001',
    area: 'Societario',
    responsable: 'Ana Torregrosa',
    equipo: ['Ana Torregrosa', 'Luis Ferrán'],
    fase: 'casework',
    estado: 'Activo',
    prioridad: 'Media',
    apertura: '12/06/2026',
    proximaActuacion: 'Presentación en el Registro Mercantil',
    fechaProxima: '11/08/2026',
    alertas: [],
    estrategia: 'Inscripción antes del cierre del ejercicio.',
    intervinientes: [
      { contactoId: 'CT-0001', nombre: 'Elena Vargas Miralles', rol: 'Cliente' },
      { contactoId: 'CT-0006', nombre: 'Notaría Ruiz de Alda', rol: 'Notaría' },
    ],
    onboarding: [
      { paso: 'Identificación del cliente', estado: 'Completado' },
      { paso: 'Comprobación de conflicto de intereses', estado: 'Completado' },
      { paso: 'Hoja de encargo', estado: 'Completado' },
      { paso: 'Protección de datos', estado: 'Completado' },
      { paso: 'Poderes', estado: 'Completado' },
      { paso: 'Provisión o condición económica', estado: 'Completado' },
      { paso: 'Documentación inicial', estado: 'Completado' },
      { paso: 'Preparación para comenzar el trabajo', estado: 'Completado' },
    ],
    actuaciones: [
      {
        fecha: '20/06/2026',
        titulo: 'Redacción de estatutos',
        responsable: 'Luis Ferrán',
        estado: 'Completada',
      },
      {
        fecha: '15/07/2026',
        titulo: 'Firma en notaría',
        responsable: 'Ana Torregrosa',
        estado: 'Completada',
      },
      {
        fecha: '11/08/2026',
        titulo: 'Presentación en el registro',
        responsable: 'Nuria Casals',
        estado: 'Prevista',
      },
    ],
    fechasCriticas: [
      {
        fecha: '11/08/2026',
        titulo: 'Presentación registral',
        tipo: 'Administrativa',
        estado: 'Vigente',
      },
    ],
    presupuestos: ['PR-0001'],
    historial: [
      {
        fecha: '12/06/2026',
        usuario: 'Ana Torregrosa',
        tipo: 'Conversión',
        descripcion: 'Expediente abierto desde OP-2026-0010',
      },
    ],
  },
  {
    id: 'EX-0003',
    codigo: 'EX-2026-0003',
    titulo: 'Reclamación por vicios constructivos',
    contactoId: 'CT-0002',
    area: 'Contratación civil',
    responsable: 'Marta Solé',
    equipo: ['Marta Solé', 'Luis Ferrán'],
    fase: 'casework',
    estado: 'Activo con actuación vencida',
    prioridad: 'Alta',
    apertura: '03/03/2026',
    proximaActuacion: 'Presentar escrito de proposición de prueba',
    fechaProxima: '31/07/2026',
    alertas: ['Actuación vencida', 'Adenda devuelta'],
    estrategia: 'Reforzar la prueba pericial antes de la vista.',
    intervinientes: [
      { contactoId: 'CT-0002', nombre: 'Inversiones Torrelodones, S.L.', rol: 'Cliente' },
      { contactoId: 'CT-0008', nombre: 'Peritaciones Delta, S.L.', rol: 'Perito' },
      { contactoId: 'CT-0004', nombre: 'Beatriz Cañete Ordóñez', rol: 'Letrada contraria' },
    ],
    onboarding: [
      { paso: 'Identificación del cliente', estado: 'Completado' },
      { paso: 'Comprobación de conflicto de intereses', estado: 'Completado' },
      { paso: 'Hoja de encargo', estado: 'Completado' },
      { paso: 'Protección de datos', estado: 'Completado' },
      { paso: 'Poderes', estado: 'Completado' },
      { paso: 'Provisión o condición económica', estado: 'Completado' },
      { paso: 'Documentación inicial', estado: 'Completado' },
      { paso: 'Preparación para comenzar el trabajo', estado: 'Completado' },
    ],
    actuaciones: [
      {
        fecha: '12/04/2026',
        titulo: 'Demanda presentada',
        responsable: 'Marta Solé',
        estado: 'Completada',
      },
      {
        fecha: '31/07/2026',
        titulo: 'Proposición de prueba',
        responsable: 'Marta Solé',
        estado: 'Vencida',
      },
    ],
    fechasCriticas: [
      {
        fecha: '31/07/2026',
        titulo: 'Plazo de proposición de prueba',
        tipo: 'Procesal',
        estado: 'Vencida',
      },
    ],
    presupuestos: ['PR-0007'],
    historial: [
      { fecha: '31/07/2026', usuario: 'Sistema', tipo: 'Alerta', descripcion: 'Actuación vencida' },
    ],
  },
  {
    id: 'EX-0004',
    codigo: 'EX-2026-0004',
    titulo: 'Reclamación de legítima — cierre',
    contactoId: 'CT-0011',
    area: 'Sucesiones',
    responsable: 'Luis Ferrán',
    equipo: ['Luis Ferrán'],
    fase: 'offboarding',
    estado: 'En cierre',
    prioridad: 'Media',
    apertura: '05/01/2026',
    proximaActuacion: 'Emitir factura final',
    fechaProxima: '08/08/2026',
    alertas: ['Factura final pendiente'],
    estrategia: 'Cerrar con conformidad expresa del cliente.',
    intervinientes: [{ contactoId: 'CT-0011', nombre: 'Jorge Landa Etxeberria', rol: 'Cliente' }],
    onboarding: [
      { paso: 'Identificación del cliente', estado: 'Completado' },
      { paso: 'Comprobación de conflicto de intereses', estado: 'Completado' },
      { paso: 'Hoja de encargo', estado: 'Completado' },
      { paso: 'Protección de datos', estado: 'Completado' },
      { paso: 'Poderes', estado: 'Completado' },
      { paso: 'Provisión o condición económica', estado: 'Completado' },
      { paso: 'Documentación inicial', estado: 'Completado' },
      { paso: 'Preparación para comenzar el trabajo', estado: 'Completado' },
    ],
    actuaciones: [
      {
        fecha: '20/07/2026',
        titulo: 'Sentencia favorable notificada',
        responsable: 'Luis Ferrán',
        estado: 'Completada',
      },
    ],
    fechasCriticas: [
      {
        fecha: '15/08/2026',
        titulo: 'Plazo para recurso de la contraria',
        tipo: 'Procesal',
        estado: 'Vigente',
      },
    ],
    presupuestos: ['PR-0008'],
    cierre: {
      entrega: 'Entregada copia de la sentencia y resumen final',
      conformidad: 'Pendiente de firma del cliente',
      facturacion: 'Factura final pendiente de emitir',
      cobro: 'Pendiente',
      archivo: 'Pendiente de archivo digital',
    },
    historial: [
      {
        fecha: '20/07/2026',
        usuario: 'Luis Ferrán',
        tipo: 'Hito',
        descripcion: 'Sentencia favorable',
      },
    ],
  },
  {
    id: 'EX-0005',
    codigo: 'EX-2026-0005',
    titulo: 'Ejecución de sentencia y recuperación de cantidades',
    contactoId: 'CT-0011',
    area: 'Ejecución',
    responsable: 'Marta Solé',
    equipo: ['Marta Solé', 'Nuria Casals'],
    fase: 'ejecucion',
    estado: 'En ejecución',
    prioridad: 'Media',
    apertura: '02/02/2026',
    proximaActuacion: 'Solicitar averiguación patrimonial',
    fechaProxima: '20/08/2026',
    alertas: [],
    estrategia: 'Localizar bienes y trabar embargo.',
    intervinientes: [{ contactoId: 'CT-0011', nombre: 'Jorge Landa Etxeberria', rol: 'Cliente' }],
    onboarding: [
      { paso: 'Identificación del cliente', estado: 'Completado' },
      { paso: 'Comprobación de conflicto de intereses', estado: 'Completado' },
      { paso: 'Hoja de encargo', estado: 'Completado' },
      { paso: 'Protección de datos', estado: 'Completado' },
      { paso: 'Poderes', estado: 'Completado' },
      { paso: 'Provisión o condición económica', estado: 'Completado' },
      { paso: 'Documentación inicial', estado: 'Completado' },
      { paso: 'Preparación para comenzar el trabajo', estado: 'Completado' },
    ],
    actuaciones: [
      {
        fecha: '10/07/2026',
        titulo: 'Demanda ejecutiva presentada',
        responsable: 'Marta Solé',
        estado: 'Completada',
      },
    ],
    fechasCriticas: [
      {
        fecha: '20/08/2026',
        titulo: 'Seguimiento de la ejecución',
        tipo: 'Interna',
        estado: 'Vigente',
      },
    ],
    presupuestos: ['PR-0009'],
    aftercare: {
      seguimiento: 'Informe trimestral al cliente',
      satisfaccion: 'Alta (valoración de julio)',
      proximaRevision: '20/08/2026',
    },
    historial: [
      {
        fecha: '10/07/2026',
        usuario: 'Marta Solé',
        tipo: 'Actuación',
        descripcion: 'Demanda ejecutiva presentada',
      },
    ],
  },
  {
    id: 'EX-0006',
    codigo: 'EX-2026-0006',
    titulo: 'Asesoramiento recurrente en propiedad horizontal',
    contactoId: 'CT-0007',
    area: 'Propiedad horizontal',
    responsable: 'Luis Ferrán',
    equipo: ['Luis Ferrán'],
    fase: 'aftercare',
    estado: 'Latente',
    prioridad: 'Baja',
    apertura: '10/11/2025',
    proximaActuacion: 'Llamada anual de seguimiento',
    fechaProxima: '15/09/2026',
    alertas: ['Sin actividad desde hace 30 días'],
    estrategia: 'Mantener la relación y detectar nuevos encargos.',
    intervinientes: [
      { contactoId: 'CT-0007', nombre: 'Gestión de Fincas Levante, S.L.U.', rol: 'Cliente' },
    ],
    onboarding: [
      { paso: 'Identificación del cliente', estado: 'Completado' },
      { paso: 'Comprobación de conflicto de intereses', estado: 'Completado' },
      { paso: 'Hoja de encargo', estado: 'Completado' },
      { paso: 'Protección de datos', estado: 'Completado' },
      { paso: 'Poderes', estado: 'Completado' },
      { paso: 'Provisión o condición económica', estado: 'Completado' },
      { paso: 'Documentación inicial', estado: 'Completado' },
      { paso: 'Preparación para comenzar el trabajo', estado: 'Completado' },
    ],
    actuaciones: [
      {
        fecha: '20/06/2026',
        titulo: 'Informe anual entregado',
        responsable: 'Luis Ferrán',
        estado: 'Completada',
      },
    ],
    fechasCriticas: [
      { fecha: '15/09/2026', titulo: 'Revisión anual', tipo: 'Interna', estado: 'Vigente' },
    ],
    presupuestos: ['PR-0012'],
    cierre: {
      entrega: 'Informe anual entregado',
      conformidad: 'Conformidad expresa recibida',
      facturacion: 'Facturado',
      cobro: 'Cobrado',
      archivo: 'Archivado',
    },
    aftercare: {
      seguimiento: 'Contacto semestral',
      satisfaccion: 'Media',
      proximaRevision: '15/09/2026',
    },
    historial: [
      {
        fecha: '20/06/2026',
        usuario: 'Luis Ferrán',
        tipo: 'Entrega',
        descripcion: 'Informe anual entregado',
      },
    ],
  },
]

export const expedientePorId = (id: string) => EXPEDIENTES.find((e) => e.id === id)

/* ------------------------------------------------------------------ */
/* Actividades, tareas y calendario                                    */
/* ------------------------------------------------------------------ */

export const TIPOS_ACTUACION = [
  'Llamada',
  'Primera cita',
  'Reunión',
  'Videollamada',
  'Correo',
  'WhatsApp',
  'Seguimiento',
  'Solicitud documental',
  'Envío de propuesta',
  'Nota interna',
  'Otra actividad',
] as const

export type Relacion = {
  tipo: 'Contacto' | 'Oportunidad' | 'Presupuesto' | 'Expediente'
  id: string
  label: string
}

export type Actividad = {
  id: string
  tipo: (typeof TIPOS_ACTUACION)[number]
  titulo: string
  estado: 'Programada' | 'Realizada'
  fecha: string
  hora: string
  responsable: string
  contactoId: string
  relacion?: Relacion
  resultado?: string
  proxima?: string
}

export const ACTIVIDADES: Actividad[] = [
  {
    id: 'AC-001',
    tipo: 'Primera cita',
    titulo: 'Primera cita — reorganización patrimonial',
    estado: 'Programada',
    fecha: '10/08/2026',
    hora: '10:30',
    responsable: 'Ana Torregrosa',
    contactoId: 'CT-0001',
    relacion: { tipo: 'Oportunidad', id: 'OP-0002', label: 'OP-2026-0002' },
    proxima: 'Registrar resultado de la cita',
  },
  {
    id: 'AC-002',
    tipo: 'Llamada',
    titulo: 'Llamada de cualificación',
    estado: 'Programada',
    fecha: '05/08/2026',
    hora: '12:00',
    responsable: 'Nuria Casals',
    contactoId: 'CT-0003',
    relacion: { tipo: 'Oportunidad', id: 'OP-0001', label: 'OP-2026-0001' },
  },
  {
    id: 'AC-003',
    tipo: 'Seguimiento',
    titulo: 'Seguimiento del presupuesto enviado',
    estado: 'Programada',
    fecha: '08/08/2026',
    hora: '09:30',
    responsable: 'Marta Solé',
    contactoId: 'CT-0011',
    relacion: { tipo: 'Presupuesto', id: 'PR-0003', label: 'PR-2026-0003' },
  },
  {
    id: 'AC-004',
    tipo: 'Videollamada',
    titulo: 'Primera cita — impugnación de acuerdos',
    estado: 'Realizada',
    fecha: '31/07/2026',
    hora: '12:00',
    responsable: 'Luis Ferrán',
    contactoId: 'CT-0007',
    relacion: { tipo: 'Oportunidad', id: 'OP-0003', label: 'OP-2026-0003' },
    resultado: 'Asunto viable con reservas',
    proxima: 'Solicitar presupuesto',
  },
  {
    id: 'AC-005',
    tipo: 'Envío de propuesta',
    titulo: 'Envío del presupuesto al cliente',
    estado: 'Realizada',
    fecha: '02/08/2026',
    hora: '16:00',
    responsable: 'Nuria Casals',
    contactoId: 'CT-0011',
    relacion: { tipo: 'Presupuesto', id: 'PR-0003', label: 'PR-2026-0003' },
    resultado: 'Enviado por correo',
    proxima: 'Seguimiento 08/08',
  },
  {
    id: 'AC-006',
    tipo: 'Correo',
    titulo: 'Confirmación de cita',
    estado: 'Realizada',
    fecha: '03/08/2026',
    hora: '17:22',
    responsable: 'Nuria Casals',
    contactoId: 'CT-0001',
    relacion: { tipo: 'Oportunidad', id: 'OP-0002', label: 'OP-2026-0002' },
    resultado: 'Cita confirmada',
  },
  {
    id: 'AC-007',
    tipo: 'Solicitud documental',
    titulo: 'Solicitud del justificante de burofax',
    estado: 'Programada',
    fecha: '06/08/2026',
    hora: '11:00',
    responsable: 'Luis Ferrán',
    contactoId: 'CT-0007',
    relacion: { tipo: 'Oportunidad', id: 'OP-0003', label: 'OP-2026-0003' },
  },
  {
    id: 'AC-008',
    tipo: 'Reunión',
    titulo: 'Reunión interna de decisión sobre conflicto',
    estado: 'Programada',
    fecha: '05/08/2026',
    hora: '18:00',
    responsable: 'Igor Belmonte',
    contactoId: 'CT-0003',
    relacion: { tipo: 'Oportunidad', id: 'OP-0008', label: 'OP-2026-0008' },
  },
  {
    id: 'AC-009',
    tipo: 'WhatsApp',
    titulo: 'Recordatorio de pago de proforma',
    estado: 'Realizada',
    fecha: '04/08/2026',
    hora: '10:05',
    responsable: 'Nuria Casals',
    contactoId: 'CT-0001',
    relacion: { tipo: 'Presupuesto', id: 'PR-0004', label: 'PR-2026-0004' },
    resultado: 'Cliente confirma pago esta semana',
  },
  {
    id: 'AC-010',
    tipo: 'Nota interna',
    titulo: 'Registro del pago recibido',
    estado: 'Realizada',
    fecha: '04/08/2026',
    hora: '10:10',
    responsable: 'Nuria Casals',
    contactoId: 'CT-0002',
    relacion: { tipo: 'Oportunidad', id: 'OP-0006', label: 'OP-2026-0006' },
    resultado: 'Pago íntegro recibido',
    proxima: 'Abrir expediente',
  },
]

export type Tarea = {
  id: string
  titulo: string
  descripcion: string
  responsable: string
  colaboradores: string[]
  inicio?: string
  limite?: string
  prioridad: Prioridad
  estado: 'Pendiente' | 'En curso' | 'En revisión' | 'Completada'
  checklist: { texto: string; hecho: boolean }[]
  relacion?: Relacion
  vencida?: boolean
}

export const TAREAS: Tarea[] = [
  {
    id: 'TK-001',
    titulo: 'Preparar escrito de proposición de prueba',
    descripcion: 'Redactar y presentar el escrito con la pericial de Delta.',
    responsable: 'Marta Solé',
    colaboradores: ['Luis Ferrán'],
    inicio: '25/07/2026',
    limite: '31/07/2026',
    prioridad: 'Alta',
    estado: 'En curso',
    checklist: [
      { texto: 'Revisar informe pericial', hecho: true },
      { texto: 'Redactar escrito', hecho: false },
      { texto: 'Presentar en sede judicial', hecho: false },
    ],
    relacion: { tipo: 'Expediente', id: 'EX-0003', label: 'EX-2026-0003' },
    vencida: true,
  },
  {
    id: 'TK-002',
    titulo: 'Emitir factura final',
    descripcion: 'Factura de cierre del expediente de legítima.',
    responsable: 'Nuria Casals',
    colaboradores: [],
    inicio: '01/08/2026',
    limite: '03/08/2026',
    prioridad: 'Media',
    estado: 'Pendiente',
    checklist: [{ texto: 'Confirmar horas imputadas', hecho: false }],
    relacion: { tipo: 'Expediente', id: 'EX-0004', label: 'EX-2026-0004' },
    vencida: true,
  },
  {
    id: 'TK-003',
    titulo: 'Elaborar presupuesto de impugnación',
    descripcion: 'Presupuesto urgente con desglose de fases.',
    responsable: 'Luis Ferrán',
    colaboradores: ['Nuria Casals'],
    inicio: '04/08/2026',
    limite: '05/08/2026',
    prioridad: 'Alta',
    estado: 'En revisión',
    checklist: [
      { texto: 'Calcular honorarios', hecho: true },
      { texto: 'Enviar a validación de Igor', hecho: true },
    ],
    relacion: { tipo: 'Presupuesto', id: 'PR-0002', label: 'PR-2026-0002' },
  },
  {
    id: 'TK-004',
    titulo: 'Validar presupuesto PR-2026-0002',
    descripcion: 'Revisión y validación previa al envío al cliente.',
    responsable: 'Igor Belmonte',
    colaboradores: [],
    inicio: '05/08/2026',
    limite: '06/08/2026',
    prioridad: 'Alta',
    estado: 'Pendiente',
    checklist: [],
    relacion: { tipo: 'Presupuesto', id: 'PR-0002', label: 'PR-2026-0002' },
  },
  {
    id: 'TK-005',
    titulo: 'Preparar documentación para la primera cita',
    descripcion: 'Escrituras y cuentas anuales del grupo familiar.',
    responsable: 'Ana Torregrosa',
    colaboradores: ['Luis Ferrán'],
    inicio: '06/08/2026',
    limite: '09/08/2026',
    prioridad: 'Media',
    estado: 'Pendiente',
    checklist: [
      { texto: 'Solicitar escrituras', hecho: false },
      { texto: 'Revisar cuentas 2025', hecho: false },
    ],
    relacion: { tipo: 'Oportunidad', id: 'OP-0002', label: 'OP-2026-0002' },
  },
  {
    id: 'TK-006',
    titulo: 'Rectificar adenda devuelta',
    descripcion: 'Detallar las actuaciones incluidas en la ampliación.',
    responsable: 'Marta Solé',
    colaboradores: [],
    inicio: '05/08/2026',
    limite: '07/08/2026',
    prioridad: 'Media',
    estado: 'Pendiente',
    checklist: [],
    relacion: { tipo: 'Presupuesto', id: 'PR-0007', label: 'PR-2026-0007' },
  },
  {
    id: 'TK-007',
    titulo: 'Archivar documentación del expediente cerrado',
    descripcion: 'Archivo digital y comprobación de índices.',
    responsable: 'Nuria Casals',
    colaboradores: [],
    prioridad: 'Baja',
    estado: 'Pendiente',
    checklist: [],
    relacion: { tipo: 'Expediente', id: 'EX-0006', label: 'EX-2026-0006' },
  },
  {
    id: 'TK-008',
    titulo: 'Comprobar conflicto de intereses',
    descripcion: 'División de cosa común con cliente existente.',
    responsable: 'Igor Belmonte',
    colaboradores: ['Ana Torregrosa'],
    inicio: '04/08/2026',
    limite: '05/08/2026',
    prioridad: 'Alta',
    estado: 'En curso',
    checklist: [{ texto: 'Consultar base de clientes', hecho: true }],
    relacion: { tipo: 'Oportunidad', id: 'OP-0008', label: 'OP-2026-0008' },
  },
  {
    id: 'TK-009',
    titulo: 'Preparar hoja de encargo',
    descripcion: 'Hoja de encargo del expediente de compraventa.',
    responsable: 'Luis Ferrán',
    colaboradores: [],
    inicio: '05/08/2026',
    limite: '07/08/2026',
    prioridad: 'Alta',
    estado: 'En curso',
    checklist: [{ texto: 'Usar plantilla inmobiliario', hecho: true }],
    relacion: { tipo: 'Expediente', id: 'EX-0001', label: 'EX-2026-0001' },
  },
  {
    id: 'TK-010',
    titulo: 'Llamada anual de seguimiento',
    descripcion: 'Aftercare del cliente de propiedad horizontal.',
    responsable: 'Luis Ferrán',
    colaboradores: [],
    limite: '15/09/2026',
    prioridad: 'Baja',
    estado: 'Pendiente',
    checklist: [],
    relacion: { tipo: 'Expediente', id: 'EX-0006', label: 'EX-2026-0006' },
  },
]

export type EventoCalendario = {
  id: string
  fecha: string // dd/mm/aaaa
  hora?: string
  titulo: string
  categoria: 'Cita' | 'Actividad' | 'Tarea' | 'Fecha crítica' | 'Seguimiento'
  responsable: string
  relacion?: string
}

export const EVENTOS: EventoCalendario[] = [
  {
    id: 'EV-1',
    fecha: '05/08/2026',
    hora: '12:00',
    titulo: 'Llamada de cualificación',
    categoria: 'Actividad',
    responsable: 'Nuria Casals',
    relacion: 'OP-2026-0001',
  },
  {
    id: 'EV-2',
    fecha: '05/08/2026',
    hora: '18:00',
    titulo: 'Reunión interna de conflicto',
    categoria: 'Actividad',
    responsable: 'Igor Belmonte',
    relacion: 'OP-2026-0008',
  },
  {
    id: 'EV-3',
    fecha: '06/08/2026',
    hora: '11:00',
    titulo: 'Solicitud documental',
    categoria: 'Actividad',
    responsable: 'Luis Ferrán',
    relacion: 'OP-2026-0003',
  },
  {
    id: 'EV-4',
    fecha: '06/08/2026',
    titulo: 'Validar PR-2026-0002',
    categoria: 'Tarea',
    responsable: 'Igor Belmonte',
    relacion: 'PR-2026-0002',
  },
  {
    id: 'EV-5',
    fecha: '07/08/2026',
    titulo: 'Firma de hoja de encargo',
    categoria: 'Tarea',
    responsable: 'Luis Ferrán',
    relacion: 'EX-2026-0001',
  },
  {
    id: 'EV-6',
    fecha: '08/08/2026',
    hora: '09:30',
    titulo: 'Seguimiento de presupuesto',
    categoria: 'Seguimiento',
    responsable: 'Marta Solé',
    relacion: 'PR-2026-0003',
  },
  {
    id: 'EV-7',
    fecha: '10/08/2026',
    hora: '10:30',
    titulo: 'Primera cita — Elena Vargas',
    categoria: 'Cita',
    responsable: 'Ana Torregrosa',
    relacion: 'OP-2026-0002',
  },
  {
    id: 'EV-8',
    fecha: '11/08/2026',
    titulo: 'Presentación registral',
    categoria: 'Fecha crítica',
    responsable: 'Nuria Casals',
    relacion: 'EX-2026-0002',
  },
  {
    id: 'EV-9',
    fecha: '15/08/2026',
    titulo: 'Plazo de recurso de la contraria',
    categoria: 'Fecha crítica',
    responsable: 'Luis Ferrán',
    relacion: 'EX-2026-0004',
  },
  {
    id: 'EV-10',
    fecha: '20/08/2026',
    titulo: 'Seguimiento de la ejecución',
    categoria: 'Fecha crítica',
    responsable: 'Marta Solé',
    relacion: 'EX-2026-0005',
  },
  {
    id: 'EV-11',
    fecha: '24/08/2026',
    hora: '17:00',
    titulo: 'Reunión de seguimiento con cliente',
    categoria: 'Cita',
    responsable: 'Ana Torregrosa',
    relacion: 'EX-2026-0002',
  },
  {
    id: 'EV-12',
    fecha: '31/07/2026',
    titulo: 'Proposición de prueba (vencida)',
    categoria: 'Fecha crítica',
    responsable: 'Marta Solé',
    relacion: 'EX-2026-0003',
  },
]

/* ------------------------------------------------------------------ */
/* Indicadores del CRM                                                 */
/* ------------------------------------------------------------------ */

export const ORIGENES_CRM = [
  { origen: 'Recomendación de cliente', total: 9 },
  { origen: 'Formulario web', total: 6 },
  { origen: 'Notaría', total: 4 },
  { origen: 'Administrador de fincas', total: 3 },
  { origen: 'Cliente recurrente', total: 5 },
  { origen: 'Colaborador', total: 2 },
]

export const MOTIVOS_CIERRE = [
  { motivo: 'Precio', total: 4 },
  { motivo: 'Sin respuesta', total: 3 },
  { motivo: 'Conflicto de intereses', total: 1 },
  { motivo: 'Asunto inviable', total: 2 },
  { motivo: 'Elige otro despacho', total: 2 },
]

export const EMBUDO = [
  { etapa: 'Oportunidades creadas', total: 29 },
  { etapa: 'Cualificadas', total: 21 },
  { etapa: 'Primera cita celebrada', total: 15 },
  { etapa: 'Presupuesto enviado', total: 11 },
  { etapa: 'Aceptado', total: 7 },
  { etapa: 'Convertido en expediente', total: 6 },
]

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

export const nombreContacto = (id: string) => {
  const c = contactoPorId(id)
  return c ? nombreCompleto(c) : 'Contacto desconocido'
}

export const oportunidadesDeContacto = (contactoId: string) =>
  OPORTUNIDADES.filter((o) => o.contactoId === contactoId)

export const presupuestosDeContacto = (contactoId: string) =>
  PRESUPUESTOS.filter((p) => p.contactoId === contactoId)

export const expedientesDeContacto = (contactoId: string) =>
  EXPEDIENTES.filter((e) => e.contactoId === contactoId)

export const actividadesDe = (tipo: Relacion['tipo'], id: string) =>
  ACTIVIDADES.filter((a) => (tipo === 'Contacto' ? a.contactoId === id : a.relacion?.id === id))

export const tareasDe = (tipo: Relacion['tipo'], id: string) =>
  TAREAS.filter((t) => t.relacion?.tipo === tipo && t.relacion.id === id)

export const TOTAL_CONTACTOS = CONTACTOS.length
