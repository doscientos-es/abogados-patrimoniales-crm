import type { Comunicacion } from '@/data/expedientes-model'
// COMUNICACIONES — Fase 1 (arquitectura y UI, sin integraciones reales).
//
// Reglas de arquitectura respetadas aquí:
// - Las cuentas de correo pertenecen al DESPACHO, aunque su dirección sea
//   nominal. Nunca se codifican nombres de personas como parte del modelo.
// - El permiso TRIAJE DE COMUNICACIONES se asigna por rol y/o usuario sobre
//   una o varias cuentas concretas, y es completo sobre ellas.
// - Los ejemplos de más abajo son SÓLO datos de configuración de prueba.
import { HOY, formatoFecha } from '@/data/pipeline'

/* ----------------------------- Canales ----------------------------- */

export const CANALES_COMUNICACION = ['Email', 'WhatsApp', 'Llamada'] as const
export type CanalComunicacion = (typeof CANALES_COMUNICACION)[number]

/** Canal normalizado de un registro (los históricos usan textos libres). */
export function canalDe(c: Comunicacion): CanalComunicacion | 'Otro' {
  const v = (c.canal || c.tipo || '').toLowerCase()
  if (v.includes('whats')) return 'WhatsApp'
  if (v.includes('mail') || v.includes('correo')) return 'Email'
  if (v.includes('llamada') || v.includes('tel')) return 'Llamada'
  return 'Otro'
}

/* --------------------- Cuentas y buzones del despacho --------------- */

export type CuentaCorreo = {
  id: string
  /** Dirección del buzón. Pertenece al despacho, no a la persona. */
  direccion: string
  nombre: string
  canal: CanalComunicacion
  /** Buzón general del despacho frente a buzón nominal. */
  tipo: 'General' | 'Nominal'
  /** Integración real con el proveedor (pendiente en esta fase). */
  integracion: 'Pendiente'
  activa: boolean
}

/** Configuración de prueba. Totalmente parametrizable en el futuro módulo de usuarios. */
export const CUENTAS_CORREO: CuentaCorreo[] = [
  {
    id: 'CU-INFO',
    direccion: 'info@abogadospatrimoniales.es',
    nombre: 'Buzón general',
    canal: 'Email',
    tipo: 'General',
    integracion: 'Pendiente',
    activa: true,
  },
  {
    id: 'CU-ADM',
    direccion: 'administracion@abogadospatrimoniales.es',
    nombre: 'Administración',
    canal: 'Email',
    tipo: 'General',
    integracion: 'Pendiente',
    activa: true,
  },
  {
    id: 'CU-JON',
    direccion: 'jon@abogadospatrimoniales.es',
    nombre: 'Buzón nominal',
    canal: 'Email',
    tipo: 'Nominal',
    integracion: 'Pendiente',
    activa: true,
  },
  {
    id: 'CU-GODOY',
    direccion: 'godoy@abogadospatrimoniales.es',
    nombre: 'Buzón nominal',
    canal: 'Email',
    tipo: 'Nominal',
    integracion: 'Pendiente',
    activa: true,
  },
  {
    id: 'CU-WA',
    direccion: '+34 944 029 988',
    nombre: 'WhatsApp Business del despacho',
    canal: 'WhatsApp',
    tipo: 'General',
    integracion: 'Pendiente',
    activa: true,
  },
]

export const cuentaPorDireccion = (dir?: string) => CUENTAS_CORREO.find((c) => c.direccion === dir)

/* ------------------ Canal general del despacho ---------------------- */

/** Teléfono general del despacho. */
export const TELEFONO_DESPACHO = '944 029 988'

/**
 * DESPACHO = canal general: buzón info@, WhatsApp Business del despacho y
 * teléfono general. No depende de personas ni de responsables.
 */
export const CUENTAS_DESPACHO: string[] = [
  CUENTAS_CORREO.find((c) => c.id === 'CU-INFO')!.direccion,
  CUENTAS_CORREO.find((c) => c.id === 'CU-WA')!.direccion,
  TELEFONO_DESPACHO,
  '+34 944 029 988',
]

