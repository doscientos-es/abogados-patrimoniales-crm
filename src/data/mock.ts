// Datos ficticios. Sustituibles en el futuro sin tocar las pantallas.

export type FaseId = 'lead' | 'onboarding' | 'case-work' | 'deliver' | 'offboarding' | 'aftercare'

export const FASES: {
  id: FaseId
  nombre: string
  titulo: string
  descripcion: string
  pasos: string[]
}[] = [
  {
    id: 'lead',
    nombre: 'Lead',
    titulo: 'LEAD — Captación',
    descripcion: 'Desde el primer contacto hasta la conversión en cliente.',
    pasos: [
      'Contacto inicial',
      'Calificación del potencial cliente',
      'Primera cita',
      'Presupuesto',
      'Aceptación y pago inicial',
      'Conversión en cliente',
    ],
  },
  {
    id: 'onboarding',
    nombre: 'Onboarding',
    titulo: 'ONBOARDING — Alta del encargo',
    descripcion: 'Formalización del encargo y activación del asunto.',
    pasos: [
      'Objetivos y alcance',
      'Acta de encargo',
      'Firma',
      'Welcome Pack',
      'Cronología inicial',
      'Documentación',
      'Activación del asunto',
    ],
  },
  {
    id: 'case-work',
    nombre: 'Case Work',
    titulo: 'CASE WORK — Preparación y estrategia',
    descripcion: 'Organización interna del expediente y definición de estrategia.',
    pasos: [
      'Designación del responsable y equipo',
      'Checklist del expediente',
      'Datos, firmas y poderes',
      'Cuestiones previas',
      'Estrategia',
      'Reparto de tareas',
      'Reunión de traspaso',
    ],
  },
  {
    id: 'deliver',
    nombre: 'Deliver',
    titulo: 'DELIVER — Ejecución',
    descripcion: 'Trabajo jurídico y seguimiento del asunto.',
    pasos: [
      'Trabajo jurídico',
      'Demandas, escritos, contratos y escrituras',
      'Tareas y actuaciones',
      'Contactos y comunicaciones',
      'Seguimiento',
      'Registro de tiempo y coste',
      'Reportes al cliente',
    ],
  },
  {
    id: 'offboarding',
    nombre: 'Offboarding',
    titulo: 'OFFBOARDING — Cierre formal',
    descripcion: 'Entrega, conformidad, facturación y archivo.',
    pasos: [
      'Revisión final',
      'Entrega',
      'Conformidad del cliente',
      'Rectificaciones',
      'Adendas o ampliaciones',
      'Factura y cobro',
      'Archivo',
      'Preparación de una posible ejecución posterior',
    ],
  },
  {
    id: 'aftercare',
    nombre: 'Aftercare',
    titulo: 'AFTERCARE — Seguimiento posterior',
    descripcion: 'Casos latentes, ejecuciones y relación continuada.',
    pasos: [
      'Casos latentes',
      'Ejecuciones judiciales o materiales',
      'Recuperación de cantidades',
      'Información periódica al cliente',
      'Liquidaciones',
      'Satisfacción',
      'Reactivación o cierre definitivo',
    ],
  },
]

export const faseById = (id: string) => FASES.find((f) => f.id === id)

export type Prioridad = 'Alta' | 'Media' | 'Baja'

export interface Lead {
  id: string
  nombre: string
  origen: string
  materia: string
  estado: string
  presupuesto: string
  fecha: string
  responsable: string
  telefono: string
  email: string
  notas: string
}