/**
 * MIS COMUNICACIONES = cuentas de la sesión iniciada (login), no el
 * responsable ni la persona vinculada. Configuración de prueba.
 */
export const CUENTAS_POR_USUARIO: Record<string, string[]> = {
  'Igor Belmonte': ['godoy@abogadospatrimoniales.es'],
  'Ana Torregrosa': ['jon@abogadospatrimoniales.es'],
  'Marta Solé': ['administracion@abogadospatrimoniales.es'],
}

/** Cuentas de la sesión actual. Sin configuración, lista vacía. */
export const cuentasDeUsuario = (usuario: string): string[] => CUENTAS_POR_USUARIO[usuario] ?? []

/* ------------------ Permiso TRIAJE DE COMUNICACIONES ---------------- */

/**
 * Capacidad configurable. Se concede a un rol o a un usuario sobre cuentas
 * concretas y es COMPLETA sobre ellas. Los valores iniciales son datos de
 * configuración de prueba, no reglas fijas del sistema.
 */
export type PermisoTriaje = {
  id: string
  /** Sujeto del permiso: rol o usuario. */
  sujetoTipo: 'Rol' | 'Usuario'
  sujeto: string
  /** Cuentas sobre las que puede triar. */
  cuentas: string[]
}

export const PERMISOS_TRIAJE: PermisoTriaje[] = [
  { id: 'PT-1', sujetoTipo: 'Rol', sujeto: 'Administración', cuentas: ['CU-INFO', 'CU-ADM'] },
  { id: 'PT-2', sujetoTipo: 'Usuario', sujeto: 'Marta Solé', cuentas: ['CU-INFO', 'CU-GODOY'] },
]

/** Cuentas sobre las que un usuario/rol tiene triaje. Sin permiso, lista vacía. */
export function cuentasConTriaje(sujetos: string[]) {
  const ids = new Set(
    PERMISOS_TRIAJE.filter((p) => sujetos.includes(p.sujeto)).flatMap((p) => p.cuentas),
  )
  return CUENTAS_CORREO.filter((c) => ids.has(c.id))
}

/* ---------------------------- Plantillas ---------------------------- */

/** Variables de contexto admitidas en asunto y cuerpo. */
export const VARIABLES_PLANTILLA = [
  '{NUM_EXPEDIENTE}',
  '{TITULO_EXPEDIENTE}',
  '{CONTACTO}',
  '{DESPACHO}',
  '{REMITENTE}',
] as const

export type PlantillaComunicacion = {
  id: string
  nombre: string
  canal: CanalComunicacion
  /** Fase del recorrido en la que se usa habitualmente. */
  fase: 'Lead' | 'Onboarding' | 'Expediente' | 'General'
  asunto: string
  cuerpo: string
  favorita?: boolean
}

export const PLANTILLAS: PlantillaComunicacion[] = [
  {
    id: 'PL-ACT',
    nombre: 'Últimas actuaciones',
    canal: 'Email',
    fase: 'Expediente',
    asunto: 'ÚLTIMAS ACTUACIONES · {NUM_EXPEDIENTE} · {TITULO_EXPEDIENTE}',
    cuerpo:
      'Estimado/a {CONTACTO}:\n\nLe informamos de las últimas actuaciones practicadas en el expediente {NUM_EXPEDIENTE} ({TITULO_EXPEDIENTE}):\n\n- [indicar actuación]\n\nQuedamos a su disposición para cualquier aclaración.\n\nAtentamente,\n{REMITENTE}',
    favorita: true,
  },
  {
    id: 'PL-DOC',
    nombre: 'Solicitud de documentación',
    canal: 'Email',
    fase: 'Onboarding',
    asunto: 'Documentación pendiente · {NUM_EXPEDIENTE}',
    cuerpo:
      'Estimado/a {CONTACTO}:\n\nPara continuar con la tramitación necesitamos la siguiente documentación:\n\n- [indicar documento]\n\nMuchas gracias.\n\n{REMITENTE}',
    favorita: true,
  },
  {
    id: 'PL-CITA',
    nombre: 'Confirmación de primera cita',
    canal: 'Email',
    fase: 'Lead',
    asunto: 'Confirmación de cita · {DESPACHO}',
    cuerpo:
      'Estimado/a {CONTACTO}:\n\nLe confirmamos la cita prevista para el [indicar fecha] a las [indicar hora].\n\nUn saludo,\n{REMITENTE}',
  },
  {
    id: 'PL-ACUSE',
    nombre: 'Acuse de recibo',
    canal: 'Email',
    fase: 'General',
    asunto: 'Recibido · {NUM_EXPEDIENTE}',
    cuerpo:
      'Estimado/a {CONTACTO}:\n\nConfirmamos la recepción de su comunicación. La revisaremos y le daremos respuesta a la mayor brevedad.\n\n{REMITENTE}',
  },
  {
    id: 'PL-WA-AVISO',
    nombre: 'Aviso breve',
    canal: 'WhatsApp',
    fase: 'General',
    asunto: '',
    cuerpo:
      'Hola {CONTACTO}, le escribimos desde {DESPACHO} en relación con el expediente {NUM_EXPEDIENTE}. [indicar mensaje]',
    favorita: true,
  },
  {
    id: 'PL-WA-DOC',
    nombre: 'Recordatorio de documentación',
    canal: 'WhatsApp',
    fase: 'Onboarding',
    asunto: '',
    cuerpo:
      'Hola {CONTACTO}, le recordamos que queda pendiente de enviarnos: [indicar documento]. Gracias.',
  },
]