export const LEADS: Lead[] = [
  {
    id: 'L-1042',
    nombre: 'Herederos de Marta Sanchís',
    origen: 'Recomendación',
    materia: 'Sucesiones',
    estado: 'Presupuesto enviado',
    presupuesto: '6.400 €',
    fecha: '02/08/2026',
    responsable: 'A. Torregrosa',
    telefono: '600 112 233',
    email: 'contacto@ejemplo.es',
    notas: 'Tres herederos, inmueble en proindiviso.',
  },
  {
    id: 'L-1041',
    nombre: 'Inversiones Duero SL',
    origen: 'Web',
    materia: 'Patrimonio societario',
    estado: 'Primera cita',
    presupuesto: 'Pendiente',
    fecha: '31/07/2026',
    responsable: 'C. Ibáñez',
    telefono: '600 445 566',
    email: 'legal@ejemplo.es',
    notas: 'Reestructuración de patrimonio familiar.',
  },
  {
    id: 'L-1039',
    nombre: 'Familia Requena Bosch',
    origen: 'Notaría colaboradora',
    materia: 'Planificación sucesoria',
    estado: 'Calificación',
    presupuesto: 'Pendiente',
    fecha: '28/07/2026',
    responsable: 'A. Torregrosa',
    telefono: '600 778 899',
    email: 'requena@ejemplo.es',
    notas: 'Solicita protocolo familiar.',
  },
  {
    id: 'L-1035',
    nombre: 'D. Ignacio Vergés',
    origen: 'LinkedIn',
    materia: 'División de herencia',
    estado: 'Aceptado — pago inicial',
    presupuesto: '9.200 €',
    fecha: '21/07/2026',
    responsable: 'M. Peiró',
    telefono: '600 331 220',
    email: 'iverges@ejemplo.es',
    notas: 'Pendiente de conversión a cliente.',
  },
]

export interface Cliente {
  id: string
  nombre: string
  tipo: string
  nif: string
  contacto: string
  desde: string
  asuntos: string[]
  facturacion: string
}

export const CLIENTES: Cliente[] = [
  {
    id: 'C-201',
    nombre: 'Familia Alcázar Grau',
    tipo: 'Particular',
    nif: '00.000.000-X',
    contacto: 'alcazar@ejemplo.es',
    desde: '2023',
    asuntos: ['A-3012', 'A-3025'],
    facturacion: '48.300 €',
  },
  {
    id: 'C-202',
    nombre: 'Patrimonial Levante SL',
    tipo: 'Sociedad',
    nif: 'B-00000000',
    contacto: 'admin@ejemplo.es',
    desde: '2021',
    asuntos: ['A-3018'],
    facturacion: '112.750 €',
  },
  {
    id: 'C-203',
    nombre: 'Dña. Elena Cortés',
    tipo: 'Particular',
    nif: '00.000.000-Y',
    contacto: 'ecortes@ejemplo.es',
    desde: '2025',
    asuntos: ['A-3031'],
    facturacion: '7.900 €',
  },
  {
    id: 'C-204',
    nombre: 'Fundación Ribera del Turia',
    tipo: 'Fundación',
    nif: 'G-00000000',
    contacto: 'secretaria@ejemplo.es',
    desde: '2024',
    asuntos: ['A-3040'],
    facturacion: '23.100 €',
  },
]

export interface Asunto {
  id: string
  titulo: string
  clienteId: string
  cliente: string
  materia: string
  responsable: string
  fase: FaseId
  estado: string
  prioridad: Prioridad
  proximoHito: string
  apertura: string
  equipo: string[]
  horas: string
  coste: string
  presupuesto: string
  facturado: string
}