export type ValoresPlantilla = Partial<Record<string, string>>

/** Sustitución simple de variables. Lo no informado se deja visible entre llaves. */
export function aplicarVariables(texto: string, valores: ValoresPlantilla) {
  return texto.replace(/\{([A-Z_]+)\}/g, (m, clave: string) => valores[clave] ?? m)
}

/* ----------------------- Semilla de demostración -------------------- */

const dd = (dias: number) => {
  const f = new Date(HOY)
  f.setDate(f.getDate() + dias)
  return formatoFecha(f)
}

/**
 * Datos de prueba de COMUNICACIONES. Cubren las seis fases de LEX, los tres
 * canales, entradas y salidas, adjuntos guardados y pendientes de guardar,
 * comunicaciones ya gestionadas, pendientes de contestar y con tareas
 * vinculadas. Son SÓLO datos de demostración: pueden borrarse sin efectos.
 */
export const COMUNICACIONES_DEMO: Comunicacion[] = [
  /* ------------------------------ LEAD ------------------------------ */
  {
    id: 'CM-9002',
    contactoId: 'CT-0003',
    cuenta: 'info@abogadospatrimoniales.es',
    direccion: 'Entrada',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-1),
    hora: '18:40',
    emisor: 'Ramón Iglesias Peña',
    destinatarios: ['info@abogadospatrimoniales.es'],
    participantes: [],
    asunto: 'Solicitud de información sobre una herencia familiar',
    contenido:
      'Buenas tardes. Mi padre falleció el mes pasado y somos cuatro hermanos. Nos gustaría concertar una primera consulta para saber cómo repartir la herencia y qué documentación necesitamos.',
    resultado: '',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: false,
    incluibleReporte: false,
    responsable: 'Marta Solé',
    enviada: true,
    triaje: 'Pendiente',
    pendienteContestar: true,
  },
  {
    id: 'CM-9101',
    contactoId: 'CT-0004',
    leadId: 'OP-1101',
    cuenta: 'info@abogadospatrimoniales.es',
    direccion: 'Salida',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-2),
    hora: '12:15',
    emisor: 'Luis Ferrán',
    destinatarios: ['beatriz.canete@correo.es'],
    participantes: [],
    asunto: 'Propuesta de primera cita · Donación con reserva de usufructo',
    contenido:
      'Buenos días, Beatriz:\n\nLe proponemos celebrar la primera cita el jueves a las 10:00 en nuestro despacho para revisar la donación de la vivienda a sus dos hijos con reserva de usufructo.\n\nConfírmenos si le resulta posible.\n\nUn saludo,\nLuis Ferrán',
    resultado: '',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: false,
    responsable: 'Luis Ferrán',
    enviada: true,
    estadoEnvio: 'Enviado',
    triaje: 'Tratada',
    contestadaEn: `${dd(-2)} 12:15`,
  },
  {
    id: 'CM-9102',
    contactoId: 'CT-0005',
    leadId: 'OP-1109',
    cuenta: '+34 900 000 000',
    direccion: 'Entrada',
    tipo: 'Mensaje',
    canal: 'WhatsApp',
    fecha: dd(0),
    hora: '08:55',
    emisor: 'Alfonso Rueda Barcina',
    destinatarios: ['WhatsApp Business del despacho'],
    participantes: [],
    asunto: 'Consulta previa sobre la compraventa de la nave',
    contenido:
      'Buenos días, el vendedor me pide firmar arras esta semana. ¿Podemos hablar hoy antes de comprometerme a nada?',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [{ nombre: 'Borrador_arras_nave.pdf' }],
    proximaAccion: '',
    clienteInformado: false,
    incluibleReporte: false,
    responsable: 'Luis Ferrán',
    enviada: true,
    triaje: 'Pendiente',
    pendienteContestar: true,
  },

  /* --------------------------- ONBOARDING --------------------------- */
  {
    id: 'CM-9103',
    contactoId: 'CT-0011',
    onboardingId: 'ONB-0001',
    cuenta: 'administracion@abogadospatrimoniales.es',
    direccion: 'Salida',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-4),
    hora: '09:30',
    emisor: 'Nuria Casals',
    destinatarios: ['jorge.landa@correo.es'],
    participantes: [],
    asunto: 'Proforma de honorarios · Apertura del encargo',
    contenido:
      'Buenos días, Jorge:\n\nLe remitimos la proforma de honorarios correspondiente al encargo. Una vez confirmado el pago iniciaremos formalmente la tramitación y abriremos el expediente.\n\nUn saludo,\nNuria Casals',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [{ nombre: 'Proforma_2026_0187.pdf', documentoId: 'DOC-0004' }],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: true,
    responsable: 'Nuria Casals',
    enviada: true,
    estadoEnvio: 'Enviado',
    triaje: 'Tratada',
    contestadaEn: `${dd(-4)} 09:30`,
  },
  {
    id: 'CM-9104',
    contactoId: 'CT-0011',
    onboardingId: 'ONB-0001',
    cuenta: 'administracion@abogadospatrimoniales.es',
    direccion: 'Entrada',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-3),
    hora: '17:05',
    emisor: 'Jorge Landa Etxeberria',
    destinatarios: ['administracion@abogadospatrimoniales.es'],
    participantes: [],
    asunto: 'RE: Proforma de honorarios · justificante de transferencia',
    contenido:
      'Buenas tardes, adjunto el justificante de la transferencia realizada esta mañana. Quedo a la espera de que me indiquen los siguientes pasos y la documentación que debo aportar.',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [{ nombre: 'Justificante_transferencia.pdf' }],
    proximaAccion: '',
    clienteInformado: false,
    incluibleReporte: true,
    responsable: 'Nuria Casals',
    enviada: true,
    triaje: 'Pendiente',
    pendienteContestar: true,
    tareasVinculadas: ['TR-9001'],
    respuestaDe: 'CM-9103',
  },

  /* ---------------------------- CASEWORK ---------------------------- */
  {
    id: 'CM-9001',
    contactoId: 'CT-0011',
    expedienteId: 'EX-0101',
    cuenta: 'info@abogadospatrimoniales.es',
    direccion: 'Entrada',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(0),
    hora: '09:12',
    emisor: 'Jorge Landa Etxeberria',
    destinatarios: ['info@abogadospatrimoniales.es'],
    participantes: [],
    asunto: 'Consulta sobre la sentencia recibida',
    contenido:
      'Buenos días, he recibido la notificación de la sentencia y me gustaría saber qué plazos tenemos ahora y si la parte contraria puede recurrir.',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [{ nombre: 'Sentencia_231_2026.pdf', documentoId: 'DOC-0001' }],
    proximaAccion: '',
    clienteInformado: false,
    incluibleReporte: true,
    responsable: 'Marta Solé',
    enviada: true,
    triaje: 'Pendiente',
    pendienteContestar: true,
    tareaEspecialId: 'TR-9002',
    tareasVinculadas: ['TR-9002'],
  },
  {
    id: 'CM-9105',
    contactoId: 'CT-0007',
    expedienteId: 'EX-0103',
    cuenta: 'jon@abogadospatrimoniales.es',
    direccion: 'Entrada',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-5),
    hora: '13:22',
    emisor: 'Rosa Ibáñez (procuradora)',
    destinatarios: ['jon@abogadospatrimoniales.es'],
    participantes: ['Luis Ferrán'],
    asunto: 'Diligencia de averiguación patrimonial · autos 998/2025',
    contenido:
      'Os traslado la diligencia recibida en el juzgado con el resultado de la averiguación patrimonial. Conviene solicitar el embargo de saldos a la mayor brevedad.',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [{ nombre: 'Diligencia_averiguacion.pdf' }],
    proximaAccion: '',
    clienteInformado: false,
    incluibleReporte: true,
    responsable: 'Luis Ferrán',
    enviada: true,
    triaje: 'Tratada',
    tareasVinculadas: ['TR-0003'],
  },
  {
    id: 'CM-9003',
    contactoId: 'CT-0007',
    expedienteId: 'EX-0103',
    cuenta: '+34 900 000 000',
    direccion: 'Salida',
    tipo: 'Mensaje',
    canal: 'WhatsApp',
    fecha: dd(-2),
    hora: '11:05',
    emisor: 'Luis Ferrán',
    destinatarios: ['Gestión Fincas Levante'],
    participantes: [],
    asunto: 'Recordatorio de documentación pendiente',
    contenido:
      'Buenos días: le recordamos que queda pendiente el certificado bancario para completar la ejecución. Muchas gracias.',
    resultado: '',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: false,
    responsable: 'Luis Ferrán',
    enviada: true,
    triaje: 'Tratada',
  },
  {
    id: 'CM-9005',
    contactoId: 'CT-0011',
    expedienteId: 'EX-0101',
    direccion: 'Entrada',
    tipo: 'Llamada',
    canal: 'Llamada',
    fecha: dd(-1),
    hora: '10:30',
    emisor: 'Jorge Landa Etxeberria',
    destinatarios: ['Despacho'],
    participantes: ['Recepción'],
    asunto: 'Llamada recibida: solicita hablar con la letrada',
    contenido: '',
    notasInternas: 'Pide que le devuelvan la llamada por la tarde, después de las 17:00.',
    resultado: '',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: false,
    incluibleReporte: false,
    responsable: 'Marta Solé',
    enviada: true,
    triaje: 'Pendiente',
    tareaEspecialId: 'TR-9003',
    tareasVinculadas: ['TR-9003'],
  },

  /* ---------------------------- DELIVERY ---------------------------- */
  {
    id: 'CM-9004',
    contactoId: 'CT-0002',
    expedienteId: 'EX-0104',
    cuenta: 'godoy@abogadospatrimoniales.es',
    direccion: 'Salida',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-3),
    hora: '16:20',
    emisor: 'Marta Solé',
    destinatarios: ['direccion@inversionestorrelodones.es'],
    participantes: [],
    asunto: 'ÚLTIMAS ACTUACIONES · EX-2026-0104',
    contenido:
      'Le informamos de las últimas actuaciones practicadas: se ha remitido requerimiento notarial al obligado por el impago del segundo plazo y estamos valorando la derivación a ejecución judicial.',
    resultado: '',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: true,
    responsable: 'Marta Solé',
    enviada: true,
    estadoEnvio: 'Enviado',
    triaje: 'Tratada',
    contestadaEn: `${dd(-3)} 16:20`,
  },
  {
    id: 'CM-9106',
    contactoId: 'CT-0003',
    expedienteId: 'EX-0102',
    cuenta: 'godoy@abogadospatrimoniales.es',
    direccion: 'Salida',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-6),
    hora: '10:40',
    emisor: 'Ana Torregrosa',
    destinatarios: ['ramon.iglesias@correo.es'],
    participantes: [],
    asunto: 'Entrega de resultado · Escritura de disolución de proindiviso',
    contenido:
      'Buenos días, Ramón:\n\nLe hacemos entrega de la escritura firmada de disolución del proindiviso y de la liquidación económica del encargo. Quedamos pendientes únicamente del segundo pago aplazado.\n\nUn saludo,\nAna Torregrosa',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [
      { nombre: 'Escritura_disolucion.pdf', documentoId: 'DOC-0004' },
      { nombre: 'Liquidacion_economica.pdf' },
    ],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: true,
    responsable: 'Ana Torregrosa',
    enviada: true,
    estadoEnvio: 'Enviado',
    triaje: 'Tratada',
    contestadaEn: `${dd(-6)} 10:40`,
  },
  {
    id: 'CM-9107',
    contactoId: 'CT-0003',
    expedienteId: 'EX-0102',
    cuenta: '+34 900 000 000',
    direccion: 'Salida',
    tipo: 'Mensaje',
    canal: 'WhatsApp',
    fecha: dd(-6),
    hora: '10:45',
    emisor: 'Ana Torregrosa',
    destinatarios: ['Ramón Iglesias Peña'],
    participantes: [],
    asunto: 'Aviso de entrega disponible',
    contenido:
      'Buenos días, Ramón: la documentación final de su asunto ya está disponible. Le hemos escrito por correo con el detalle.',
    resultado: '',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: false,
    responsable: 'Ana Torregrosa',
    enviada: true,
    triaje: 'Tratada',
  },

  /* --------------------------- OFFBOARDING -------------------------- */
  {
    id: 'CM-9108',
    contactoId: 'CT-0007',
    expedienteId: 'EX-0105',
    cuenta: 'godoy@abogadospatrimoniales.es',
    direccion: 'Salida',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-12),
    hora: '12:00',
    emisor: 'Luis Ferrán',
    destinatarios: ['administracion@gestionfincaslevante.es'],
    participantes: [],
    asunto: 'Cierre del expediente · EX-2026-0105',
    contenido:
      'Buenos días:\n\nDamos por concluida nuestra intervención en el asunto. Conservamos la documentación a su disposición y quedamos pendientes de coordinar la devolución de los originales.\n\nUn saludo,\nLuis Ferrán',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [{ nombre: 'Informe_cierre_EX0105.pdf', documentoId: 'DOC-0004' }],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: true,
    responsable: 'Luis Ferrán',
    enviada: true,
    estadoEnvio: 'Enviado',
    triaje: 'Tratada',
    contestadaEn: `${dd(-12)} 12:00`,
  },
  {
    id: 'CM-9109',
    contactoId: 'CT-0007',
    expedienteId: 'EX-0105',
    direccion: 'Salida',
    tipo: 'Llamada',
    canal: 'Llamada',
    fecha: dd(-11),
    hora: '09:20',
    emisor: 'Luis Ferrán',
    destinatarios: ['Gestión Fincas Levante'],
    participantes: ['Luis Ferrán'],
    asunto: 'Llamada de cierre: devolución de originales',
    contenido: '',
    notasInternas:
      'Conforme con el cierre. Pasarán a recoger los originales la próxima semana; sin incidencias.',
    resultado: 'Recogida de originales acordada',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: false,
    responsable: 'Luis Ferrán',
    enviada: true,
    triaje: 'Tratada',
  },

  /* ---------------------------- AFTERCARE --------------------------- */
  {
    id: 'CM-9110',
    contactoId: 'CT-0002',
    expedienteId: 'EX-0104',
    cuenta: 'godoy@abogadospatrimoniales.es',
    direccion: 'Salida',
    tipo: 'Email',
    canal: 'Email',
    fecha: dd(-20),
    hora: '11:10',
    emisor: 'Marta Solé',
    destinatarios: ['direccion@inversionestorrelodones.es'],
    participantes: [],
    asunto: 'Seguimiento posterior · revisión anual del protocolo societario',
    contenido:
      'Buenos días:\n\nHa pasado un tiempo desde el cierre del encargo y queremos interesarnos por su situación. Conviene revisar el protocolo societario antes de que finalice el ejercicio.\n\nUn saludo,\nMarta Solé',
    resultado: '',
    adjuntos: [],
    proximaAccion: '',
    clienteInformado: true,
    incluibleReporte: true,
    responsable: 'Marta Solé',
    enviada: true,
    estadoEnvio: 'Enviado',
    triaje: 'Tratada',
    contestadaEn: `${dd(-20)} 11:10`,
  },
  {
    id: 'CM-9111',
    contactoId: 'CT-0001',
    cuenta: '+34 900 000 000',
    direccion: 'Entrada',
    tipo: 'Mensaje',
    canal: 'WhatsApp',
    fecha: dd(-1),
    hora: '20:12',
    emisor: 'Elena Vargas Ripoll',
    destinatarios: ['WhatsApp Business del despacho'],
    participantes: [],
    asunto: 'Duda posterior sobre el impuesto de donaciones',
    contenido:
      'Buenas noches, me ha llegado una carta de Hacienda relacionada con la donación que tramitamos el año pasado. ¿Puedo enviársela para que le echen un vistazo?',
    resultado: '',
    adjuntos: [],
    adjuntosRef: [{ nombre: 'Carta_Hacienda.jpg' }],
    proximaAccion: '',
    clienteInformado: false,
    incluibleReporte: false,
    responsable: 'Ana Torregrosa',
    enviada: true,
    triaje: 'Pendiente',
    pendienteContestar: true,
  },
]