export const ASUNTOS: Asunto[] = [
  {
    id: 'A-3012',
    titulo: 'División de herencia Alcázar',
    clienteId: 'C-201',
    cliente: 'Familia Alcázar Grau',
    materia: 'Sucesiones',
    responsable: 'A. Torregrosa',
    fase: 'deliver',
    estado: 'En ejecución',
    prioridad: 'Alta',
    proximoHito: 'Vista cuaderno particional — 18/09/2026',
    apertura: '14/01/2026',
    equipo: ['A. Torregrosa (socio)', 'M. Peiró (asociado)', 'L. Ferrer (paralegal)'],
    horas: '128,5 h',
    coste: '24.100 €',
    presupuesto: '32.000 €',
    facturado: '18.000 €',
  },
  {
    id: 'A-3018',
    titulo: 'Reestructuración patrimonial Levante',
    clienteId: 'C-202',
    cliente: 'Patrimonial Levante SL',
    materia: 'Patrimonio societario',
    responsable: 'C. Ibáñez',
    fase: 'case-work',
    estado: 'Bloqueado — falta documentación',
    prioridad: 'Alta',
    proximoHito: 'Reunión de traspaso — 09/08/2026',
    apertura: '02/06/2026',
    equipo: ['C. Ibáñez (socia)', 'J. Marco (asociado)'],
    horas: '41 h',
    coste: '9.850 €',
    presupuesto: '45.000 €',
    facturado: '12.000 €',
  },
  {
    id: 'A-3025',
    titulo: 'Protocolo familiar Alcázar',
    clienteId: 'C-201',
    cliente: 'Familia Alcázar Grau',
    materia: 'Planificación sucesoria',
    responsable: 'M. Peiró',
    fase: 'onboarding',
    estado: 'Acta de encargo pendiente de firma',
    prioridad: 'Media',
    proximoHito: 'Firma del acta — 12/08/2026',
    apertura: '27/07/2026',
    equipo: ['M. Peiró (asociado)'],
    horas: '6 h',
    coste: '1.320 €',
    presupuesto: '14.500 €',
    facturado: '0 €',
  },
  {
    id: 'A-3031',
    titulo: 'Impugnación de testamento Cortés',
    clienteId: 'C-203',
    cliente: 'Dña. Elena Cortés',
    materia: 'Sucesiones contenciosas',
    responsable: 'A. Torregrosa',
    fase: 'offboarding',
    estado: 'Pendiente de conformidad del cliente',
    prioridad: 'Media',
    proximoHito: 'Entrega y acta de cierre — 20/08/2026',
    apertura: '11/09/2025',
    equipo: ['A. Torregrosa (socio)', 'L. Ferrer (paralegal)'],
    horas: '212 h',
    coste: '38.900 €',
    presupuesto: '42.000 €',
    facturado: '34.000 €',
  },
  {
    id: 'A-3040',
    titulo: 'Ejecución de sentencia Fundación Ribera',
    clienteId: 'C-204',
    cliente: 'Fundación Ribera del Turia',
    materia: 'Ejecución',
    responsable: 'J. Marco',
    fase: 'aftercare',
    estado: 'Caso latente — ejecución en curso',
    prioridad: 'Baja',
    proximoHito: 'Informe periódico — 30/09/2026',
    apertura: '03/03/2024',
    equipo: ['J. Marco (asociado)'],
    horas: '88 h',
    coste: '15.600 €',
    presupuesto: '20.000 €',
    facturado: '20.000 €',
  },
  {
    id: 'A-3044',
    titulo: 'Compraventa de finca rústica Requena',
    clienteId: 'C-201',
    cliente: 'Familia Alcázar Grau',
    materia: 'Inmobiliario patrimonial',
    responsable: 'C. Ibáñez',
    fase: 'lead',
    estado: 'Presupuesto enviado',
    prioridad: 'Media',
    proximoHito: 'Respuesta al presupuesto — 08/08/2026',
    apertura: '01/08/2026',
    equipo: ['C. Ibáñez (socia)'],
    horas: '2 h',
    coste: '440 €',
    presupuesto: '6.400 €',
    facturado: '0 €',
  },
]

export const asuntoById = (id: string) => ASUNTOS.find((a) => a.id === id)
export const clienteById = (id: string) => CLIENTES.find((c) => c.id === id)
export const leadById = (id: string) => LEADS.find((l) => l.id === id)

export interface Tarea {
  id: string
  titulo: string
  asunto: string
  responsable: string
  vencimiento: string
  prioridad: Prioridad
  estado: string
}

export const TAREAS: Tarea[] = [
  {
    id: 'T-901',
    titulo: 'Preparar cuaderno particional',
    asunto: 'A-3012',
    responsable: 'M. Peiró',
    vencimiento: '07/08/2026',
    prioridad: 'Alta',
    estado: 'En curso',
  },
  {
    id: 'T-902',
    titulo: 'Solicitar notas simples registrales',
    asunto: 'A-3018',
    responsable: 'L. Ferrer',
    vencimiento: '06/08/2026',
    prioridad: 'Alta',
    estado: 'Pendiente',
  },
  {
    id: 'T-903',
    titulo: 'Revisar borrador del acta de encargo',
    asunto: 'A-3025',
    responsable: 'M. Peiró',
    vencimiento: '10/08/2026',
    prioridad: 'Media',
    estado: 'Pendiente',
  },
  {
    id: 'T-904',
    titulo: 'Emitir factura final',
    asunto: 'A-3031',
    responsable: 'Administración',
    vencimiento: '21/08/2026',
    prioridad: 'Media',
    estado: 'Pendiente',
  },
  {
    id: 'T-905',
    titulo: 'Informe periódico de ejecución',
    asunto: 'A-3040',
    responsable: 'J. Marco',
    vencimiento: '30/09/2026',
    prioridad: 'Baja',
    estado: 'Programada',
  },
]