/**
 * Tareas de demostración vinculadas a las comunicaciones anteriores: una tarea
 * normal, una TAREA ESPECIAL DE COMUNICACIÓN (email) y una llamada pendiente
 * de devolver. Sólo sirven para revisar la interfaz.
 */
export const TAREAS_COMUNICACIONES_DEMO = [
  {
    id: 'TR-9001',
    titulo: 'Comprobar el justificante de pago y abrir el expediente',
    descripcion:
      'Verificar el ingreso del cliente y dar el paso de Onboarding a expediente activo.',
    origen: {
      tipo: 'Comunicación' as const,
      id: 'CM-9104',
      label: 'Justificante de transferencia',
    },
    responsable: 'Nuria Casals',
    colaboradores: [],
    prioridad: 'Alta' as const,
    estado: 'En curso' as const,
    fechaInicio: dd(-3),
    vencimiento: dd(1),
    recordatorio: dd(0),
    checklist: [],
    resultado: '',
    tiempo: 0,
    documentos: [],
  },
  {
    id: 'TR-9002',
    titulo: 'Contestar al cliente sobre los plazos de la sentencia',
    descripcion: 'Responder al correo del cliente explicando plazos de firmeza y recurso.',
    expedienteId: 'EX-0101',
    origen: { tipo: 'Comunicación' as const, id: 'CM-9001', label: 'Consulta sobre la sentencia' },
    responsable: 'Marta Solé',
    colaboradores: [],
    prioridad: 'Alta' as const,
    estado: 'Pendiente' as const,
    fechaInicio: dd(0),
    vencimiento: dd(1),
    recordatorio: dd(0),
    checklist: [],
    resultado: '',
    tiempo: 0,
    documentos: [],
    especial: {
      tipo: 'Comunicación' as const,
      canal: 'Email' as const,
      comunicacionId: 'CM-9001',
      contactoId: 'CT-0011',
      contacto: 'Jorge Landa Etxeberria',
      destino: 'jorge.landa@correo.es',
    },
  },
  {
    id: 'TR-9003',
    titulo: 'Devolver la llamada al cliente',
    descripcion: 'Llamada recibida en recepción: pide que le devuelvan la llamada por la tarde.',
    expedienteId: 'EX-0101',
    origen: { tipo: 'Comunicación' as const, id: 'CM-9005', label: 'Llamada recibida' },
    responsable: 'Marta Solé',
    colaboradores: [],
    prioridad: 'Media' as const,
    estado: 'Pendiente' as const,
    fechaInicio: dd(-1),
    vencimiento: dd(0),
    recordatorio: dd(0),
    checklist: [],
    resultado: '',
    tiempo: 0,
    documentos: [],
    especial: {
      tipo: 'Comunicación' as const,
      canal: 'Llamada' as const,
      comunicacionId: 'CM-9005',
      contactoId: 'CT-0011',
      contacto: 'Jorge Landa Etxeberria',
      destino: '+34 600 111 222',
    },
  },
]