export interface Plazo {
  id: string
  concepto: string
  asunto: string
  fecha: string
  tipo: string
  dias: string
}

export const PLAZOS: Plazo[] = [
  {
    id: 'P-501',
    concepto: 'Contestación a la demanda',
    asunto: 'A-3012',
    fecha: '08/08/2026',
    tipo: 'Judicial',
    dias: '3 días',
  },
  {
    id: 'P-502',
    concepto: 'Aportación de documentación registral',
    asunto: 'A-3018',
    fecha: '12/08/2026',
    tipo: 'Interno',
    dias: '7 días',
  },
  {
    id: 'P-503',
    concepto: 'Liquidación del impuesto de sucesiones',
    asunto: 'A-3031',
    fecha: '29/08/2026',
    tipo: 'Fiscal',
    dias: '24 días',
  },
  {
    id: 'P-504',
    concepto: 'Recurso de reposición',
    asunto: 'A-3040',
    fecha: '15/09/2026',
    tipo: 'Judicial',
    dias: '41 días',
  },
]

export interface Documento {
  id: string
  nombre: string
  asunto: string
  tipo: string
  version: string
  fecha: string
  estado: string
}

export const DOCUMENTOS: Documento[] = [
  {
    id: 'D-770',
    nombre: 'Acta de encargo — Alcázar',
    asunto: 'A-3025',
    tipo: 'Encargo',
    version: 'v3',
    fecha: '30/07/2026',
    estado: 'Pendiente de firma',
  },
  {
    id: 'D-771',
    nombre: 'Cuaderno particional (borrador)',
    asunto: 'A-3012',
    tipo: 'Escrito',
    version: 'v2',
    fecha: '01/08/2026',
    estado: 'En revisión',
  },
  {
    id: 'D-772',
    nombre: 'Escritura de aportación',
    asunto: 'A-3018',
    tipo: 'Escritura',
    version: 'v1',
    fecha: '22/07/2026',
    estado: 'Definitivo',
  },
  {
    id: 'D-773',
    nombre: 'Acta de cierre — Cortés',
    asunto: 'A-3031',
    tipo: 'Cierre',
    version: 'v1',
    fecha: '03/08/2026',
    estado: 'Borrador',
  },
]

export interface Comunicacion {
  id: string
  asunto: string
  canal: string
  interlocutor: string
  resumen: string
  fecha: string
}

export const COMUNICACIONES: Comunicacion[] = [
  {
    id: 'M-410',
    asunto: 'A-3012',
    canal: 'Correo',
    interlocutor: 'Cliente',
    resumen: 'Envío de propuesta de reparto de bienes.',
    fecha: '03/08/2026',
  },
  {
    id: 'M-411',
    asunto: 'A-3018',
    canal: 'Llamada',
    interlocutor: 'Administrador societario',
    resumen: 'Solicitud de documentación registral pendiente.',
    fecha: '02/08/2026',
  },
  {
    id: 'M-412',
    asunto: 'A-3031',
    canal: 'Reunión',
    interlocutor: 'Cliente',
    resumen: 'Revisión final del expediente y conformidad.',
    fecha: '29/07/2026',
  },
  {
    id: 'M-413',
    asunto: 'A-3040',
    canal: 'Correo',
    interlocutor: 'Procurador',
    resumen: 'Estado de la ejecución y embargo de saldos.',
    fecha: '24/07/2026',
  },
]

export interface Factura {
  id: string
  cliente: string
  asunto: string
  concepto: string
  importe: string
  emision: string
  estado: string
}

export const FACTURAS: Factura[] = [
  {
    id: 'F-2026-118',
    cliente: 'Familia Alcázar Grau',
    asunto: 'A-3012',
    concepto: 'Provisión de fondos 3/4',
    importe: '6.000 €',
    emision: '15/07/2026',
    estado: 'Pendiente de cobro',
  },
  {
    id: 'F-2026-121',
    cliente: 'Patrimonial Levante SL',
    asunto: 'A-3018',
    concepto: 'Hito de onboarding',
    importe: '12.000 €',
    emision: '20/07/2026',
    estado: 'Cobrada',
  },
  {
    id: 'F-2026-124',
    cliente: 'Dña. Elena Cortés',
    asunto: 'A-3031',
    concepto: 'Liquidación final',
    importe: '8.000 €',
    emision: '01/08/2026',
    estado: 'Emitida',
  },
]

export const ACTUACIONES: { fecha: string; asunto: string; detalle: string; autor: string }[] = [
  {
    fecha: '03/08/2026',
    asunto: 'A-3012',
    detalle: 'Presentado escrito de alegaciones.',
    autor: 'M. Peiró',
  },
  {
    fecha: '02/08/2026',
    asunto: 'A-3018',
    detalle: 'Reclamada documentación al cliente.',
    autor: 'J. Marco',
  },
  {
    fecha: '01/08/2026',
    asunto: 'A-3044',
    detalle: 'Enviado presupuesto de compraventa.',
    autor: 'C. Ibáñez',
  },
  {
    fecha: '30/07/2026',
    asunto: 'A-3025',
    detalle: 'Generado borrador de acta de encargo v3.',
    autor: 'M. Peiró',
  },
  {
    fecha: '29/07/2026',
    asunto: 'A-3031',
    detalle: 'Reunión de revisión final con la cliente.',
    autor: 'A. Torregrosa',
  },
]

export const CRONOLOGIA: Record<string, { fecha: string; hito: string; fase: string }[]> = {
  default: [
    { fecha: '14/01/2026', hito: 'Apertura del asunto', fase: 'Onboarding' },
    { fecha: '22/01/2026', hito: 'Acta de encargo firmada', fase: 'Onboarding' },
    { fecha: '05/02/2026', hito: 'Reunión de traspaso al equipo', fase: 'Case Work' },
    { fecha: '18/03/2026', hito: 'Presentada demanda', fase: 'Deliver' },
    { fecha: '12/06/2026', hito: 'Contestación de la contraparte', fase: 'Deliver' },
    { fecha: '03/08/2026', hito: 'Escrito de alegaciones', fase: 'Deliver' },
  ],
}

export const SOPS: { id: string; nombre: string; fase: string; descripcion: string }[] = [
  {
    id: 'primera-cita',
    nombre: 'Primera cita',
    fase: 'Lead',
    descripcion: 'Guion, checklist y registro de la primera reunión con el potencial cliente.',
  },
  {
    id: 'acta-de-encargo',
    nombre: 'Acta de encargo',
    fase: 'Onboarding',
    descripcion: 'Elaboración, revisión y firma del acta de encargo profesional.',
  },
  {
    id: 'designacion-del-trabajo',
    nombre: 'Designación del trabajo',
    fase: 'Case Work',
    descripcion: 'Asignación de responsable, equipo y reparto de tareas del expediente.',
  },
  {
    id: 'reunion-de-traspaso',
    nombre: 'Reunión de traspaso',
    fase: 'Case Work',
    descripcion: 'Traspaso del asunto del captador al equipo ejecutor.',
  },
  {
    id: 'acta-de-cierre',
    nombre: 'Acta de cierre',
    fase: 'Offboarding',
    descripcion: 'Documento de entrega, conformidad y cierre formal del encargo.',
  },
  {
    id: 'adenda-del-encargo',
    nombre: 'Adenda del encargo',
    fase: 'Offboarding',
    descripcion: 'Ampliaciones de alcance y honorarios sobre el encargo original.',
  },
  {
    id: 'archivo',
    nombre: 'Archivo',
    fase: 'Offboarding',
    descripcion: 'Criterios de archivo, conservación y custodia del expediente.',
  },
  {
    id: 'informacion-periodica-ejecuciones',
    nombre: 'Información periódica en ejecuciones',
    fase: 'Aftercare',
    descripcion: 'Cadencia y contenido de los informes al cliente durante la ejecución.',
  },
]

export const sopById = (id: string) => SOPS.find((s) => s.id === id)
